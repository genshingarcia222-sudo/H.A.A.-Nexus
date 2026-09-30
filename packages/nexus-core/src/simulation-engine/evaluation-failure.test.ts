import { describe, expect, it } from "vitest";
import {
  InvalidSessionTransitionError,
  completeSession,
  evaluationSucceeded,
  failEvaluation,
  mayAccessReferenceMaterial,
  mayRevealPerformance,
  pauseSession,
  startSession
} from "./session-machine.js";

/**
 * D9 — what happens when evaluation itself fails.
 *
 * `evaluation_failed` had existed in `SessionStatus`, and in the SQLite status
 * constraint, since Phase 5, and nothing ever produced it. D9 is what produces
 * it: an attempt that is finished, whose work is saved, and which has no result
 * yet.
 *
 * The rule these tests hold is that a failure and a retry cost the learner
 * nothing. Nothing about the attempt's time may change between the submission
 * and the retry, because `activeMs` feeds `timeEfficiency` and therefore the
 * score.
 */

const PARAMS = { id: "s1", scenarioId: "SCRIBE-FM-014", scenarioVersion: "1.0", mode: "practice" as const };

function submitted(mode: "practice" | "simulation" | "assessment" = "practice") {
  return completeSession(startSession({ ...PARAMS, mode }, 0), 300_000);
}

describe("failEvaluation", () => {
  it("records the failure without touching a single timing", () => {
    const attempt = submitted();
    const failed = failEvaluation(attempt);

    expect(failed.status).toBe("evaluation_failed");
    expect(failed.activeMs).toBe(attempt.activeMs);
    expect(failed.pausedMs).toBe(attempt.pausedMs);
    expect(failed.completedAt).toBe(attempt.completedAt);
    expect(failed.startedAt).toBe(attempt.startedAt);
  });

  it("is idempotent, so a second failure does not re-time the attempt", () => {
    const once = failEvaluation(submitted());
    expect(failEvaluation(once)).toEqual(once);
  });

  it("refuses to fail an attempt that was never submitted", () => {
    expect(() => failEvaluation(startSession(PARAMS, 0))).toThrow(InvalidSessionTransitionError);
    expect(() => failEvaluation(pauseSession(startSession(PARAMS, 0), 1000))).toThrow(
      InvalidSessionTransitionError
    );
  });
});

describe("evaluationSucceeded", () => {
  it("completes the attempt on the time it originally took", () => {
    const attempt = submitted();
    const recovered = evaluationSucceeded(failEvaluation(attempt));

    expect(recovered.status).toBe("completed");
    // The point of a separate transition. completeSession would fold another
    // interval of elapsed time into an attempt that already finished, so a
    // learner who retried an hour later would be scored as having taken an
    // hour longer.
    expect(recovered.activeMs).toBe(300_000);
    expect(recovered.completedAt).toBe(attempt.completedAt);
  });

  it("refuses an attempt that is still being worked on", () => {
    expect(() => evaluationSucceeded(startSession(PARAMS, 0))).toThrow(InvalidSessionTransitionError);
  });
});

describe("a failed evaluation reveals nothing and reopens nothing", () => {
  it("keeps an assessment's live-feedback boundary closed", () => {
    // D2: nothing performance-derived until the attempt is completed. An
    // attempt with no result is not a completed one, and must not be treated
    // as one just because the learner pressed Submit.
    const failed = failEvaluation(submitted("assessment"));
    expect(mayRevealPerformance(failed)).toBe(false);
  });

  it("keeps an assessment closed-book until it is actually scored", () => {
    // D4 reopens the books on submission. A failed evaluation is not a
    // submission that produced a result, and an open reference surface plus a
    // retryable attempt is a way to look things up and score again.
    const failed = failEvaluation(submitted("assessment"));
    expect(mayAccessReferenceMaterial(failed)).toBe(false);
    expect(mayAccessReferenceMaterial(evaluationSucceeded(failed))).toBe(true);
  });

  it("imposes neither restriction on practice, which never had them", () => {
    const failed = failEvaluation(submitted("practice"));
    expect(mayRevealPerformance(failed)).toBe(true);
    expect(mayAccessReferenceMaterial(failed)).toBe(true);
  });
});
