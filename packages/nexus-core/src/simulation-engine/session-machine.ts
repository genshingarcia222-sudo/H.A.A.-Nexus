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
}

export function startSession(params: StartSessionParams, now: number): SimulationSession {
  return {
    ...params,
    status: "in_progress",
    startedAt: now,
    activeMs: 0,
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
