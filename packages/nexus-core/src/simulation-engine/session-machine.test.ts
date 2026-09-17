import { describe, expect, it } from "vitest";
import {
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  interruptSession,
  computeLiveActiveMs,
  InvalidSessionTransitionError,
  PauseNotAllowedError,
  LiveFeedbackNotAllowedError,
  mayRevealPerformance,
  assertMayRevealPerformance
} from "./session-machine.js";
import { modeAllowsPause, type SessionStatus, type SimulationMode } from "./types.js";

const PARAMS = { id: "s1", scenarioId: "SCRIBE-FM-014", scenarioVersion: "1.0", mode: "practice" as const };

describe("startSession", () => {
  it("starts in_progress with zeroed timers", () => {
    const session = startSession(PARAMS, 1000);
    expect(session.status).toBe("in_progress");
    expect(session.startedAt).toBe(1000);
    expect(session.activeMs).toBe(0);
    expect(session.pausedMs).toBe(0);
    expect(session.flags).toEqual([]);
  });
});

describe("pauseSession / resumeSession", () => {
  it("accumulates active time on pause, then paused time on resume", () => {
    let session = startSession(PARAMS, 0);
    session = pauseSession(session, 5000); // 5s active
    expect(session.status).toBe("paused");
    expect(session.activeMs).toBe(5000);

    session = resumeSession(session, 8000); // 3s paused
    expect(session.status).toBe("in_progress");
    expect(session.pausedMs).toBe(3000);
  });

  it("supports multiple pause/resume cycles, accumulating correctly", () => {
    let session = startSession(PARAMS, 0);
    session = pauseSession(session, 1000); // +1000 active
    session = resumeSession(session, 2000); // +1000 paused
    session = pauseSession(session, 5000); // +3000 active
    expect(session.activeMs).toBe(4000);
    expect(session.pausedMs).toBe(1000);
  });

  it("refuses to pause a session that isn't in_progress", () => {
    const session = startSession(PARAMS, 0);
    const paused = pauseSession(session, 100);
    expect(() => pauseSession(paused, 200)).toThrow(InvalidSessionTransitionError);
  });

  it("refuses to resume a session that isn't paused", () => {
    const session = startSession(PARAMS, 0);
    expect(() => resumeSession(session, 100)).toThrow(InvalidSessionTransitionError);
  });
});

describe("completeSession", () => {
  it("finalizes active time when completed while in_progress", () => {
    let session = startSession(PARAMS, 0);
    session = completeSession(session, 10000);
    expect(session.status).toBe("completed");
    expect(session.activeMs).toBe(10000);
    expect(session.completedAt).toBe(10000);
  });

  it("finalizes paused time (not active time) when completed while paused", () => {
    let session = startSession(PARAMS, 0);
    session = pauseSession(session, 4000); // 4000 active
    session = completeSession(session, 6000); // +2000 paused, active unchanged
    expect(session.activeMs).toBe(4000);
    expect(session.pausedMs).toBe(2000);
  });

  it("refuses to complete an already-completed session", () => {
    let session = startSession(PARAMS, 0);
    session = completeSession(session, 1000);
    expect(() => completeSession(session, 2000)).toThrow(InvalidSessionTransitionError);
  });
});

describe("abandonSession / interruptSession", () => {
  it("abandons from in_progress or paused", () => {
    const session = startSession(PARAMS, 0);
    expect(abandonSession(session).status).toBe("abandoned");
  });

  it("refuses to interrupt a session that's already completed", () => {
    let session = startSession(PARAMS, 0);
    session = completeSession(session, 1000);
    expect(() => interruptSession(session)).toThrow(InvalidSessionTransitionError);
  });
});

describe("computeLiveActiveMs", () => {
  it("adds time-since-last-transition when still in_progress", () => {
    const session = startSession(PARAMS, 0);
    expect(computeLiveActiveMs(session, 7000)).toBe(7000);
  });

  it("returns the frozen activeMs once paused", () => {
    let session = startSession(PARAMS, 0);
    session = pauseSession(session, 5000);
    // even if "now" advances further, paused time doesn't count as active
    expect(computeLiveActiveMs(session, 9000)).toBe(5000);
  });
});

describe("assessment mode (Phase 8.3) - no pause, no resume", () => {
  const ASSESSMENT = { ...PARAMS, mode: "assessment" as const };

  it("allows pausing only outside assessment mode", () => {
    const cases: [SimulationMode, boolean][] = [
      ["practice", true],
      ["simulation", true],
      ["assessment", false]
    ];
    for (const [mode, allowed] of cases) {
      expect(modeAllowsPause(mode), mode).toBe(allowed);
    }
  });

  it("starts an assessment session normally", () => {
    const session = startSession(ASSESSMENT, 1000);
    expect(session.mode).toBe("assessment");
    expect(session.status).toBe("in_progress");
  });

  it("refuses to pause an in-progress assessment session", () => {
    const session = startSession(ASSESSMENT, 1000);
    expect(() => pauseSession(session, 2000)).toThrow(PauseNotAllowedError);
  });

  it("refuses to resume an assessment session, even one already marked paused", () => {
    // A paused assessment session cannot be produced through the machine,
    // but persisted data could still carry one. Resuming it must not be a
    // way around the rule.
    const paused = { ...startSession(ASSESSMENT, 1000), status: "paused" as const };
    expect(() => resumeSession(paused, 2000)).toThrow(PauseNotAllowedError);
  });

  it("checks the mode before the status, so the mode rule cannot be masked", () => {
    const completed = completeSession(startSession(ASSESSMENT, 1000), 2000);
    expect(() => pauseSession(completed, 3000)).toThrow(PauseNotAllowedError);
  });

  it("leaves the session untouched when a pause is refused", () => {
    const session = startSession(ASSESSMENT, 1000);
    const snapshot = structuredClone(session);
    expect(() => pauseSession(session, 5000)).toThrow();
    expect(session).toEqual(snapshot);
  });

  it("still completes, abandons and interrupts like any other session", () => {
    const session = startSession(ASSESSMENT, 1000);
    const completed = completeSession(session, 61_000);
    expect(completed.status).toBe("completed");
    expect(completed.activeMs).toBe(60_000);
    expect(completed.pausedMs).toBe(0);
    expect(abandonSession(session).status).toBe("abandoned");
    expect(interruptSession(session).status).toBe("interrupted");
  });

  it("does not change pause behaviour for practice or simulation", () => {
    for (const mode of ["practice", "simulation"] as const) {
      const paused = pauseSession(startSession({ ...PARAMS, mode }, 1000), 2000);
      expect(paused.status).toBe("paused");
      expect(resumeSession(paused, 3000).status).toBe("in_progress");
    }
  });
});

describe("assessment live-feedback boundary (Phase 8.3)", () => {
  const ALL_STATUSES: SessionStatus[] = [
    "not_started",
    "in_progress",
    "paused",
    "completed",
    "interrupted",
    "abandoned",
    "evaluation_failed",
    "retried"
  ];
  const sessionIn = (mode: SimulationMode, status: SessionStatus) => ({
    ...startSession({ ...PARAMS, mode }, 1000),
    status
  });

  it("reveals assessment performance only once the attempt is completed", () => {
    for (const status of ALL_STATUSES) {
      expect(mayRevealPerformance(sessionIn("assessment", status)), status).toBe(status === "completed");
    }
  });

  it("keeps an interrupted or abandoned assessment closed, since neither submits the attempt", () => {
    expect(mayRevealPerformance(sessionIn("assessment", "interrupted"))).toBe(false);
    expect(mayRevealPerformance(sessionIn("assessment", "abandoned"))).toBe(false);
  });

  it("imposes no restriction on practice or simulation, for which none is authorized", () => {
    for (const mode of ["practice", "simulation"] as const) {
      for (const status of ALL_STATUSES) {
        expect(mayRevealPerformance(sessionIn(mode, status)), `${mode}/${status}`).toBe(true);
      }
    }
  });

  it("throws LiveFeedbackNotAllowedError for an active assessment and names what was withheld", () => {
    const active = startSession({ ...PARAMS, mode: "assessment" }, 1000);
    expect(() => assertMayRevealPerformance(active, "an evaluation")).toThrow(LiveFeedbackNotAllowedError);
    expect(() => assertMayRevealPerformance(active, "an evaluation")).toThrow(/an evaluation/);
  });

  it("allows the reveal once the assessment has been completed through the session machine", () => {
    const completed = completeSession(startSession({ ...PARAMS, mode: "assessment" }, 1000), 5000);
    expect(() => assertMayRevealPerformance(completed, "an evaluation")).not.toThrow();
  });
});
