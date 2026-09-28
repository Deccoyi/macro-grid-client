package com.macrogrid.client;

import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * A minimal WebSocket client (RFC 6455) over a TLS socket whose certificate is checked only against a
 * pinned SHA-256 fingerprint, never against a certificate authority — the server's certificate is
 * self-signed (see security-hardening-plan.md section A in the server repository). The WebView's own
 * WebSocket has no way to pin a certificate, so the app uses this native plugin instead whenever a
 * pairing carries a fingerprint; a server without one keeps using the WebView's plain ws:// (see
 * pinnedSocket.ts and connection.ts on the JS side).
 *
 * One connection at a time: a new {@link #connect} closes whatever this plugin was already holding
 * open. Every call and event carries the connection "id" the JS side generated, so a stale connection's
 * late event can never be mistaken for a newer one's after a fast reconnect.
 */
@CapacitorPlugin(name = "PinnedSocket")
public class PinnedSocketPlugin extends Plugin {
    private static final String TAG = "PinnedSocket";
    private static final String WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    private static final int HANDSHAKE_TIMEOUT_MS = 10_000;
    /** A single frame payload above this is refused; the deck's layouts and assets never need more in one frame. */
    private static final long MAX_FRAME_BYTES = 32L * 1024 * 1024;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final AtomicReference<Connection> active = new AtomicReference<>();

    @Override
    protected void handleOnDestroy() {
        Connection connection = active.getAndSet(null);
        if (connection != null) connection.close(1001, "destroyed");
        executor.shutdownNow();
    }

    /** Params: id (caller-chosen, opaque), url (wss://host:port/path), fingerprint (SHA-256 hex, ":" allowed). */
    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        String fingerprint = normalizeFingerprint(call.getString("fingerprint"));
        if (id == null || url == null || fingerprint == null) {
            call.reject("Missing id/url, or fingerprint is not a SHA-256", "bad_request");
            return;
        }

        Connection previous = active.getAndSet(null);
        if (previous != null) previous.close(1000, "superseded");

        Connection connection = new Connection(id, fingerprint);
        active.set(connection);
        // The real outcome (open/error/close) always arrives as an event; this only confirms the request
        // was accepted, so the caller does not have to special-case a synchronous vs. an asynchronous failure.
        call.resolve();
        executor.execute(() -> connection.run(url));
    }

    @PluginMethod
    public void send(PluginCall call) {
        String id = call.getString("id");
        String text = call.getString("text");
        Connection connection = active.get();
        if (connection == null || !connection.id.equals(id)) {
            call.reject("No such connection", "closed");
            return;
        }
        if (text == null) {
            call.reject("Missing text", "bad_request");
            return;
        }
        try {
            connection.sendText(text);
            call.resolve();
        } catch (IOException e) {
            call.reject("Send failed", "closed");
        }
    }

    @PluginMethod
    public void close(PluginCall call) {
        String id = call.getString("id");
        Integer code = call.getInt("code");
        String reason = call.getString("reason", "");
        Connection connection = active.get();
        if (connection != null && connection.id.equals(id)) {
            active.compareAndSet(connection, null);
            connection.close(code == null ? 1000 : code, reason);
        }
        call.resolve();
    }

    // ---- fingerprint --------------------------------------------------------------------------------------------

    /** Lower-cases and strips ":" separators; null if what's left isn't 64 hex digits (a SHA-256). */
    static String normalizeFingerprint(String raw) {
        if (raw == null) return null;
        String cleaned = raw.replace(":", "").trim().toLowerCase(Locale.ROOT);
        return cleaned.matches("[0-9a-f]{64}") ? cleaned : null;
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b));
        return out.toString();
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) result |= a.charAt(i) ^ b.charAt(i);
        return result == 0;
    }

    // ---- one logical connection ------------------------------------------------------------------------------

    private final class Connection {
        final String id;
        private final String pinnedFingerprint;
        private final SecureRandom random = new SecureRandom();
        private final Object writeLock = new Object();
        private volatile Socket socket;
        private volatile boolean closed;

        Connection(String id, String pinnedFingerprint) {
            this.id = id;
            this.pinnedFingerprint = pinnedFingerprint;
        }

        void run(String url) {
            boolean opened = false;
            try {
                URI uri = new URI(url);
                if (!"wss".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                    throw new IOException("Only a wss:// URL with a host is supported");
                }
                String host = uri.getHost();
                int port = uri.getPort() != -1 ? uri.getPort() : 443;
                String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
                if (uri.getRawQuery() != null) path += "?" + uri.getRawQuery();

                Socket raw = new Socket();
                raw.connect(new InetSocketAddress(host, port), HANDSHAKE_TIMEOUT_MS);
                SSLSocket ssl = openPinnedTls(raw, host, port);
                socket = ssl;
                if (closed) return;

                performHandshake(ssl, host, port, path);
                if (closed) return;

                opened = true;
                emit("open", new JSObject());
                readLoop(ssl);
            } catch (Exception e) {
                if (!closed) {
                    Log.w(TAG, "Connection " + id + " failed", e);
                    JSObject data = new JSObject();
                    data.put("message", String.valueOf(e.getMessage()));
                    emit("error", data);
                }
            } finally {
                boolean alreadyClosed = closed;
                closed = true;
                closeSocket();
                active.compareAndSet(this, null);
                if (!alreadyClosed) {
                    JSObject data = new JSObject();
                    // 1006: "abnormal closure", the same code a browser WebSocket reports for a drop it
                    // didn't get an explicit close frame for — matches what ServerConnection already expects.
                    data.put("code", opened ? 1006 : 1002);
                    data.put("reason", "");
                    emit("close", data);
                }
            }
        }

        private SSLSocket openPinnedTls(Socket raw, String host, int port) throws Exception {
            TrustManager pinning = new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                    if (chain == null || chain.length == 0) throw new CertificateException("No certificate presented");
                    try {
                        MessageDigest digest = MessageDigest.getInstance("SHA-256");
                        String actual = hex(digest.digest(chain[0].getEncoded()));
                        if (!constantTimeEquals(actual, pinnedFingerprint)) {
                            throw new CertificateException("Certificate fingerprint does not match the pairing QR");
                        }
                    } catch (NoSuchAlgorithmException e) {
                        throw new CertificateException(e);
                    }
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            };
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[] { pinning }, new SecureRandom());
            SSLSocket ssl = (SSLSocket) context.getSocketFactory().createSocket(raw, host, port, true);
            ssl.startHandshake();
            return ssl;
        }

        private void performHandshake(SSLSocket ssl, String host, int port, String path) throws IOException {
            byte[] keyBytes = new byte[16];
            random.nextBytes(keyBytes);
            String key = Base64.encodeToString(keyBytes, Base64.NO_WRAP);

            OutputStream out = ssl.getOutputStream();
            String request = "GET " + path + " HTTP/1.1\r\n"
                + "Host: " + host + ":" + port + "\r\n"
                + "Upgrade: websocket\r\n"
                + "Connection: Upgrade\r\n"
                + "Sec-WebSocket-Key: " + key + "\r\n"
                + "Sec-WebSocket-Version: 13\r\n\r\n";
            out.write(request.getBytes("UTF-8"));
            out.flush();

            InputStream in = ssl.getInputStream();
            String statusLine = readLine(in);
            if (statusLine == null || !statusLine.contains(" 101 ")) {
                throw new IOException("Server did not upgrade to a WebSocket: " + statusLine);
            }
            String acceptHeader = null;
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0 && line.substring(0, colon).equalsIgnoreCase("Sec-WebSocket-Accept")) {
                    acceptHeader = line.substring(colon + 1).trim();
                }
            }
            if (acceptHeader == null || !acceptHeader.equals(expectedAccept(key))) {
                throw new IOException("Sec-WebSocket-Accept did not match");
            }
        }

        private String expectedAccept(String key) throws IOException {
            try {
                MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
                byte[] digest = sha1.digest((key + WS_GUID).getBytes("UTF-8"));
                return Base64.encodeToString(digest, Base64.NO_WRAP);
            } catch (NoSuchAlgorithmException e) {
                throw new IOException(e);
            }
        }

        private String readLine(InputStream in) throws IOException {
            ByteArrayOutputStream line = new ByteArrayOutputStream();
            int prev = -1;
            int b;
            while ((b = in.read()) != -1) {
                if (prev == '\r' && b == '\n') {
                    byte[] bytes = line.toByteArray();
                    return new String(bytes, 0, bytes.length - 1, "UTF-8");
                }
                line.write(b);
                prev = b;
            }
            return line.size() == 0 ? null : line.toString("UTF-8");
        }

        // ---- frames (RFC 6455 section 5) --------------------------------------------------------------------

        private void readLoop(SSLSocket ssl) throws IOException {
            InputStream in = ssl.getInputStream();
            ByteArrayOutputStream messageBuffer = null;
            int messageOpcode = -1;

            while (!closed) {
                int b0 = readByte(in);
                int b1 = readByte(in);
                boolean fin = (b0 & 0x80) != 0;
                int opcode = b0 & 0x0F;
                boolean masked = (b1 & 0x80) != 0;
                long len = b1 & 0x7F;
                if (len == 126) {
                    len = (readByte(in) << 8) | readByte(in);
                } else if (len == 127) {
                    len = 0;
                    for (int i = 0; i < 8; i++) len = (len << 8) | readByte(in);
                }
                if (len > MAX_FRAME_BYTES) throw new IOException("Frame too large");
                byte[] maskKey = null;
                if (masked) {
                    maskKey = new byte[4];
                    readFully(in, maskKey);
                }
                byte[] payload = new byte[(int) len];
                readFully(in, payload);
                if (masked) {
                    for (int i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
                }

                if (opcode == 0x8) return; // close
                if (opcode == 0x9) { // ping
                    writeFrame(0xA, payload);
                    continue;
                }
                if (opcode == 0xA) continue; // pong, nothing to do

                if (opcode == 0x1 || opcode == 0x2) { // text/binary: start of a message
                    messageOpcode = opcode;
                    messageBuffer = new ByteArrayOutputStream();
                    messageBuffer.write(payload);
                } else if (opcode == 0x0 && messageBuffer != null) { // continuation
                    messageBuffer.write(payload);
                } else {
                    continue;
                }

                if (fin) {
                    byte[] complete = messageBuffer.toByteArray();
                    messageBuffer = null;
                    if (messageOpcode == 0x1) {
                        JSObject data = new JSObject();
                        data.put("data", new String(complete, "UTF-8"));
                        emit("message", data);
                    }
                }
            }
        }

        private int readByte(InputStream in) throws IOException {
            int b = in.read();
            if (b == -1) throw new IOException("Stream closed");
            return b;
        }

        private void readFully(InputStream in, byte[] buffer) throws IOException {
            int off = 0;
            while (off < buffer.length) {
                int read = in.read(buffer, off, buffer.length - off);
                if (read == -1) throw new IOException("Stream closed");
                off += read;
            }
        }

        void sendText(String text) throws IOException {
            writeFrame(0x1, text.getBytes("UTF-8"));
        }

        /** A client-to-server frame must be masked (RFC 6455 section 5.1); the mask key itself needs no secrecy. */
        private void writeFrame(int opcode, byte[] payload) throws IOException {
            Socket s = socket;
            if (s == null || s.isClosed()) throw new IOException("Not connected");
            synchronized (writeLock) {
                OutputStream out = s.getOutputStream();
                ByteArrayOutputStream header = new ByteArrayOutputStream();
                header.write(0x80 | opcode);
                int len = payload.length;
                if (len <= 125) {
                    header.write(0x80 | len);
                } else if (len <= 65535) {
                    header.write(0x80 | 126);
                    header.write((len >> 8) & 0xFF);
                    header.write(len & 0xFF);
                } else {
                    header.write(0x80 | 127);
                    for (int i = 7; i >= 0; i--) header.write((len >> (8 * i)) & 0xFF);
                }
                byte[] maskKey = new byte[4];
                random.nextBytes(maskKey);
                header.write(maskKey, 0, 4);
                out.write(header.toByteArray());
                byte[] masked = new byte[payload.length];
                for (int i = 0; i < payload.length; i++) masked[i] = (byte) (payload[i] ^ maskKey[i % 4]);
                out.write(masked);
                out.flush();
            }
        }

        void close(int code, String reason) {
            if (closed) return;
            closed = true;
            try {
                byte[] reasonBytes = reason == null ? new byte[0] : reason.getBytes("UTF-8");
                byte[] payload = new byte[2 + reasonBytes.length];
                payload[0] = (byte) ((code >> 8) & 0xFF);
                payload[1] = (byte) (code & 0xFF);
                System.arraycopy(reasonBytes, 0, payload, 2, reasonBytes.length);
                writeFrame(0x8, payload);
            } catch (IOException ignored) {
                // Best effort: the socket is closed right after regardless.
            }
            closeSocket();
        }

        private void closeSocket() {
            try {
                Socket s = socket;
                if (s != null) s.close();
            } catch (IOException ignored) {
            }
        }

        private void emit(String event, JSObject data) {
            data.put("id", id);
            notifyListeners(event, data);
        }
    }
}
