package com.macrogrid.client;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The decisions of the updater that need no Android classes, so they are unit tested: which addresses may be
 * downloaded, which values the web side may pass in, and which cached folders the cleanup removes.
 */
final class UpdaterRules {
    private UpdaterRules() {}

    /** The only list the app ever asks about updates (the releases of this app's own repository). */
    static final String RELEASES_URL = "https://api.github.com/repos/Deccoyi/macro-grid-client/releases?per_page=50";

    /** Hosts an APK download may point at: GitHub itself and the hosts its release downloads redirect to. */
    private static final String[] ALLOWED_HOSTS = {
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
    };

    private static final Pattern PLAIN_VERSION = Pattern.compile("^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$");
    private static final Pattern SHA256_HEX = Pattern.compile("^[0-9a-f]{64}$");

    /** Only https on a GitHub host; anything else is refused (an APK from elsewhere is never downloaded). */
    static boolean isAllowedUrl(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null) return false;
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            for (String allowed : ALLOWED_HOSTS) {
                if (allowed.equals(host)) return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /** "0.2.0": the only shape used in file and folder names, so a value from outside can never point elsewhere. */
    static boolean isPlainVersion(String version) {
        return version != null && PLAIN_VERSION.matcher(version).matches();
    }

    /** A lower-case SHA-256 as 64 hex digits. */
    static boolean isSha256(String hex) {
        return hex != null && SHA256_HEX.matcher(hex).matches();
    }

    /**
     * A whole number the web side passed in. Capacitor's own {@code getLong} returns nothing for a value that JSON parsed as an
     * Integer (any size below 2 GB), so read the raw number instead. Null when it is missing or not a number.
     */
    static Long asLong(Object value) {
        if (!(value instanceof Number)) return null;
        double number = ((Number) value).doubleValue();
        if (number != Math.rint(number) || Double.isInfinite(number)) return null;
        return ((Number) value).longValue();
    }

    static String apkFileName(String version) {
        return "MacroGrid-" + version + ".apk";
    }

    /**
     * Of the entries in the updates folder, the ones the cleanup removes: every folder named like a version except
     * {@code keep} (null keeps none). Anything not named like a version is never touched.
     */
    static List<String> foldersToDelete(String[] names, String keep) {
        List<String> result = new ArrayList<>();
        if (names == null) return result;
        for (String name : names) {
            if (isPlainVersion(name) && !name.equals(keep)) result.add(name);
        }
        return result;
    }
}
