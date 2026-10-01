import { describe, expect, it } from "vitest";
import {
  completeSession,
  interruptSession,
  mayContinueFromDraft,
  pauseSession,
  sessionTimesAt,
  startSession
} from "./session-machine.js";
import type { SimulationMode } from "./types.js";

/**
 * D8 — what an interrupted practice or simulation attempt may become.
 *
 * The decision: an interrupted attempt is **never resumed in place**. The
 * learner may carry their draft into a *new* attempt, and the time that was
 * actually measured on that draft travels with it. Nothing reconstructs the
 * gap while the application was closed, because nothing measured it.
 *
 * These tests own the two halves that make that safe: the time a continued
 * attempt starts from, and the fact that Assessment is excluded (D6).
 */

const PARAMS = { id: "s1", scenarioId: "SCRIBE-FM-014", scenarioVersion: "1.0", mode: "practice" as const };
const ALL_MODES: SimulationMode[] = ["practice", "simulation", "assessment"];

describe("carrying measured time into a continued attempt", () => {
  it("starts the new attempt's clock at the time already spent", () => {
    const session = startSession({ ...PARAMS, carriedActiveMs: 90_000 }, 5000);
    expect(session.activeMs).toBe(90_000);
    // Everything else is genuinely new: a new attempt, not a restored one.
    expect(session.startedAt).toBe(5000);
    expect(session.pausedMs).toBe(0);
    expect(session.completedAt).toBeNull();
    expect(session.flags).toEqual([]);
    expect(session.status).toBe("in_progress");
  });

  it("scores a continued attempt on both sittings, not just the second", () => {
    // The objection this answers: carry the work but not the time, and a
    // learner can write the whole note, restart, and submit in seconds on a
    // fresh clock - which timeEfficiency would reward.
    const first = completeSession(startSession({ ...PARAMS, carriedActiveMs: 120_000 }, 0), 30_000);
    expect(first.activeMs).toBe(150_000);
  });

  it("omits a carried figure entirely and the attempt starts at zero", () => {
    expect(startSession(PARAMS, 1000).activeMs).toBe(0);
    expect(startSession({ ...PARAMS, carriedActiveMs: undefined }, 1000).activeMs).toBe(0);
  });

  it("refuses to let a bad persisted figure reach the score", () => {
    // These arrive from a stored record, not from code, so they are clamped
    // rather than trusted. A negative value would *raise* timeEfficiency.
    for (const bad of [-1, -90_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(startSession({ ...PARAMS, carriedActiveMs: bad }, 1000).activeMs, String(bad)).toBe(0);
    }
    expect(startSession({ ...PARAMS, carriedActiveMs: 1500.7 }, 1000).activeMs).toBe(1500);
  });

  it("does not leak the carried figure into the session object as a field", () => {
    const session = startSession({ ...PARAMS, carriedActiveMs: 42 }, 1000);
    expect("carriedActiveMs" in session).toBe(false);
  });
});

describe("mayContinueFromDraft", () => {
  it("allows practice and simulation, and refuses assessment", () => {
    expect(mayContinueFromDraft("practice")).toBe(true);
    expect(mayContinueFromDraft("simulation")).toBe(true);
    // D6, owner-decided: an interrupted Assessment is retaken from the
    // beginning. Carrying the draft forward would be a resume in all but name.
    expect(mayContinueFromDraft("assessment")).toBe(false);
  });

  it("covers every mode the type admits, so a new mode cannot arrive unanswered", () => {
    for (const mode of ALL_MODES) {
      expect(typeof mayContinueFromDraft(mode), mode).toBe("boolean");
    }
  });
});

describe("sessionTimesAt", () => {
  it("counts the time since the last transition for an attempt still running", () => {
    const session = startSession(PARAMS, 1000);
    expect(session.activeMs).toBe(0);
    expect(sessionTimesAt(session, 61_000)).toEqual({ activeMs: 60_000, pausedMs: 0 });
  });

  it("is what makes an autosaved record's clock true rather than zero", () => {
    // Before D8 the record copied session.activeMs, which only advances at a
    // transition - so an attempt that had never been paused autosaved as
    // "0 ms of work" no matter how long the learner had been writing.
    const running = startSession(PARAMS, 0);
    expect(running.activeMs).toBe(0);
    expect(sessionTimesAt(running, 15 * 60_000).activeMs).toBe(15 * 60_000);
  });

  it("counts time in the paused bucket while paused", () => {
    const paused = pauseSession(startSession(PARAMS, 0), 10_000);
    expect(sessionTimesAt(paused, 25_000)).toEqual({ activeMs: 10_000, pausedMs: 15_000 });
  });

  it("returns a completed attempt's stored figures, so the final interval is never counted twice", () => {
    const completed = completeSession(startSession(PARAMS, 0), 30_000);
    expect(completed.activeMs).toBe(30_000);
    expect(sessionTimesAt(completed, 90_000)).toEqual({ activeMs: 30_000, pausedMs: 0 });
  });

  it("freezes an interrupted attempt's clock at the last autosave, not at discovery", () => {
    // An interruption is a crash: nothing measured the moment it happened, and
    // the app may be reopened days later. The last measured figure is the only
    // honest one, and it is what a continued attempt carries.
    const running = startSession(PARAMS, 0);
    const lastAutosave = sessionTimesAt(running, 120_000);
    const interrupted = { ...interruptSession(running), activeMs: lastAutosave.activeMs };
    const daysLater = 3 * 24 * 60 * 60_000;
    expect(sessionTimesAt(interrupted, daysLater)).toEqual({ activeMs: 120_000, pausedMs: 0 });
  });
});
