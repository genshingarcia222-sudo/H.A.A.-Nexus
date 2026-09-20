import type { TrainingQuestion } from "../question-bank/schema.js";

/**
 * The Training question run — answer, submit, see why, move on.
 *
 * Pure and framework-free on purpose. Every rule about what a learner may do
 * next lives here, where it can be tested directly, rather than in a React
 * component where it would be reachable only through rendering. The UI renders
 * this state; it does not decide it.
 *
 * **State is derived, not accumulated.** There is no `isSubmitted` boolean
 * beside an `isCorrect` boolean beside a `showRationale` boolean — a set of
 * independent flags can express "submitted but still editable" or "correct and
 * incorrect at once", and sooner or later it does. Instead there is one
 * `submission`, which is either absent or a complete record of what happened,
 * and every question the UI asks is answered from it.
 *
 * What this module deliberately is not:
 *
 * - **Not a scoring engine.** It records whether one answer matched; it counts
 *   nothing, grades nothing and produces no result for a run.
 * - **Not persistence.** It holds no history. A run exists only as the value
 *   passed between calls, and advancing discards the previous question's state
 *   rather than filing it.
 * - **Not entitlement.** It never asks who the learner is.
 * - **Not Assessment.** Assessment is scenario-based and defines its own
 *   behaviour; nothing here is reachable from it.
 */

/** A completed answer to one question. Absent until the learner submits. */
export interface TrainingAnswerSubmission {
  selectedChoiceId: string;
  /** Resolved from the question, so the reveal cannot disagree with the grade. */
  correctChoiceId: string;
  isCorrect: boolean;
}

export interface TrainingRunState {
  readonly questions: readonly TrainingQuestion[];
  /** Index of the question being answered. Equals `questions.length` when the run is over. */
  readonly index: number;
  /** The learner's current pick, or null. Frozen once `submission` exists. */
  readonly selectedChoiceId: string | null;
  readonly submission: TrainingAnswerSubmission | null;
}

/**
 * Why a transition was refused.
 *
 * A refusal is never a thrown error and never a mutation: the caller gets the
 * unchanged state back alongside the reason, so a rejected click cannot leave
 * the run half-transitioned.
 */
export type TrainingRunRejection =
  | "no-selection"
  | "already-submitted"
  | "unknown-choice"
  | "malformed-question"
  | "not-submitted"
  | "run-complete";

export type TrainingRunTransition =
  | { status: "ok"; state: TrainingRunState }
  | { status: "rejected"; reason: TrainingRunRejection; state: TrainingRunState };

function ok(state: TrainingRunState): TrainingRunTransition {
  return { status: "ok", state };
}

function rejected(state: TrainingRunState, reason: TrainingRunRejection): TrainingRunTransition {
  return { status: "rejected", reason, state };
}

/** Starts a run over already-selected questions. A run may legitimately be empty. */
export function startTrainingRun(questions: readonly TrainingQuestion[]): TrainingRunState {
  return { questions, index: 0, selectedChoiceId: null, submission: null };
}

/** The question being answered, or null when the run is finished or empty. */
export function currentQuestion(state: TrainingRunState): TrainingQuestion | null {
  return state.questions[state.index] ?? null;
}

/** True once every question has been answered and advanced past. */
export function isRunComplete(state: TrainingRunState): boolean {
  return state.index >= state.questions.length;
}

/** True once the current question has been submitted — the single source for "locked". */
export function isSubmitted(state: TrainingRunState): boolean {
  return state.submission !== null;
}

/** Whether the submitted answer was correct, or null before submission. */
export function isCorrect(state: TrainingRunState): boolean | null {
  return state.submission?.isCorrect ?? null;
}

/** 1-based position and total, for display. */
export function runProgress(state: TrainingRunState): { position: number; total: number } {
  return { position: Math.min(state.index + 1, state.questions.length), total: state.questions.length };
}

/**
 * Grades one answer against the question's **canonical** answer identity.
 *
 * Correctness is resolved through `correctChoiceId`, never through position,
 * display order or answer text. Reordering the choices for display therefore
 * cannot change which answer is right — the failure the old
 * `correctOptionIndex` shape invites.
 *
 * Returns null when the answer cannot be graded at all: an id that is not one
 * of this question's choices, or a question whose own `correctChoiceId`
 * resolves to nothing. **An ungradable answer is never treated as correct.**
 */
export function evaluateAnswer(
  question: TrainingQuestion,
  selectedChoiceId: string
): TrainingAnswerSubmission | null {
  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  if (!choiceIds.has(selectedChoiceId)) return null;
  // The schema guarantees this resolves; the runtime boundary checks anyway,
  // because data can reach here from outside a validator.
  if (!choiceIds.has(question.correctChoiceId)) return null;

  return {
    selectedChoiceId,
    correctChoiceId: question.correctChoiceId,
    isCorrect: selectedChoiceId === question.correctChoiceId
  };
}

/**
 * Picks a choice.
 *
 * Refused once the question is submitted. This is the lock, and it lives here
 * rather than in a `disabled` attribute so that a keyboard activation, a
 * synthetic event or a future surface cannot get around it by not rendering the
 * same button.
 */
export function selectChoice(state: TrainingRunState, choiceId: string): TrainingRunTransition {
  const question = currentQuestion(state);
  if (!question) return rejected(state, "run-complete");
  if (state.submission !== null) return rejected(state, "already-submitted");
  if (!question.choices.some((choice) => choice.id === choiceId)) return rejected(state, "unknown-choice");

  return ok({ ...state, selectedChoiceId: choiceId });
}

/**
 * Submits the current selection.
 *
 * A second submit is refused rather than re-evaluated, so a double click, a
 * held Enter key or a duplicated event produces exactly one transition and one
 * set of feedback.
 */
export function submitAnswer(state: TrainingRunState): TrainingRunTransition {
  const question = currentQuestion(state);
  if (!question) return rejected(state, "run-complete");
  if (state.submission !== null) return rejected(state, "already-submitted");
  if (state.selectedChoiceId === null) return rejected(state, "no-selection");

  const submission = evaluateAnswer(question, state.selectedChoiceId);
  if (!submission) {
    // Either the selection is stale for this question or the question's own
    // answer key does not resolve. Neither is "correct", and neither should
    // crash the surface: the run stays exactly as it was.
    const known = question.choices.some((choice) => choice.id === state.selectedChoiceId);
    return rejected(state, known ? "malformed-question" : "unknown-choice");
  }

  return ok({ ...state, submission });
}

/**
 * Moves to the next question.
 *
 * Refused before submission, so a learner cannot skip past a question and leave
 * feedback that belongs to nothing. The next state is built from the run's
 * questions and the new index alone — selection and submission are *replaced
 * with their initial values*, never carried, so nothing from the previous
 * question can survive the transition.
 */
export function advanceToNextQuestion(state: TrainingRunState): TrainingRunTransition {
  if (isRunComplete(state)) return rejected(state, "run-complete");
  if (state.submission === null) return rejected(state, "not-submitted");

  return ok({ questions: state.questions, index: state.index + 1, selectedChoiceId: null, submission: null });
}
