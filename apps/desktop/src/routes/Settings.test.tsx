// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { Settings } from "./Settings.js";
import { BUILD_VERSION } from "../persistence/appVersion.js";

const invokeMock = vi.mocked(invoke);

/**
 * The Settings surface that reports which version is running (D16).
 *
 * `get_app_version` existed in the Rust shell from early on and nothing in the
 * frontend ever called it, so the number was unreachable from the product. D16
 * requires the running version to be visible, because that is the number a
 * support conversation and an update decision both start from.
 */

function asTauri(on: boolean) {
  if (on) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  else delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  cleanup();
  asTauri(false);
});

describe("Settings: which version is running", () => {
  it("shows the binary's version on the desktop, with no build-only caveat", async () => {
    asTauri(true);
    invokeMock.mockResolvedValueOnce("1.4.2");

    render(<Settings />);

    expect(await screen.findByText("1.4.2")).toBeTruthy();
    expect(screen.queryByText(/no desktop shell is running/)).toBeNull();
  });

  it("labels the number as a frontend build when no desktop shell is running", async () => {
    asTauri(false);

    render(<Settings />);

    expect(await screen.findByText(BUILD_VERSION)).toBeTruthy();
    expect(screen.getByText(/no desktop shell is running/)).toBeTruthy();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("renders the rest of Settings unchanged while the version is still resolving", () => {
    asTauri(true);
    invokeMock.mockReturnValueOnce(new Promise(() => {}));

    render(<Settings />);

    // A pending version read must not block or blank the surfaces that were
    // here before it: the profile form and the plan card still render.
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(screen.getByText(/Free \(local\)/)).toBeTruthy();
    expect(screen.getByTestId("app-version").textContent).toBe("checking...");
  });
});
