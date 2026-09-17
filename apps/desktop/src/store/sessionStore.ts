import { create } from "zustand";
import {
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  addFlag,
  splitNarrativeIntoBeats,
  visibleBeats,
  createEmptyDraft,
  updateDraftField,
  evaluateAttempt,
  updateCompetencyRecord,
  canAccessDifficulty,
  modeAllowsPause,
  type Scenario,
  type SimulationSession,
  type SimulationMode,
  type DocumentationDraft,
  type FlagType,
  type TranscriptBeat,
  type EvaluationResult,
  type SessionRecord
} from "@haa-nexus/nexus-core";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { currentEntitlements } from "./entitlementStore.js";

interface SessionState {
  scenario: Scenario | null;
  session: SimulationSession | null;
  draft: DocumentationDraft;
  beats: TranscriptBeat[];
  revealedCount: number;
  result: EvaluationResult | null;

  /**
   * Starts a session, or refuses to. Returns `true` if a session started and
   * `false` if the learner's entitlements do not unlock this scenario's
   * difficulty - in which case nothing at all changes.
   */
  start: (scenario: Scenario, mode: SimulationMode) => boolean;
  pause: () => void;
  resume: () => void;
  advanceTranscript: () => void;
  flagCurrentBeat: (flagType: FlagType) => void;
  updateField: (section: keyof DocumentationDraft, value: string) => void;
  clearDraft: () => void;
  submit: () => Promise<void>;
  reset: () => void;
  /** Called on an interval while in_progress, and on pause - see Architecture Package Section 10 ("autosave... every 15s"). */
  persistDraft: () => Promise<void>;
}

function toSessionRecord(
  scenario: Scenario,
  session: SimulationSession,
  draft: DocumentationDraft,
  result: EvaluationResult | null
): SessionRecord {
  return {
    id: session.id,
    scenarioId: scenario.scenarioId,
    scenarioVersion: scenario.version,
    scenarioTitle: scenario.title,
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt ?? Date.now(),
    activeMs: session.activeMs,
    pausedMs: session.pausedMs,
    completedAt: session.completedAt,
    flags: session.flags,
    draft,
    evaluation: result
  };
}

const COMPETENCY_DOMAINS = [
  "accuracy",
  "completeness",
  "terminology",
  "relevance",
  "structure",
  "pertinentPosNeg",
  "timeEfficiency"
] as const;

export const useSessionStore = create<SessionState>((set, get) => ({
  scenario: null,
  session: null,
  draft: createEmptyDraft(),
  beats: [],
  revealedCount: 0,
  result: null,

  start: (scenario, mode) => {
    // Entitlement enforcement (Phase 8.2). Every way into a session - the
    // scenario library, "Retry this scenario", a recommendation's retry, and
    // resuming an interrupted session from the Dashboard - calls this
    // function, so guarding here protects all of them rather than only the
    // button a learner happens to see. The check runs before any state is
    // touched: a refused start creates no session, no draft, no persisted
    // record, and leaves any current session exactly as it was.
    if (!canAccessDifficulty(currentEntitlements(), scenario.difficulty)) {
      return false;
    }

    const beats = splitNarrativeIntoBeats(scenario.encounter.narrative);
    set({
      scenario,
      session: startSession(
        // crypto.randomUUID() rather than an in-memory counter: a counter
        // resets to 0 on every reload, which would collide with IDs already
        // persisted from a prior session now that Phase 5 adds real storage.
        { id: crypto.randomUUID(), scenarioId: scenario.scenarioId, scenarioVersion: scenario.version, mode },
        Date.now()
      ),
      draft: createEmptyDraft(),
      beats,
      result: null,
      // Practice mode shows the full transcript up front ("optional
      // transcript visibility" - Architecture Package Section 7). Simulation
      // and assessment modes reveal it progressively.
      revealedCount: mode === "practice" ? beats.length : Math.min(1, beats.length)
    });
    return true;
  },

  pause: () => {
    const { session } = get();
    // Assessment sessions cannot pause (the session machine would throw);
    // ignore the request rather than raising from a UI event handler.
    if (!session || !modeAllowsPause(session.mode)) return;
    set({ session: pauseSession(session, Date.now()) });
    void get().persistDraft();
  },

  resume: () => {
    const { session } = get();
    if (!session || !modeAllowsPause(session.mode)) return;
    set({ session: resumeSession(session, Date.now()) });
  },

  advanceTranscript: () => {
    const { beats, revealedCount } = get();
    set({ revealedCount: Math.min(revealedCount + 1, beats.length) });
  },

  flagCurrentBeat: (flagType) => {
    const { session, beats, revealedCount } = get();
    if (!session || revealedCount === 0) return;
    const currentBeat = beats[revealedCount - 1];
    if (!currentBeat) return;
    set({ session: addFlag(session, currentBeat.id, flagType, Date.now()) });
  },

  updateField: (section, value) => {
    set((state) => ({ draft: updateDraftField(state.draft, section, value) }));
  },

  clearDraft: () => {
    set({ draft: createEmptyDraft() });
  },

  persistDraft: async () => {
    const { scenario, session, draft, result } = get();
    if (!scenario || !session) return;
    try {
      await sessionRepository.save(toSessionRecord(scenario, session, draft, result));
    } catch (err) {
      // Autosave failures shouldn't interrupt the learner's session - log
      // and continue. A user-visible "not saving" indicator is a
      // reasonable future refinement (Architecture Package Section 57).
      console.error("Autosave failed:", err);
    }
  },

  submit: async () => {
    const { scenario, session, draft } = get();
    if (!scenario || !session) return;

    const completedSession = completeSession(session, Date.now());
    const result = evaluateAttempt({ scenario, draft, activeMs: completedSession.activeMs });

    set({ session: completedSession, result });

    try {
      await sessionRepository.save(toSessionRecord(scenario, completedSession, draft, result));
    } catch (err) {
      console.error("Failed to save completed session:", err);
    }

    // Fold this attempt's category scores into each domain's competency
    // record. Domains here are the 7 scoring categories the evaluator
    // actually produces per-attempt (Architecture Package Section 21 lists
    // additional per-section domains like HPI/ROS individually, which
    // would need the evaluator to score sections independently - a
    // reasonable future refinement, not implemented in Phase 5).
    try {
      for (const domain of COMPETENCY_DOMAINS) {
        const existing = await competencyRepository.get(domain);
        const updated = updateCompetencyRecord(existing, domain, result.categoryScores[domain], Date.now());
        await competencyRepository.upsert(updated);
      }
    } catch (err) {
      console.error("Failed to update competency records:", err);
    }
  },

  reset: () => {
    set({ scenario: null, session: null, draft: createEmptyDraft(), beats: [], revealedCount: 0, result: null });
  }
}));

export function visibleTranscriptBeats(): TranscriptBeat[] {
  const { beats, revealedCount } = useSessionStore.getState();
  return visibleBeats(beats, revealedCount);
}
