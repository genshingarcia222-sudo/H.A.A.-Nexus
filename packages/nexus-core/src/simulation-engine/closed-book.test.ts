import { describe, expect, it } from "vitest";
import {
  ClosedBookViolationError,
  assertMayAccessReferenceMaterial,
  completeSession,
  mayAccessReferenceMaterial,
  pauseSession,
  startSession
} from "./session-machine.js";
import type { SessionStatus, SimulationMode, SimulationSession } from "./types.js";

/**
 * Decision D4 — Assessment runs closed-book.
 *
 * Owner-selected 2026-09-20: the Knowledge Base and Training are unavailable
 * while an assessment attempt is active, for every tier. D1 decides who may
 * enter an assessment; D4 decides the conditions inside it. The two are
 * independent, which is why this rule reads the *session*, never a tier.
 *
 * The rule lives here, in the domain, for the same reason the D2 boundary
 * does: a UI that has to remember to ask is a UI that will eventually forget.
 */

function sessionOf(mode: SimulationMode, status: SessionStatus): SimulationSession {
  const base = startSession(
    { id: `${mode}-${status}`, scenarioId: "SCRIBE-TEST-001", scenarioVersion: "1.0", mode },
    1000
  );
  if (status === "in_progress") return base;
  if (status === "completed") return completeSession(base, 3000);
  // An assessment cannot be paused - the machine throws - so the status is set
  // directly here, to prove the rule holds against a state however it arose.
  if (status === "paused" && mode !== "assessment") return pauseSession(base, 2000);
  return { ...base, status };
}

const ALL_STATUSES: SessionStatus[] = ["in_progress", "paused", "completed", "interrupted", "abandoned"];

describe("D4: reference access during an assessment", () => {
  it("is allowed when no attempt is in progress at all", () => {
    // The ordinary state of the app. D4 restricts an active attempt, not the
    // product.
    expect(mayAccessReferenceMaterial(null)).toBe(true);
  });

  for (const status of ALL_STATUSES) {
    it(`is blocked for an assessment that is ${status}`, () => {
      const allowed = mayAccessReferenceMaterial(sessionOf("assessment", status));
      // Only a submitted attempt reopens the books - that is the D3 boundary,
      // and it is the single exception.
      expect(allowed).toBe(status === "completed");
    });
  }

  for (const mode of ["practice", "simulation"] as const) {
    it(`leaves ${mode} unrestricted in every status, because no restriction is authorized for it`, () => {
      for (const status of ALL_STATUSES) {
        expect(mayAccessReferenceMaterial(sessionOf(mode, status)), `${mode}/${status}`).toBe(true);
      }
    });
  }

  it("reads the session, never a tier: D4 is not tier-differentiated", () => {
    // There is no tier argument to pass. A Pro assessment and a Fast-Track
    // assessment are the same session shape, so they cannot diverge here.
    expect(mayAccessReferenceMaterial.length).toBe(1);
    expect(mayAccessReferenceMaterial(sessionOf("assessment", "in_progress"))).toBe(false);
  });

  it("does not mutate the session it reads", () => {
    const session = sessionOf("assessment", "in_progress");
    const snapshot = JSON.stringify(session);
    mayAccessReferenceMaterial(session);
    expect(JSON.stringify(session)).toBe(snapshot);
  });
});

describe("D4: the assert form", () => {
  it("throws for an active assessment, naming what was refused", () => {
    expect(() => assertMayAccessReferenceMaterial(sessionOf("assessment", "in_progress"), "the Knowledge Base")).toThrow(
      ClosedBookViolationError
    );
    expect(() =>
      assertMayAccessReferenceMaterial(sessionOf("assessment", "in_progress"), "the Knowledge Base")
    ).toThrow(/Knowledge Base/);
  });

  it("stays silent once the assessment is submitted, and for other modes", () => {
    expect(() => assertMayAccessReferenceMaterial(sessionOf("assessment", "completed"), "Training")).not.toThrow();
    expect(() => assertMayAccessReferenceMaterial(sessionOf("practice", "in_progress"), "Training")).not.toThrow();
    expect(() => assertMayAccessReferenceMaterial(null, "Training")).not.toThrow();
  });
});
