package com.macrogrid.client;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The native half of the app's self-update (plan: docs/plans/phone-app-auto-update-plan.md in the server repository). It does
 * everything that must not run in the WebView: asks GitHub for the releases list, downloads and verifies the APK, checks that
 * it is signed by the same key as the installed app, reads the connection type, and hands the file to Android's installer.
 *
 * <p>What it never does: talk to any address other than the releases list of this app's repository and the GitHub hosts an
 * APK download redirects to (see {@link UpdaterRules}); keep more than one downloaded APK; install without Android's own
 * confirmation dialog. Every method rejects with a short code in {@code call.reject(message, code)}; the web side maps codes
 * to texts. The downloaded file lives in the app's private cache folder ({@code cache/updates/<version>/}), so no storage
 * permission is needed and no other app can read it.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private static final String TAG = "Updater";
    private static final int TIMEOUT_MS = 15_000;
    private static final int MAX_FEED_BYTES = 4 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 5;
    private static final long PROGRESS_INTERVAL_MS = 250;
    static final String INSTALL_RESULT_EVENT = "installResult";

    /** The receiver of the installer's result reaches the plugin through this (there is one plugin instance per bridge). */
    private static volatile UpdaterPlugin instance;

    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private volatile boolean cancelRequested;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        executor.shutdownNow();
    }

    // ---- The releases list -------------------------------------------------------------------------------------------

    /** GET the releases list with If-None-Match. Resolves {status: 200|304, etag, body}; the body is null on 304. */
    @PluginMethod
    public void fetchReleases(PluginCall call) {
        final String etag = call.getString("etag");
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(UpdaterRules.RELEASES_URL).openConnection();
                prepare(connection);
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                if (etag != null && !etag.isEmpty()) connection.setRequestProperty("If-None-Match", etag);

                int status = connection.getResponseCode();
                JSObject result = new JSObject();
                result.put("status", status);
                if (status == HttpURLConnection.HTTP_NOT_MODIFIED) {
                    result.put("etag", etag);
                    result.put("body", JSObject.NULL);
                    call.resolve(result);
                } else if (status == HttpURLConnection.HTTP_OK) {
                    result.put("etag", connection.getHeaderField("ETag"));
                    result.put("body", readBounded(connection.getInputStream(), MAX_FEED_BYTES));
                    call.resolve(result);
                } else {
                    call.reject("The releases list answered " + status, "http_" + status);
                }
            } catch (TooLargeException e) {
                call.reject("The releases list is too large", "too_large");
            } catch (IOException e) {
                call.reject("The releases list could not be loaded", "network");
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    // ---- Connection --------------------------------------------------------------------------------------------------

    /** {connected, unmetered}: "unmetered" is Wi-Fi without a data limit; a phone hotspot or mobile data is metered. */
    @PluginMethod
    public void getConnection(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", isConnected());
        result.put("unmetered", isUnmetered());
        call.resolve(result);
    }

    private boolean isConnected() {
        NetworkCapabilities capabilities = activeCapabilities();
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private boolean isUnmetered() {
        NetworkCapabilities capabilities = activeCapabilities();
        return capabilities != null
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
    }

    private NetworkCapabilities activeCapabilities() {
        ConnectivityManager manager = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) return null;
        Network network = manager.getActiveNetwork();
        return network == null ? null : manager.getNetworkCapabilities(network);
    }

    // ---- Download ----------------------------------------------------------------------------------------------------

    /**
     * Downloads the APK of {@code version} into the private cache, checking the size and the SHA-256 the release reports, and
     * that the file is signed by the installed app's key. Emits {@code downloadProgress {received, total}} while it runs.
     * Params: url, size, sha256 (lower case hex), version ("0.2.0"), allowMetered (false: stop when the network is metered).
     * Codes: bad_request, metered, cancelled, network, size_mismatch, verification_failed, signer_mismatch, storage.
     */
    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url");
        final String version = call.getString("version");
        final String sha256 = call.getString("sha256");
        final Long size = UpdaterRules.asLong(call.getData().opt("size"));
        final boolean allowMetered = Boolean.TRUE.equals(call.getBoolean("allowMetered", false));

        if (!UpdaterRules.isAllowedUrl(url) || !UpdaterRules.isPlainVersion(version) || !UpdaterRules.isSha256(sha256)
            || size == null || size <= 0) {
            call.reject("The update file is not acceptable", "bad_request");
            return;
        }
        cancelRequested = false;
        executor.execute(() -> runDownload(call, url, version, sha256, size, allowMetered));
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelRequested = true;
        call.resolve();
    }

    private void runDownload(PluginCall call, String url, String version, String sha256, long size, boolean allowMetered) {
        if (!allowMetered && !isUnmetered()) {
            call.reject("Not on an unmetered network", "metered");
            return;
        }

        File folder = new File(updatesRoot(), version);
        File target = new File(folder, UpdaterRules.apkFileName(version));
        File part = new File(folder, target.getName() + ".part");
        try {
            if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Cannot create " + folder);

            // A verified file from an earlier attempt is reused.
            if (target.isFile() && target.length() == size && sha256.equals(digestOf(target))) {
                finishDownload(call, target, version);
                return;
            }
            //noinspection ResultOfMethodCallIgnored
            target.delete();

            HttpURLConnection connection = openFollowingRedirects(url);
            try {
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    call.reject("The download answered " + connection.getResponseCode(), "network");
                    return;
                }
                long declared = connection.getContentLengthLong();
                if (declared > 0 && declared != size) {
                    call.reject("The file size differs from the release", "size_mismatch");
                    return;
                }
                String problem = copyVerified(connection.getInputStream(), part, size, allowMetered);
                if (problem != null) {
                    call.reject(problem, problem);
                    return;
                }
            } finally {
                connection.disconnect();
            }

            if (!sha256.equals(digestOf(part))) {
                call.reject("The download does not match the release checksum", "verification_failed");
                return;
            }
            if (!part.renameTo(target)) throw new IOException("Cannot rename " + part);
            finishDownload(call, target, version);
        } catch (IOException e) {
            Log.w(TAG, "Download failed", e);
            call.reject("The download failed", "network");
        } finally {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            // Removes the version folder again when nothing was kept in it (delete() fails on a folder that has files).
            //noinspection ResultOfMethodCallIgnored
            folder.delete();
        }
    }

    /** The signer check, then resolve; a file that fails it is deleted. */
    private void finishDownload(PluginCall call, File target, String version) {
        if (!isSignedByThisApp(target)) {
            //noinspection ResultOfMethodCallIgnored
            target.delete();
            call.reject("The update is not signed by the key of the installed app", "signer_mismatch");
            return;
        }
        JSObject result = new JSObject();
        result.put("version", version);
        call.resolve(result);
    }

    /**
     * Copies the stream into {@code part}, computing nothing but counting: the size must not exceed what the release says, and
     * on Wi-Fi only the copy stops when the network becomes metered. Returns null on success or an error code.
     */
    private String copyVerified(InputStream in, File part, long size, boolean allowMetered) throws IOException {
        byte[] buffer = new byte[32 * 1024];
        long received = 0;
        long lastEmit = 0;
        try (OutputStream out = new java.io.FileOutputStream(part)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                if (cancelRequested) return "cancelled";
                received += read;
                if (received > size) return "size_mismatch";
                out.write(buffer, 0, read);

                long now = System.currentTimeMillis();
                if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
                    lastEmit = now;
                    if (!allowMetered && !isUnmetered()) return "metered";
                    JSObject progress = new JSObject();
                    progress.put("received", received);
                    progress.put("total", size);
                    notifyListeners("downloadProgress", progress);
                }
            }
        }
        if (received != size) return "size_mismatch";
        JSObject done = new JSObject();
        done.put("received", received);
        done.put("total", size);
        notifyListeners("downloadProgress", done);
        return null;
    }

    /** Follows redirects by hand (at most {@link #MAX_REDIRECTS}) and checks every address against the allow-list. */
    private HttpURLConnection openFollowingRedirects(String startUrl) throws IOException {
        String url = startUrl;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            if (!UpdaterRules.isAllowedUrl(url)) throw new IOException("Address not allowed");
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            prepare(connection);
            int status = connection.getResponseCode();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new IOException("Redirect without a location");
                url = new URL(new URL(url), location).toString();
                continue;
            }
            return connection;
        }
        throw new IOException("Too many redirects");
    }

    private void prepare(HttpURLConnection connection) throws IOException {
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", "MacroGridClient/" + appVersionName());
    }

    // ---- Verification ------------------------------------------------------------------------------------------------

    private static String digestOf(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) digest.update(buffer, 0, read);
            return hex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) text.append(String.format("%02x", b));
        return text.toString();
    }

    /** True when the APK at {@code apk} is signed by exactly the certificates of the installed app (Android needs that to update). */
    @SuppressWarnings("deprecation")
    private boolean isSignedByThisApp(File apk) {
        try {
            PackageManager manager = getContext().getPackageManager();
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
            PackageInfo installed = manager.getPackageInfo(getContext().getPackageName(), flags);
            PackageInfo archive = manager.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
            if (archive == null) return false;
            Set<String> mine = signerDigests(installed);
            Set<String> theirs = signerDigests(archive);
            return !mine.isEmpty() && mine.equals(theirs);
        } catch (Exception e) {
            Log.w(TAG, "Signer check failed", e);
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private static Set<String> signerDigests(PackageInfo info) throws Exception {
        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo != null) signatures = info.signingInfo.getApkContentsSigners();
        } else {
            signatures = info.signatures;
        }
        Set<String> digests = new HashSet<>();
        if (signatures == null) return digests;
        for (Signature signature : signatures) {
            digests.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        }
        return digests;
    }

    // ---- Install -----------------------------------------------------------------------------------------------------

    /** Whether Android lets this app install packages ("install unknown apps" for Macro Grid). */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canRequestInstalls());
        call.resolve(result);
    }

    @SuppressWarnings("deprecation")
    private boolean canRequestInstalls() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return Settings.Secure.getInt(getContext().getContentResolver(), Settings.Secure.INSTALL_NON_MARKET_APPS, 0) == 1;
    }

    /** Opens the Android page where the person allows Macro Grid to install apps (the page for this app on Android 8+). */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))
            : new Intent(Settings.ACTION_SECURITY_SETTINGS);
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("The settings page could not be opened", "no_settings");
            }
        });
    }

    /**
     * Hands the downloaded APK of {@code version} to Android's installer. Resolves when the session is committed; the outcome
     * arrives as the {@code installResult {status, message}} event ("success", "cancelled", "incompatible", "storage", "failed"),
     * after Android has shown its own confirmation dialog (it cannot be skipped). When it succeeds Android stops the app.
     * Codes: bad_request, not_downloaded, signer_mismatch, install_not_allowed, install_failed.
     */
    @PluginMethod
    public void install(PluginCall call) {
        final String version = call.getString("version");
        if (!UpdaterRules.isPlainVersion(version)) {
            call.reject("Bad version", "bad_request");
            return;
        }
        if (!canRequestInstalls()) {
            call.reject("Installing is not allowed for this app", "install_not_allowed");
            return;
        }
        executor.execute(() -> {
            File apk = new File(new File(updatesRoot(), version), UpdaterRules.apkFileName(version));
            if (!apk.isFile()) {
                call.reject("The update was not downloaded", "not_downloaded");
                return;
            }
            // The file sits in a private folder, but check again right before installing: it is cheap.
            if (!isSignedByThisApp(apk)) {
                call.reject("The update is not signed by the key of the installed app", "signer_mismatch");
                return;
            }
            try {
                commitSession(apk);
                call.resolve();
            } catch (IOException | RuntimeException e) {
                Log.w(TAG, "Install session failed", e);
                call.reject("The installer could not be started", "install_failed");
            }
        });
    }

    private void commitSession(File apk) throws IOException {
        Context context = getContext();
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName());
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("macro-grid.apk", 0, apk.length())) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                session.fsync(out);
            }
            // An explicit intent to our own receiver; the flag must be mutable so the installer can add its result extras.
            Intent intent = new Intent(context, InstallResultReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            IntentSender sender = PendingIntent.getBroadcast(context, sessionId, intent, flags).getIntentSender();
            session.commit(sender);
        } catch (IOException | RuntimeException e) {
            installer.abandonSession(sessionId);
            throw e;
        }
    }

    /** Called by {@link InstallResultReceiver} with the installer's answer. */
    static void deliverInstallResult(String status, String message) {
        UpdaterPlugin plugin = instance;
        if (plugin == null) return;
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("message", message == null ? "" : message);
        plugin.notifyListeners(INSTALL_RESULT_EVENT, result);
    }

    // ---- Downloads folder --------------------------------------------------------------------------------------------

    /**
     * Keeps at most one downloaded APK (owner rule): removes every version folder except {@code keep} (null: all of them) and
     * whatever else the updater left next to the kept file ({@code .part} files). Never touches anything that is not a
     * version-named folder inside {@code cache/updates}. Never rejects: a file that cannot be deleted is logged and left for
     * the next start.
     */
    @PluginMethod
    public void cleanUp(PluginCall call) {
        final String keep = call.getString("keep");
        executor.execute(() -> {
            int removed = 0;
            File root = updatesRoot();
            try {
                String[] names = root.list();
                for (String name : UpdaterRules.foldersToDelete(names, keep)) {
                    removed += deleteTree(new File(root, name));
                }
                if (keep != null && UpdaterRules.isPlainVersion(keep)) {
                    File kept = new File(root, keep);
                    String[] inside = kept.list();
                    if (inside != null) {
                        for (String name : inside) {
                            if (!name.equals(UpdaterRules.apkFileName(keep))) removed += deleteTree(new File(kept, name));
                        }
                    }
                }
                String[] left = root.list();
                if (left != null && left.length == 0 && !root.delete()) Log.w(TAG, "Could not remove " + root);
            } catch (RuntimeException e) {
                Log.w(TAG, "Clean-up failed", e);
            }
            JSObject result = new JSObject();
            result.put("removed", removed);
            call.resolve(result);
        });
    }

    private static int deleteTree(File file) {
        int removed = 0;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) removed += deleteTree(child);
        }
        if (file.delete()) removed++;
        else if (file.exists()) Log.w(TAG, "Could not delete " + file);
        return removed;
    }

    // ---- Helpers -----------------------------------------------------------------------------------------------------

    private File updatesRoot() {
        return new File(getContext().getCacheDir(), "updates");
    }

    private String appVersionName() {
        try {
            String name = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName;
            return name == null ? "unknown" : name;
        } catch (PackageManager.NameNotFoundException e) {
            return "unknown";
        }
    }

    private static String readBounded(InputStream in, int limit) throws IOException {
        try (InputStream stream = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                if (out.size() + read > limit) throw new TooLargeException();
                out.write(buffer, 0, read);
            }
            return out.toString("UTF-8");
        }
    }

    private static final class TooLargeException extends IOException {}
}
