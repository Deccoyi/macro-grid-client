import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // @macro/renderer is linked via "file:" (npm symlink). Without this, module resolution can find a
    // SECOND react/react-dom inside the renderer package's own node_modules instead of this app's copy —
    // same double-React trap documented for the editor in docs/agent-notes.md (Stage 3).
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5191,
  },
});
