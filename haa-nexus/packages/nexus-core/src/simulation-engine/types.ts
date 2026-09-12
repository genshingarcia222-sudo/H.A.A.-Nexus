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
 * Assessment mode exists in the architecture doc's four-mode model but is
 * not required by the MVP acceptance criteria (Section 76 only requires
 * Practice or Simulation) - deliberately out of scope for Phase 3.
 */
export type SimulationMode = "practice" | "simulation";

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
