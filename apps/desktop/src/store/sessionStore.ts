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
  resultPopulationFor,
  canAccessDifficulty,
  canStartMode,
  modeAllowsPause,
  mayRevealPerformance,
  assertMayRevealPerformance,
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

/**
 * Why the learner's work is not currently saved (Architecture Package §28:
 * a write failure must surface as a recoverable error, never as silent data
 * loss). `autosave` - an in-progress draft failed to save. `submission` - a
 * completed attempt failed to save to history.
 */
export type SaveError = "autosave" | "submission";

interface SessionState {
  scenario: Scenario | null;
  session: SimulationSession | null;
  draft: DocumentationDraft;
  beats: TranscriptBeat[];
  revealedCount: number;
  result: EvaluationResult | null;
  /** Set when the latest save failed; cleared by the next successful save. */
  saveError: SaveError | null;

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
  /**
   * Saves the current session, draft and (once revealable) result. Called on
   * an interval while in_progress, on pause (Architecture Package Section 10,
   * "autosave... every 15s"), and when the learner retries after a failure.
   * Resolves to whether the save succeeded.
   */
  persistDraft: () => Promise<boolean>;
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
    // An active assessment must never carry an evaluation, not even in its
    // autosaved record (Phase 8.3 live-feedback boundary). Stripping it here,
    // rather than refusing to save, keeps the learner's draft safe.
    evaluation: mayRevealPerformance(session) ? result : null
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
  saveError: null,

  start: (scenario, mode) => {
    // Entitlement enforcement (Phase 8.2). Every way into a session - the
    // scenario library, "Retry this scenario", a recommendation's retry, and
    // resuming an interrupted session from the Dashboard - calls this
    // function, so guarding here protects all of them rather than only the
    // button a learner happens to see. The check runs before any state is
    // touched: a refused start creates no session, no draft, no persisted
    // record, and leaves any current session exactly as it was.
    const entitlements = currentEntitlements();
    if (!canAccessDifficulty(entitlements, scenario.difficulty)) {
      return false;
    }
    // Mode entitlement (decision D1, owner-selected 2026-09-19: Assessment
    // requires Pro). Which mode needs which capability is decided in
    // nexus-core; this boundary only enforces the answer, so hiding a button
    // is a convenience rather than the protection.
    if (!canStartMode(entitlements, mode)) {
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
      saveError: null,
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
    if (!scenario || !session) return false;
    try {
      await sessionRepository.save(toSessionRecord(scenario, session, draft, result));
      if (get().saveError) set({ saveError: null });
      return true;
    } catch (err) {
      // A failed save must not interrupt the learner, but it must not be
      // silent either (Architecture Package §28): the work is still in memory
      // and on screen, and saveError lets the UI say so and offer a retry.
      console.error("Save failed:", err);
      set({ saveError: session.status === "completed" ? "submission" : "autosave" });
      return false;
    }
  },

  submit: async () => {
    const { scenario, session, draft } = get();
    if (!scenario || !session) return;
    // Idempotent: a second submit (a double click, or a retry racing the
    // first) finds the session already completed and does nothing, so one
    // attempt can never be evaluated, saved, or folded into competency twice.
    if (session.status !== "in_progress" && session.status !== "paused") return;

    const completedSession = completeSession(session, Date.now());
    // The reveal point for an attempt's evaluation. Always satisfied here,
    // because the session has just been completed; stated so that any future
    // path that evaluates earlier fails loudly for an active assessment.
    assertMayRevealPerformance(completedSession, "an evaluation");
    const result = evaluateAttempt({ scenario, draft, activeMs: completedSession.activeMs });

    set({ session: completedSession, result });

    try {
      await sessionRepository.save(toSessionRecord(scenario, completedSession, draft, result));
      if (get().saveError) set({ saveError: null });
    } catch (err) {
      console.error("Failed to save completed session:", err);
      set({ saveError: "submission" });
    }

    // Fold this attempt's category scores into each domain's competency
    // record. Domains here are the 7 scoring categories the evaluator
    // actually produces per-attempt (Architecture Package Section 21 lists
    // additional per-section domains like HPI/ROS individually, which
    // would need the evaluator to score sections independently - a
    // reasonable future refinement, not implemented in Phase 5).
    try {
      // Read and compute everything first, then write once. Folding domain by
      // domain meant a failure partway through left this attempt counted in
      // some domains and not others - and `submit` is idempotent, so a retry
      // finds the session already completed and never finishes the fold. The
      // repository writes the batch atomically (one SQLite transaction), so
      // an attempt lands in every domain or in none.
      // Which body of results this attempt belongs to (decision D5).
      // Assessment and Practice are separate populations: this fold reads and
      // writes only its own, so an assessment can never overwrite practice
      // competency, or the reverse.
      const population = resultPopulationFor(completedSession.mode);
      const foldedAt = Date.now();
      const updates = [];
      for (const domain of COMPETENCY_DOMAINS) {
        const existing = await competencyRepository.get(population, domain);
        updates.push(
          updateCompetencyRecord(existing, population, domain, result.categoryScores[domain], foldedAt)
        );
      }
      await competencyRepository.upsertMany(updates);
    } catch (err) {
      console.error("Failed to update competency records:", err);
    }
  },

  reset: () => {
    set({
      scenario: null,
      session: null,
      draft: createEmptyDraft(),
      beats: [],
      revealedCount: 0,
      result: null,
      saveError: null
    });
  }
}));

export function visibleTranscriptBeats(): TranscriptBeat[] {
  const { beats, revealedCount } = useSessionStore.getState();
  return visibleBeats(beats, revealedCount);
}

/**
 * The evaluation the learner may be shown *right now*, or `null`.
 *
 * `state.result` is the raw field: it exists so `submit` can evaluate, persist
 * and fold the attempt into competency. It is not what the UI may render. The
 * Phase 8.3 live-feedback boundary (D2) applies here, once, so that presenting
 * a score is not a rule each component has to remember - an assessment reveals
 * nothing until it is `completed`, while practice and simulation are
 * unrestricted because no restriction is authorized for them.
 *
 * Every UI path reads the result through this selector or
 * `useRevealableResult`; `liveFeedbackBoundary.invariant.test.ts` fails if a
 * component reaches for `state.result` directly.
 */
export function selectRevealableResult(state: SessionState): EvaluationResult | null {
  if (!state.session || !state.result) return null;
  return mayRevealPerformance(state.session) ? state.result : null;
}

/** React binding for {@link selectRevealableResult}. */
export function useRevealableResult(): EvaluationResult | null {
  return useSessionStore(selectRevealableResult);
}
