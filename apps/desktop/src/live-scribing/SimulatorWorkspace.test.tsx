// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InMemorySessionRepository, NO_SUBSCRIPTION, type SimulationMode } from "@haa-nexus/nexus-core";
import { SimulatorWorkspace } from "./SimulatorWorkspace.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Phase 8.3: the workspace under assessment conditions. Assessment sessions
 * are not yet reachable from any learner-facing entry point, so these tests
 * start one directly through the store.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

function startIn(mode: SimulationMode) {
  expect(useSessionStore.getState().start(SCENARIO, mode)).toBe(true);
  render(<SimulatorWorkspace />);
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
});

describe("SimulatorWorkspace - assessment mode (Phase 8.3)", () => {
  it("offers no Pause button in assessment mode", () => {
    startIn("assessment");
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
  });

  it("labels the session as Assessment", () => {
    startIn("assessment");
    expect(screen.getByText(/· Assessment$/)).toBeTruthy();
  });

  it("still lets the learner reveal the transcript progressively", () => {
    // Assessment reveals one beat at a time, like simulation. Without a
    // Continue button the learner would be stuck on the first beat.
    startIn("assessment");
    const before = useSessionStore.getState().revealedCount;
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(useSessionStore.getState().revealedCount).toBe(before + 1);
  });

  it("ignores a pause request at the store without throwing or changing status", () => {
    useSessionStore.getState().start(SCENARIO, "assessment");
    expect(() => useSessionStore.getState().pause()).not.toThrow();
    expect(useSessionStore.getState().session?.status).toBe("in_progress");
  });

  it("keeps Pause available and working in simulation and practice", () => {
    for (const mode of ["simulation", "practice"] as const) {
      startIn(mode);
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      expect(useSessionStore.getState().session?.status).toBe("paused");
      expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
      cleanup();
      useSessionStore.getState().reset();
    }
  });

  it("does not offer Continue in practice mode, where the full transcript is already shown", () => {
    startIn("practice");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });
});
