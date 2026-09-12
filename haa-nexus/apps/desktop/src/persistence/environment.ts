/**
 * Tauri v2 injects this global into the webview. Its absence means we're
 * running as a plain web page (e.g. `vite dev` in a browser, or any
 * environment without the Rust shell) - the only situation the in-memory
 * repositories are meant for outside of tests.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
