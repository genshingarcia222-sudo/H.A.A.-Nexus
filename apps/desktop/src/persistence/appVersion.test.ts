// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { BUILD_VERSION, readAppVersion } from "./appVersion.js";

const invokeMock = vi.mocked(invoke);

/**
 * Which version the application reports (D16).
 *
 * The rule the tests below hold is narrow and deliberate: on the desktop the
 * number shown must come from the *binary*, not from a JSON file. The release
 * defect D16 exists to prevent is an installer advertising a version its
 * executable does not carry, and a Settings page that reads `package.json`
 * would report the advertised number in exactly the case where the two differ -
 * which is the one case where it matters.
 */

function asTauri(on: boolean) {
  if (on) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  else delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  asTauri(false);
});

describe("readAppVersion", () => {
  it("asks the running binary when the desktop shell is present", async () => {
    asTauri(true);
    invokeMock.mockResolvedValueOnce("1.2.3");

    expect(await readAppVersion()).toEqual({ version: "1.2.3", source: "binary" });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("get_app_version");
  });

  it("reports the binary's version even when it disagrees with the build's", async () => {
    // The whole point. A mismatch is a release defect, and the surface that
    // would expose it must not paper over it by preferring the build constant.
    asTauri(true);
    invokeMock.mockResolvedValueOnce("9.9.9");

    const v = await readAppVersion();
    expect(v.version).toBe("9.9.9");
    expect(v.version).not.toBe(BUILD_VERSION);
    expect(v.source).toBe("binary");
  });

  it("does not attempt IPC in a plain browser, and says the number is a build number", async () => {
    asTauri(false);

    expect(await readAppVersion()).toEqual({ version: BUILD_VERSION, source: "build" });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("falls back rather than leaving the surface blank when the command fails", async () => {
    asTauri(true);
    invokeMock.mockRejectedValueOnce(new Error("command not found"));

    expect(await readAppVersion()).toEqual({ version: BUILD_VERSION, source: "build" });
  });

  it("treats an empty answer as no answer", async () => {
    asTauri(true);
    invokeMock.mockResolvedValueOnce("");

    expect(await readAppVersion()).toEqual({ version: BUILD_VERSION, source: "build" });
  });

  it("was given a real build version by the bundler, not the 'unknown' fallback", () => {
    // If this fails, `define: { __APP_VERSION__ }` was dropped from
    // vite.config.ts and the web build would show "unknown" to every visitor.
    expect(BUILD_VERSION).toMatch(/^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/);
  });
});
