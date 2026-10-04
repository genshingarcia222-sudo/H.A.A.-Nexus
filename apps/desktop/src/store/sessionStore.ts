import { create } from "zustand";
import {
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  COMPETENCY_DOMAINS,
  evaluationSucceeded,
  failEvaluation,
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
  mayContinueFromDraft,
  assertMayRevealPerformance,
  sessionTimesAt,
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

/**
 * The work carried out of an interrupted attempt and into a new one (D8).
 *
 * The draft is the learner's text. `activeMs` is the time that was actually
 * measured on it, which travels with the draft so that continuing cannot buy a
 * better `timeEfficiency` than finishing in one sitting would have.
 */
export interface ContinuedWork {
  draft: DocumentationDraft;
  activeMs: number;
}

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
   * Set when scoring the attempt threw (D9). The attempt is finished and its
   * work is saved; it simply has no result yet, and `retryEvaluation` is the
   * way forward.
   */
  evaluationFailed: boolean;

  /**
   * Starts a session, or refuses to. Returns `true` if a session started and
   * `false` if the learner's entitlements do not unlock this scenario's
   * difficulty - in which case nothing at all changes.
   *
   * `continueFrom` carries an interrupted attempt's work into this new one
   * (D8). It is never a resume: the attempt gets a new id and the interrupted
   * record is left for the caller to abandon.
   */
  start: (scenario: Scenario, mode: SimulationMode, continueFrom?: ContinuedWork) => boolean;
  pause: () => void;
  resume: () => void;
  advanceTranscript: () => void;
  flagCurrentBeat: (flagType: FlagType) => void;
  updateField: (section: keyof DocumentationDraft, value: string) => void;
  clearDraft: () => void;
  submit: () => Promise<void>;
  /**
   * Scores an attempt whose evaluation failed (D9). Re-runs evaluation on the
   * attempt's own recorded time, so a retry can never earn a better
   * `timeEfficiency` than the original submission would have.
   */
  retryEvaluation: () => Promise<void>;
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
    // The live clocks, not the stored ones. Both are only advanced at a
    // transition, so copying them writes zero for an attempt that has never
    // been paused - which is every ordinary practice attempt. Nothing read an
    // unfinished record's clock before D8; now a continued attempt does.
    ...sessionTimesAt(session, Date.now()),
    completedAt: session.completedAt,
    flags: session.flags,
    draft,
    // An active assessment must never carry an evaluation, not even in its
    // autosaved record (Phase 8.3 live-feedback boundary). Stripping it here,
    // rather than refusing to save, keeps the learner's draft safe.
    evaluation: mayRevealPerformance(session) ? result : null
  };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  scenario: null,
  session: null,
  draft: createEmptyDraft(),
  beats: [],
  revealedCount: 0,
  result: null,
  saveError: null,
  evaluationFailed: false,

  start: (scenario, mode, continueFrom) => {
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

    // D8: an interrupted attempt is never resumed in place, and an Assessment
    // may not even be continued from its draft (D6). Enforced here as well as
    // in the Dashboard, because this function is the single door into every
    // session and a future entry point would otherwise have to remember.
    const carried = continueFrom && mayContinueFromDraft(mode) ? continueFrom : undefined;

    const beats = splitNarrativeIntoBeats(scenario.encounter.narrative);
    set({
      scenario,
      session: startSession(
        // crypto.randomUUID() rather than an in-memory counter: a counter
        // resets to 0 on every reload, which would collide with IDs already
        // persisted from a prior session now that Phase 5 adds real storage.
        {
          id: crypto.randomUUID(),
          scenarioId: scenario.scenarioId,
          scenarioVersion: scenario.version,
          mode,
          carriedActiveMs: carried?.activeMs
        },
        Date.now()
      ),
      // Copied, not referenced. The store's field updates are immutable, so
      // this is not the only thing keeping the abandoned record's draft intact
      // - it is the one that does not depend on that staying true.
      draft: carried ? { ...carried.draft } : createEmptyDraft(),
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

    let result: EvaluationResult;
    try {
      result = evaluateAttempt({ scenario, draft, activeMs: completedSession.activeMs });
    } catch (err) {
      // D9: scoring threw. Before this the throw escaped `submit` and rejected
      // the promise the Submit handler awaited - the session stayed
      // in_progress, nothing was written, and the learner saw no response to
      // having pressed Submit at all.
      //
      // The attempt is finished either way: the work is done and the clock has
      // stopped. What it lacks is a result. So it is recorded as
      // `evaluation_failed` with its draft and its timings, which keeps the
      // work safe across a crash, and `retryEvaluation` is offered.
      console.error("Evaluation failed:", err);
      set({ session: failEvaluation(completedSession), result: null, evaluationFailed: true });
      await get().persistDraft();
      return;
    }

    set({ session: completedSession, result, evaluationFailed: false });

    try {
      await sessionRepository.save(toSessionRecord(scenario, completedSession, draft, result));
      if (get().saveError) set({ saveError: null });
    } catch (err) {
      console.error("Failed to save completed session:", err);
      set({ saveError: "submission" });
    }

    await foldCompetency(completedSession, result);
  },

  retryEvaluation: async () => {
    const { scenario, session, draft } = get();
    if (!scenario || !session || session.status !== "evaluation_failed") return;

    let result: EvaluationResult;
    try {
      // The attempt's own recorded time, not a new measurement. A retry must
      // not be able to earn a better timeEfficiency than the submission would
      // have, and must not be punished for the minutes spent retrying.
      result = evaluateAttempt({ scenario, draft, activeMs: session.activeMs });
    } catch (err) {
      console.error("Evaluation failed again:", err);
      set({ evaluationFailed: true });
      return;
    }

    const completed = evaluationSucceeded(session);
    set({ session: completed, result, evaluationFailed: false });

    try {
      await sessionRepository.save(toSessionRecord(scenario, completed, draft, result));
      if (get().saveError) set({ saveError: null });
    } catch (err) {
      console.error("Failed to save completed session:", err);
      set({ saveError: "submission" });
    }

    await foldCompetency(completed, result);
  },

  reset: () => {
    set({
      scenario: null,
      session: null,
      draft: createEmptyDraft(),
      beats: [],
      revealedCount: 0,
      result: null,
      saveError: null,
      evaluationFailed: false
    });
  }
}));

/**
 * Folds one attempt's category scores into each domain's competency record.
 *
 * Domains here are the 7 scoring categories the evaluator actually produces
 * per-attempt (Architecture Package Section 21 lists additional per-section
 * domains like HPI/ROS individually, which would need the evaluator to score
 * sections independently - a reasonable future refinement, not implemented in
 * Phase 5).
 *
 * Extracted when D9 gave an attempt a second way to finish. A failed
 * evaluation folds nothing, because there is nothing to fold; a successful
 * retry folds exactly once, on the path that produced the result.
 */
async function foldCompetency(session: SimulationSession, result: EvaluationResult): Promise<void> {
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
    const population = resultPopulationFor(session.mode);
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
}

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
