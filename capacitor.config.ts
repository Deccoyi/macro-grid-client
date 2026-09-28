import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.macrogrid.client",
  appName: "Macro Grid",
  webDir: "dist",
  android: {
    // A pairing QR that carries a certificate fingerprint moves the connection to a pinned wss://
    // via the native PinnedSocket plugin (see PinnedSocketPlugin.java); the WebView itself never
    // sees that traffic. Without a fingerprint (an older server, or a server with TLS turned off)
    // the WebView's own WebSocket still talks plaintext ws:// on the LAN, so cleartext must stay
    // allowed at the OS level for Android 9+.
    allowMixedContent: true,
  },
};

export default config;
