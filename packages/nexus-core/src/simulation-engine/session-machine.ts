import { modeAllowsPause, type SessionStatus, type SimulationMode, type SimulationSession } from "./types.js";

export class InvalidSessionTransitionError extends Error {
  constructor(from: SessionStatus, action: string) {
    super(`Cannot ${action} a session in status "${from}".`);
    this.name = "InvalidSessionTransitionError";
  }
}

/** Thrown when a pause or resume is attempted in a mode that forbids it (assessment). */
export class PauseNotAllowedError extends Error {
  constructor(mode: SimulationMode, action: string) {
    super(`Cannot ${action} a session in "${mode}" mode: it runs under exam conditions.`);
    this.name = "PauseNotAllowedError";
  }
}

function assertPausable(session: SimulationSession, action: string): void {
  if (!modeAllowsPause(session.mode)) {
    throw new PauseNotAllowedError(session.mode, action);
  }
}

/**
 * Thrown when performance information (an evaluation, score, feedback or
 * recommendation derived from the attempt) would be revealed for an
 * assessment session that is still active.
 */
export class LiveFeedbackNotAllowedError extends Error {
  constructor(status: SessionStatus, what: string) {
    super(`Cannot reveal ${what} for an assessment session in status "${status}": it runs under exam conditions.`);
    this.name = "LiveFeedbackNotAllowedError";
  }
}

/**
 * Whether information about this attempt's performance may be revealed yet.
 *
 * Business Model Spec Section 10 requires Assessment to hide "live feedback
 * that would compromise exam simulation"; the session owner defined the
 * boundary as no information that reveals, confirms, grades, coaches or
 * materially signals the correctness or quality of ongoing performance.
 * For an assessment session that means nothing performance-derived until
 * the attempt is completed - including while it is interrupted or
 * abandoned, since neither ends the exam with a submitted attempt.
 *
 * Practice and simulation always return true. That is not a product rule
 * that they *should* show live feedback; it is the absence of any
 * authorized restriction for those modes, so none is imposed here.
 *
 * What an assessment learner sees *after* submitting is a separate, still
 * undecided product question (see docs/PHASE_8_3_ASSESSMENT_MODE.md, D3).
 */
export function mayRevealPerformance(session: SimulationSession): boolean {
  if (session.mode !== "assessment") return true;
  return session.status === "completed";
}

export function assertMayRevealPerformance(session: SimulationSession, what: string): void {
  if (!mayRevealPerformance(session)) {
    throw new LiveFeedbackNotAllowedError(session.status, what);
  }
}

/** Thrown when reference material is requested during an active assessment. */
export class ClosedBookViolationError extends Error {
  constructor(what: string) {
    super(`Cannot open ${what} during an active assessment: it runs closed-book.`);
    this.name = "ClosedBookViolationError";
  }
}

/**
 * Whether the learner may open reference material right now.
 *
 * Decision D4, owner-selected 2026-09-20: an Assessment runs **closed-book**.
 * The Knowledge Base and Training are unavailable while an assessment attempt
 * is active, for every tier that may start one - D1 decides who may enter an
 * assessment, D4 decides the conditions inside it, and the two are deliberately
 * independent. There is no tier that gets an open-book assessment.
 *
 * `null` means no attempt is in progress at all, which is the ordinary state of
 * the app and is unrestricted. Practice and simulation always return true: as
 * with {@link mayRevealPerformance}, that is the absence of any authorized
 * restriction for those modes, not a rule that they *should* be open-book.
 *
 * A completed assessment returns true, which is what keeps D3 intact - the
 * post-submission experience, including the expected-answer comparison, is
 * explicitly authorized and is not reference access "during" the attempt.
 *
 * The `completed` test rather than an "is it running" test also means the
 * interrupted and abandoned statuses stay on the restrictive side without this
 * function taking a position on them: what happens to an interrupted assessment
 * is D6, still undecided, and no live session ever reaches this function in
 * those states.
 */
export function mayAccessReferenceMaterial(session: SimulationSession | null): boolean {
  if (!session || session.mode !== "assessment") return true;
  return session.status === "completed";
}

export function assertMayAccessReferenceMaterial(session: SimulationSession | null, what: string): void {
  if (!mayAccessReferenceMaterial(session)) {
    throw new ClosedBookViolationError(what);
  }
}

/**
 * The shape of a stored attempt this rule needs. Declared structurally rather
 * than importing `SessionRecord`, so the simulation engine does not take a
 * dependency on the persistence layer to answer a question about policy.
 * `SessionRecord` satisfies it.
 */
export interface StoredAttempt {
  id: string;
  mode: SimulationMode;
  status: SessionStatus;
}

/**
 * The stored assessment attempt that is still unresolved, or null (D17).
 *
 * "Unresolved" means the record exists in persistence and has neither been
 * submitted nor discarded: `in_progress`, `paused` or `interrupted`. The other
 * statuses are resolved as far as the closed-book window is concerned -
 * `completed` and `retried` because the work was submitted, `abandoned` because
 * it was discarded, `not_started` because nothing was written, and
 * `evaluation_failed` because D9 treats a failed evaluation as a failed *save*
 * of work the learner has already finished writing, not as an attempt still in
 * front of them.
 *
 * `interrupted` is included although nothing currently writes it: no
 * transition is applied at crash time, because nothing measures when the crash
 * happened, so a killed attempt stays `in_progress`. The repository's
 * `findInterrupted` likewise returns only `in_progress` and `paused`. Accepting
 * `interrupted` here makes this rule stricter than the data it is fed rather
 * than dependent on that gap, so marking a record `interrupted` later cannot
 * silently reopen the book.
 *
 * `liveSessionId` is excluded deliberately. A live assessment autosaves into
 * exactly the `in_progress` state this function looks for, so without the
 * exclusion the attempt on screen would count as its own interruption. That is
 * the same defect the Dashboard's interrupted card hit (D8), found there by
 * walking the flow in a browser; it is cheaper to not repeat it.
 */
export function unresolvedStoredAssessment(
  stored: readonly StoredAttempt[],
  liveSessionId: string | null
): StoredAttempt | null {
  for (const attempt of stored) {
    if (attempt.id === liveSessionId) continue;
    if (attempt.mode !== "assessment") continue;
    if (attempt.status === "in_progress" || attempt.status === "paused" || attempt.status === "interrupted") {
      return attempt;
    }
  }
  return null;
}

/**
 * D17 - the closed-book window survives a restart.
 *
 * `mayAccessReferenceMaterial` above answers from the live session alone, and
 * after a restart there is no live session: the store carries no persist
 * middleware, so it answers `true` for `null` and the Knowledge Base and
 * Training reopen while an interrupted assessment still sits in SQLite. That
 * was measured during the D17 characterisation, and it is the hole this closes.
 *
 * **The policy, decided by the owner's delegation on 2026-10-14:** reference
 * material stays closed until the learner **submits or discards** the
 * interrupted attempt. Restarting the application is not a way to open the
 * book, and neither is starting something else.
 *
 * That last clause is why an unresolved stored assessment loses to nothing: a
 * live *practice* session does not reopen the book while an assessment is
 * unresolved. Allowing it would make "start a practice attempt" a one-click
 * bypass of D4, which is exactly the class of hole D4 forbids. The cost is that
 * a learner who abandons an assessment mid-way must say so before studying
 * again - which is the intended meaning of a closed-book assessment, not a side
 * effect.
 *
 * **This is enforced on the desktop and is inert on the web until D10.** The
 * web target falls back to in-memory repositories, so a refresh destroys the
 * record and leaves nothing to gate on. Recorded rather than hidden: the rule
 * is the same on both targets, and only one of them can currently supply the
 * evidence it needs.
 */
export function mayAccessReferenceMaterialAcrossRestart(
  session: SimulationSession | null,
  stored: readonly StoredAttempt[]
): boolean {
  return referenceBlockReason(session, stored) === null;
}

/**
 * Why reference material is closed, or null when it is open.
 *
 * The two reasons are different situations for the learner - "finish what is on
 * screen" versus "you left an attempt open and we cannot tell whether you meant
 * to" - so the UI needs to tell them apart. It lives here rather than in the
 * component because deciding *which* rule applies is the same kind of judgement
 * as deciding whether one applies, and `closedBookBoundary.test.tsx` enforces
 * that the app never re-implements either: a `mode === "assessment"` test in a
 * component fails that invariant, correctly.
 *
 * `live-attempt` is checked first, so D4 can answer from the session alone
 * without waiting on a persistence read.
 */
export function referenceBlockReason(
  session: SimulationSession | null,
  stored: readonly StoredAttempt[]
): "live-attempt" | "unresolved-stored-attempt" | null {
  if (!mayAccessReferenceMaterial(session)) return "live-attempt";
  if (unresolvedStoredAssessment(stored, session?.id ?? null)) return "unresolved-stored-attempt";
  return null;
}

function assertStatus(session: SimulationSession, allowed: SessionStatus[], action: string): void {
  if (!allowed.includes(session.status)) {
    throw new InvalidSessionTransitionError(session.status, action);
  }
}

export interface StartSessionParams {
  id: string;
  scenarioId: string;
  scenarioVersion: string;
  mode: SimulationMode;
  /**
   * Measured work time carried forward from an interrupted attempt (D8).
   *
   * An interrupted attempt is never resumed in place; the learner may carry
   * their draft into a **new** attempt, and this carries the time that was
   * actually measured on that draft along with it. Without it, a learner could
   * write a complete note, lose the app, continue from the draft and submit in
   * seconds on a clock that started at zero - and `timeEfficiency` feeds the
   * score. The gap while the app was closed is deliberately *not* included: it
   * is not work time, and nothing measured it.
   */
  carriedActiveMs?: number;
}

/**
 * Whether an interrupted attempt in this mode may be continued from its draft.
 *
 * Assessment: **no**. D6 (owner, 2026-09-20) says an interrupted Assessment is
 * retaken as a fresh attempt, and carrying the draft forward would be a resume
 * in all but name. Practice and simulation: **yes**, by D8.
 *
 * It lives here rather than in the Dashboard so that a second entry point
 * cannot be added later that forgets the Assessment case.
 */
export function mayContinueFromDraft(mode: SimulationMode): boolean {
  return mode !== "assessment";
}

export function startSession(params: StartSessionParams, now: number): SimulationSession {
  const { carriedActiveMs, ...identity } = params;
  return {
    ...identity,
    status: "in_progress",
    startedAt: now,
    // A carried figure is clamped rather than trusted: it arrives from a
    // persisted record, and a negative or fractional value would flow straight
    // into the score.
    activeMs: Number.isFinite(carriedActiveMs) ? Math.max(0, Math.trunc(carriedActiveMs as number)) : 0,
    pausedMs: 0,
    lastTransitionAt: now,
    completedAt: null,
    flags: []
  };
}

export function pauseSession(session: SimulationSession, now: number): SimulationSession {
  assertPausable(session, "pause");
  assertStatus(session, ["in_progress"], "pause");
  const elapsedSinceTransition = now - (session.lastTransitionAt ?? now);
  return {
    ...session,
    status: "paused",
    activeMs: session.activeMs + elapsedSinceTransition,
    lastTransitionAt: now
  };
}

export function resumeSession(session: SimulationSession, now: number): SimulationSession {
  assertPausable(session, "resume");
  assertStatus(session, ["paused"], "resume");
  const elapsedSinceTransition = now - (session.lastTransitionAt ?? now);
  return {
    ...session,
    status: "in_progress",
    pausedMs: session.pausedMs + elapsedSinceTransition,
    lastTransitionAt: now
  };
}

/**
 * Submitting documentation is allowed from either in_progress or paused —
 * a learner shouldn't be forced to resume just to submit what they have.
 */
export function completeSession(session: SimulationSession, now: number): SimulationSession {
  assertStatus(session, ["in_progress", "paused"], "complete");
  const elapsedSinceTransition = now - (session.lastTransitionAt ?? now);
  const isActive = session.status === "in_progress";
  return {
    ...session,
    status: "completed",
    activeMs: isActive ? session.activeMs + elapsedSinceTransition : session.activeMs,
    pausedMs: isActive ? session.pausedMs : session.pausedMs + elapsedSinceTransition,
    completedAt: now,
    lastTransitionAt: now
  };
}

/**
 * The attempt was completed but scoring it threw (D9).
 *
 * The timings are kept exactly as `completeSession` left them. A retry must be
 * scored on the time the learner actually took, not on the time it took them to
 * press a button again - so nothing here touches `activeMs`, `pausedMs` or
 * `completedAt`.
 *
 * `evaluation_failed` already existed in `SessionStatus` and in the SQLite
 * status constraint, and nothing produced it. D9 is what produces it.
 */
export function failEvaluation(session: SimulationSession): SimulationSession {
  assertStatus(session, ["completed", "evaluation_failed"], "record an evaluation failure for");
  return { ...session, status: "evaluation_failed" };
}

/**
 * Scoring succeeded on a retry (D9): the attempt is completed after all.
 *
 * Deliberately not `completeSession`, which would fold another interval of
 * elapsed time into an attempt that already finished.
 */
export function evaluationSucceeded(session: SimulationSession): SimulationSession {
  assertStatus(session, ["evaluation_failed", "completed"], "record a successful evaluation for");
  return { ...session, status: "completed" };
}

export function abandonSession(session: SimulationSession): SimulationSession {
  assertStatus(session, ["in_progress", "paused", "not_started"], "abandon");
  return { ...session, status: "abandoned" };
}

/**
 * Models an external interruption (crash / force quit). No `now`-based time
 * accounting here — by definition we don't know exactly when it happened.
 * Real interruption *detection* (session left in_progress across an app
 * restart) is Phase 5's job, once sessions are actually persisted; this
 * only models the resulting state so Phase 5 has a target to transition to.
 */
export function interruptSession(session: SimulationSession): SimulationSession {
  assertStatus(session, ["in_progress", "paused"], "interrupt");
  return { ...session, status: "interrupted" };
}

/** Live elapsed active time, accounting for time passed since the last transition if still in_progress. */
export function computeLiveActiveMs(session: SimulationSession, now: number): number {
  if (session.status !== "in_progress" || session.lastTransitionAt === null) {
    return session.activeMs;
  }
  return session.activeMs + (now - session.lastTransitionAt);
}

/**
 * Both clocks as they stand right now, for writing a record mid-attempt.
 *
 * `activeMs` and `pausedMs` on the session are only advanced at a transition,
 * so an autosave that copies them writes the figures from the *last* pause or
 * start - zero, for an attempt that has never been paused. That was invisible
 * while nothing read an unfinished record's clock. D8 makes something read it:
 * the time carried into a continued attempt.
 *
 * A completed or abandoned session returns its stored figures unchanged, since
 * `completeSession` has already folded the final interval in; calling this
 * afterwards cannot double-count it.
 */
export function sessionTimesAt(
  session: SimulationSession,
  now: number
): { activeMs: number; pausedMs: number } {
  const since = now - (session.lastTransitionAt ?? now);
  if (session.status === "in_progress") {
    return { activeMs: session.activeMs + since, pausedMs: session.pausedMs };
  }
  if (session.status === "paused") {
    return { activeMs: session.activeMs, pausedMs: session.pausedMs + since };
  }
  return { activeMs: session.activeMs, pausedMs: session.pausedMs };
}
