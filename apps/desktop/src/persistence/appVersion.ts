import { invoke } from "@tauri-apps/api/core";
import { version as packageVersion } from "../../package.json";
import { isTauriRuntime } from "./environment.js";

/**
 * What the *frontend bundle* was built from.
 *
 * Read by importing the declaration itself rather than through a bundler
 * `define` or a `VITE_` variable: both of those are build-time substitutions
 * that the test run does not perform, which would leave the tests asserting
 * against a fallback string instead of the version they exist to guard. A plain
 * import is the same value in the bundle, the dev server and Vitest.
 *
 * This is the desktop package's own declaration, not the root one. The release
 * policy makes the root `package.json` authoritative, and preflight fails if the
 * two disagree, so reading the nearer file cannot report a different number
 * without the gate having already failed.
 */
export const BUILD_VERSION: string = packageVersion;

export type VersionSource = "binary" | "build";

export interface AppVersion {
  version: string;
  source: VersionSource;
}

/**
 * What version is actually running.
 *
 * The desktop asks the binary (`CARGO_PKG_VERSION`, compiled in) rather than
 * reading a JSON file's claim, because the release defect D16 exists to prevent
 * is precisely a mismatch between the two: an installer that advertises one
 * version wrapped around a binary that carries another. A support conversation
 * needs the number that is executing, not the number someone wrote down.
 *
 * In the browser preview there is no binary, so the build-time version is shown
 * and labelled as such. A failed IPC call falls back the same way instead of
 * leaving the surface blank - an unknown version is worth showing; an empty one
 * looks like a rendering bug.
 */
export async function readAppVersion(): Promise<AppVersion> {
  if (!isTauriRuntime()) return { version: BUILD_VERSION, source: "build" };
  try {
    const version = await invoke<string>("get_app_version");
    return version ? { version, source: "binary" } : { version: BUILD_VERSION, source: "build" };
  } catch {
    return { version: BUILD_VERSION, source: "build" };
  }
}
