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
