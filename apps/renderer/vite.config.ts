import { defineConfig } from "vite";

export default defineConfig({
  // Packaged Electron loads renderer from file://, so asset paths must be relative.
  base: "./",
  plugins: []
});
