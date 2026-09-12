import type { SimulationMode, SessionStatus, SessionFlag } from "../simulation-engine/types.js";
import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";
import type { EvaluationResult } from "../evaluation-engine/types.js";

/**
 * A denormalized read-model of a session + its documentation attempt +
 * evaluation result. The real SQLite schema (Architecture Package Section
 * 8) normalizes these into simulation_sessions / documentation_attempts /
 * evaluation_results tables; this shape is what the Rust layer's queries
 * join together for the app to consume, and what the in-memory adapter
 * stores directly since it has no normalization to do.
 */
export interface SessionRecord {
  id: string;
  scenarioId: string;
  scenarioVersion: string;
  scenarioTitle: string;
  mode: SimulationMode;
  status: SessionStatus;
  startedAt: number;
  activeMs: number;
  pausedMs: number;
  completedAt: number | null;
  flags: SessionFlag[];
  draft: DocumentationDraft;
  evaluation: EvaluationResult | null;
}

export interface SessionRepository {
  save(record: SessionRecord): Promise<void>;
  get(id: string): Promise<SessionRecord | undefined>;
  list(): Promise<SessionRecord[]>;
  /** Sessions left in_progress/paused - the crash-recovery candidates on next launch. */
  findInterrupted(): Promise<SessionRecord[]>;
}

export interface UserProfile {
  displayName: string;
  updatedAt: number;
}

export interface ProfileRepository {
  get(): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}
