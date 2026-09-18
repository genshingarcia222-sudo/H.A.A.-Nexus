import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev server port and relative asset paths.
// See: https://tauri.app/develop/#using-the-frontend-dev-server
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Never watch the Rust side. `tauri dev` starts this dev server first,
      // then cargo builds into src-tauri/target; Vite's watcher would try to
      // watch the executable cargo is writing and die with EBUSY on Windows,
      // which takes the whole `tauri dev` run down with it
      // ("beforeDevCommand terminated with a non-zero status code").
      // cargo watches its own sources - see "Watching ... for changes" in the
      // tauri dev output.
      ignored: ["**/src-tauri/**"]
    }
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG
  }
});
