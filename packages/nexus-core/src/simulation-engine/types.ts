/**
 * Session lifecycle (Architecture Package Section 10/29). Not every status
 * is reachable from the Phase 3 UI yet (evaluation_failed and retried
 * depend on the Phase 4 evaluation engine), but the type models the full
 * set now so Phase 4/5 don't need a breaking change here.
 */
export type SessionStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "interrupted"
  | "abandoned"
  | "evaluation_failed"
  | "retried";

/**
 * - `practice`   full transcript visible up front; pausable.
 * - `simulation` transcript revealed progressively; pausable.
 * - `assessment` exam conditions (Phase 8.3): revealed progressively like
 *   simulation, but **cannot be paused or resumed**. Business Model Spec
 *   Section 10: "a mode flag that disables Pause/Resume". The rule is
 *   enforced by the session machine itself, not only by hiding a button.
 *
 * The architecture doc's fourth mode, `learning`, is not implemented.
 */
export type SimulationMode = "practice" | "simulation" | "assessment";

/** Whether a session in this mode may be paused (and therefore resumed). */
export function modeAllowsPause(mode: SimulationMode): boolean {
  return mode !== "assessment";
}

export type FlagType = "important" | "uncertain" | "review_later";

export interface SessionFlag {
  beatId: string;
  flagType: FlagType;
  timestamp: number;
}

export interface SimulationSession {
  id: string;
  scenarioId: string;
  scenarioVersion: string;
  mode: SimulationMode;
  status: SessionStatus;
  startedAt: number | null;
  /** Accumulated milliseconds while status has been 'in_progress'. */
  activeMs: number;
  /** Accumulated milliseconds while status has been 'paused'. */
  pausedMs: number;
  /** Timestamp of the last transition into 'in_progress' or 'paused'. */
  lastTransitionAt: number | null;
  completedAt: number | null;
  flags: SessionFlag[];
}
