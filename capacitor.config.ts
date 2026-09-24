import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.macrogrid.client",
  appName: "Macro Grid",
  webDir: "dist",
  android: {
    // The client connects to a plaintext ws:// server on the LAN (no TLS — self-signed certs would
    // be a worse UX for a home/LAN tool). Cleartext must be allowed at the OS level for Android 9+.
    allowMixedContent: true,
  },
};

export default config;
