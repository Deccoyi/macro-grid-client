import { cpSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** Copies the third-party notices and license texts into the build output, so they are packaged into
 * the APK together with the web assets (see THIRD_PARTY_NOTICES.md). */
function bundleLicenses(): Plugin {
  let outDir = "dist";
  return {
    name: "bundle-licenses",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      cpSync("THIRD_PARTY_NOTICES.md", resolve(outDir, "THIRD_PARTY_NOTICES.md"));
      cpSync("licenses", resolve(outDir, "licenses"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleLicenses()],
  resolve: {
    // @macro/renderer is linked via "file:" (npm symlink). Without this, module resolution can find a
    // SECOND react/react-dom inside the renderer package's own node_modules instead of this app's copy —
    // same double-React trap as in the server repository's editor.
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5191,
  },
});
