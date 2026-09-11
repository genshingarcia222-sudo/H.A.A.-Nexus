import { describe, expect, it } from "vitest";
import {
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  interruptSession,
  computeLiveActiveMs,
  InvalidSessionTransitionError
} from "./session-machine.js";

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
