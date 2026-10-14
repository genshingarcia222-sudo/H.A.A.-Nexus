import { describe, expect, it } from "vitest";
import {
  completeSession,
  failEvaluation,
  mayAccessReferenceMaterial,
  mayAccessReferenceMaterialAcrossRestart,
  startSession,
  unresolvedStoredAssessment,
  type StoredAttempt
} from "./session-machine.js";
import type { SessionStatus, SimulationMode, SimulationSession } from "./types.js";

/**
 * Decision D17 — does the closed-book window survive a restart?
 *
 * Answered 2026-10-14 under the owner's explicit delegation: **it does**.
 * Reference material stays closed until the learner submits or discards the
 * interrupted attempt. Restarting the application is not a way to open the
 * book, and neither is starting something else.
 *
 * The defect this pins was measured during the characterisation, not imagined:
 * `useSessionStore` carries no persist middleware, so after a restart the live
 * session is `null`, `mayAccessReferenceMaterial(null)` answers `true`, and
 * both `/knowledge-base` and `/training` open while an interrupted assessment
 * still sits in SQLite with `status: in_progress`.
 *
 * These tests are the regression coverage for the policy. The D4 rule's own
 * tests in `closed-book.test.ts` are untouched — including the arity pin on
 * `mayAccessReferenceMaterial`, which is why this is a second function rather
 * than a third parameter.
 */

function sessionOf(mode: SimulationMode, status: SessionStatus): SimulationSession {
  const base = startSession(
    { id: `${mode}-${status}`, scenarioId: "SCRIBE-TEST-001", scenarioVersion: "1.0", mode },
    1000
  );
  if (status === "in_progress") return base;
  if (status === "completed") return completeSession(base, 3000);
  return { ...base, status };
}

const stored = (id: string, mode: SimulationMode, status: SessionStatus): StoredAttempt => ({
  id,
  mode,
  status
});

describe("D17: which stored attempts count as unresolved", () => {
  it("finds an interrupted assessment left in persistence", () => {
    const found = unresolvedStoredAssessment([stored("a1", "assessment", "in_progress")], null);
    expect(found?.id).toBe("a1");
  });

  it("treats paused and interrupted as unresolved too", () => {
    for (const status of ["in_progress", "paused", "interrupted"] as SessionStatus[]) {
      expect(
        unresolvedStoredAssessment([stored("a1", "assessment", status)], null),
        status
      ).not.toBeNull();
    }
  });

  it("treats a submitted, discarded or never-started attempt as resolved", () => {
    // Each of these is a learner who finished or walked away. The window is
    // about work still in front of them.
    for (const status of [
      "completed",
      "retried",
      "abandoned",
      "not_started"
    ] as SessionStatus[]) {
      expect(
        unresolvedStoredAssessment([stored("a1", "assessment", status)], null),
        status
      ).toBeNull();
    }
  });

  it("treats a failed evaluation as resolved, because D9 makes it a failed save", () => {
    // The learner finished writing; the scoring step failed. Holding the book
    // shut for a defect on our side would punish them for our bug.
    expect(
      unresolvedStoredAssessment([stored("a1", "assessment", "evaluation_failed")], null)
    ).toBeNull();
  });

  it("ignores interrupted practice and simulation attempts", () => {
    // D4 restricts assessment. An interrupted practice attempt has never
    // closed the book and must not start now.
    for (const mode of ["practice", "simulation"] as SimulationMode[]) {
      expect(
        unresolvedStoredAssessment([stored("p1", mode, "in_progress")], null),
        mode
      ).toBeNull();
    }
  });

  it("excludes the live session, so a live assessment is not its own interruption", () => {
    // A live assessment autosaves into exactly `in_progress`. Without the
    // exclusion the attempt on screen would count as an interrupted one — the
    // same defect the Dashboard's interrupted card hit under D8.
    const live = sessionOf("assessment", "in_progress");
    expect(unresolvedStoredAssessment([stored(live.id, "assessment", "in_progress")], live.id)).toBeNull();
  });

  it("still finds a different unresolved assessment while one is live", () => {
    const live = sessionOf("assessment", "in_progress");
    const found = unresolvedStoredAssessment(
      [stored(live.id, "assessment", "in_progress"), stored("older", "assessment", "in_progress")],
      live.id
    );
    expect(found?.id).toBe("older");
  });

  it("returns null for an empty store", () => {
    expect(unresolvedStoredAssessment([], null)).toBeNull();
  });
});

describe("D17: reference access across a restart", () => {
  it("THE DEFECT: an interrupted assessment keeps the book shut with no live session", () => {
    // Before D17 this was `true`: no live session meant no restriction, and a
    // restart reopened the Knowledge Base mid-assessment.
    const persisted = [stored("a1", "assessment", "in_progress")];
    expect(mayAccessReferenceMaterial(null)).toBe(true);
    expect(mayAccessReferenceMaterialAcrossRestart(null, persisted)).toBe(false);
  });

  it("opens normally when persistence holds nothing unresolved", () => {
    expect(mayAccessReferenceMaterialAcrossRestart(null, [])).toBe(true);
    expect(
      mayAccessReferenceMaterialAcrossRestart(null, [stored("a1", "assessment", "completed")])
    ).toBe(true);
  });

  it("does not let a practice attempt reopen the book while an assessment is unresolved", () => {
    // Otherwise "start a practice attempt" is a one-click bypass of D4, which
    // is the class of hole D4 exists to forbid.
    const practice = sessionOf("practice", "in_progress");
    expect(mayAccessReferenceMaterial(practice)).toBe(true);
    expect(
      mayAccessReferenceMaterialAcrossRestart(practice, [stored("a1", "assessment", "in_progress")])
    ).toBe(false);
  });

  it("reopens once the interrupted attempt is discarded", () => {
    expect(
      mayAccessReferenceMaterialAcrossRestart(null, [stored("a1", "assessment", "abandoned")])
    ).toBe(true);
  });

  it("reopens once the interrupted attempt is submitted", () => {
    expect(
      mayAccessReferenceMaterialAcrossRestart(null, [stored("a1", "assessment", "completed")])
    ).toBe(true);
  });

  it("keeps D4 intact: a live assessment is closed whatever persistence says", () => {
    const live = sessionOf("assessment", "in_progress");
    expect(
      mayAccessReferenceMaterialAcrossRestart(live, [stored(live.id, "assessment", "in_progress")])
    ).toBe(false);
    expect(mayAccessReferenceMaterialAcrossRestart(live, [])).toBe(false);
  });

  it("keeps D3 intact: a completed assessment still opens the book", () => {
    // The post-submission comparison is explicitly authorised and is not
    // reference access "during" the attempt.
    const done = sessionOf("assessment", "completed");
    expect(
      mayAccessReferenceMaterialAcrossRestart(done, [stored(done.id, "assessment", "completed")])
    ).toBe(true);
  });

  it("holds for an assessment whose evaluation failed, per D9", () => {
    const failed = failEvaluation(sessionOf("assessment", "completed"));
    expect(
      mayAccessReferenceMaterialAcrossRestart(failed, [
        stored(failed.id, "assessment", "evaluation_failed")
      ])
    ).toBe(false);
  });

  it("agrees with the live-only rule whenever persistence is empty", () => {
    // The new rule must not change any answer the old one already gave for the
    // cases the old one could see.
    const cases: (SimulationSession | null)[] = [
      null,
      sessionOf("practice", "in_progress"),
      sessionOf("simulation", "in_progress"),
      sessionOf("assessment", "in_progress"),
      sessionOf("assessment", "completed")
    ];
    for (const session of cases) {
      expect(
        mayAccessReferenceMaterialAcrossRestart(session, []),
        session ? `${session.mode}/${session.status}` : "null"
      ).toBe(mayAccessReferenceMaterial(session));
    }
  });
});
