import { defineConfig } from "vite";

export default defineConfig({
  // Packaged Electron loads renderer from file://, so asset paths must be relative.
  base: "./",
  plugins: [],
  build: {
    // The renderer intentionally ships a large UI toolkit set; keep warning useful without noisy false alarms.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      onwarn(warning, warn) {
        // Fluent UI and React Router dependencies publish "use client" directives that are safe to ignore in Electron builds.
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          typeof warning.message === "string" &&
          warning.message.includes('"use client"')
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (
            id.includes("ag-grid-community") ||
            id.includes("ag-grid-react")
          ) {
            return "vendor-ag-grid";
          }
          if (
            id.includes("@fluentui") ||
            id.includes("@griffel")
          ) {
            return "vendor-fluent";
          }
          return;
        }
      }
    }
  }
});
