import { describe, expect, it } from "vitest";
import { validateTrainingQuestion } from "../question-bank/validate.js";
import type { TrainingQuestion } from "../question-bank/schema.js";
import { minimalQuestion } from "../question-bank/__fixtures__/questions.js";
import {
  advanceToNextQuestion,
  currentQuestion,
  evaluateAnswer,
  isCorrect,
  isRunComplete,
  isSubmitted,
  runProgress,
  selectChoice,
  startTrainingRun,
  submitAnswer
} from "./question-run.js";
import type { TrainingRunState, TrainingRunTransition } from "./question-run.js";

/**
 * Fixtures are structural variants of the existing bank fixture: ids and
 * choice layout differ, the clinical text does not. No medical content is
 * authored in a test file.
 */
function questionOf(overrides: Record<string, unknown>): TrainingQuestion {
  const result = validateTrainingQuestion({ ...minimalQuestion, ...overrides });
  if (!result.success) throw new Error(`fixture does not validate:\n  ${result.errors.join("\n  ")}`);
  return result.data;
}

/** Three choices, the correct one deliberately *not* first. */
const threeChoice = questionOf({
  questionId: "Q-RUN-001",
  choices: [
    { id: "a", text: "First option", why: "Not this one." },
    { id: "b", text: "Second option", why: "Correct: this is the one." },
    { id: "c", text: "Third option" }
  ],
  correctChoiceId: "b",
  rationale: "The second option is the one the source supports."
});

const secondQuestion = questionOf({
  questionId: "Q-RUN-002",
  choices: [
    { id: "x", text: "Alpha" },
    { id: "y", text: "Beta" }
  ],
  correctChoiceId: "x",
  rationale: "Alpha is the one the source supports."
});

function expectOk(transition: TrainingRunTransition): TrainingRunState {
  if (transition.status !== "ok") {
    throw new Error(`expected an accepted transition, got rejected: ${transition.reason}`);
  }
  return transition.state;
}

function expectRejected(transition: TrainingRunTransition): { reason: string; state: TrainingRunState } {
  if (transition.status !== "rejected") throw new Error("expected the transition to be refused");
  return { reason: transition.reason, state: transition.state };
}

describe("evaluateAnswer: correctness is canonical identity", () => {
  it("recognises the correct answer by id", () => {
    const result = evaluateAnswer(threeChoice, "b");
    expect(result).toEqual({ selectedChoiceId: "b", correctChoiceId: "b", isCorrect: true });
  });

  it("recognises an incorrect answer by id, and reports what was correct", () => {
    const result = evaluateAnswer(threeChoice, "c");
    expect(result?.isCorrect).toBe(false);
    expect(result?.correctChoiceId).toBe("b");
  });

  it("is unaffected by choice order", () => {
    // Same question, choices reversed. Position-based grading would flip the
    // answer; identity-based grading cannot.
    const reversed = questionOf({
      questionId: "Q-RUN-001-REV",
      choices: [
        { id: "c", text: "Third option" },
        { id: "b", text: "Second option", why: "Correct: this is the one." },
        { id: "a", text: "First option", why: "Not this one." }
      ],
      correctChoiceId: "b"
    });
    expect(evaluateAnswer(reversed, "b")?.isCorrect).toBe(true);
    expect(evaluateAnswer(reversed, "a")?.isCorrect).toBe(false);
    expect(evaluateAnswer(reversed, "b")?.correctChoiceId).toBe(evaluateAnswer(threeChoice, "b")?.correctChoiceId);
  });

  it("is unaffected by identical-looking answer text across questions", () => {
    const twin = questionOf({
      questionId: "Q-RUN-TWIN",
      choices: [
        { id: "a", text: "Same text" },
        { id: "b", text: "Same text" }
      ],
      correctChoiceId: "b"
    });
    expect(evaluateAnswer(twin, "a")?.isCorrect).toBe(false);
    expect(evaluateAnswer(twin, "b")?.isCorrect).toBe(true);
  });

  it("refuses to grade an id that is not one of this question's choices", () => {
    // An ungradable answer is never "correct".
    expect(evaluateAnswer(threeChoice, "zzz")).toBeNull();
    expect(evaluateAnswer(threeChoice, "")).toBeNull();
  });

  it("refuses to grade a question whose own answer key does not resolve", () => {
    // The schema prevents this, but data can reach the runtime from outside a
    // validator, and a broken key must not read as a correct answer.
    const malformed = { ...threeChoice, correctChoiceId: "nonexistent" } as TrainingQuestion;
    expect(evaluateAnswer(malformed, "a")).toBeNull();
    expect(evaluateAnswer(malformed, "nonexistent")).toBeNull();
  });
});

describe("the run: selecting and submitting", () => {
  const start = () => startTrainingRun([threeChoice, secondQuestion]);

  it("starts ready: nothing selected, nothing submitted", () => {
    const state = start();
    expect(currentQuestion(state)?.questionId).toBe("Q-RUN-001");
    expect(state.selectedChoiceId).toBeNull();
    expect(isSubmitted(state)).toBe(false);
    expect(isCorrect(state)).toBeNull();
    expect(runProgress(state)).toEqual({ position: 1, total: 2 });
  });

  it("records a selection without grading it", () => {
    const state = expectOk(selectChoice(start(), "c"));
    expect(state.selectedChoiceId).toBe("c");
    expect(isSubmitted(state)).toBe(false);
    expect(isCorrect(state)).toBeNull();
  });

  it("allows changing the selection before submitting", () => {
    let state = expectOk(selectChoice(start(), "a"));
    state = expectOk(selectChoice(state, "b"));
    expect(state.selectedChoiceId).toBe("b");
  });

  it("refuses a choice id the question does not have", () => {
    const { reason, state } = expectRejected(selectChoice(start(), "zzz"));
    expect(reason).toBe("unknown-choice");
    expect(state.selectedChoiceId).toBeNull();
  });

  it("refuses to submit with nothing selected, and changes nothing", () => {
    const before = start();
    const { reason, state } = expectRejected(submitAnswer(before));
    expect(reason).toBe("no-selection");
    expect(state).toEqual(before);
    expect(isSubmitted(state)).toBe(false);
  });

  it("submits a correct answer", () => {
    const state = expectOk(submitAnswer(expectOk(selectChoice(start(), "b"))));
    expect(isSubmitted(state)).toBe(true);
    expect(isCorrect(state)).toBe(true);
    expect(state.submission).toEqual({ selectedChoiceId: "b", correctChoiceId: "b", isCorrect: true });
  });

  it("submits an incorrect answer and carries the correct id for the reveal", () => {
    const state = expectOk(submitAnswer(expectOk(selectChoice(start(), "a"))));
    expect(isCorrect(state)).toBe(false);
    expect(state.submission?.correctChoiceId).toBe("b");
    // The reveal cannot disagree with the grade: both come from one record.
    expect(state.submission?.selectedChoiceId).not.toBe(state.submission?.correctChoiceId);
  });
});

describe("the run: locking after submission", () => {
  const submitted = () => expectOk(submitAnswer(expectOk(selectChoice(startTrainingRun([threeChoice]), "a"))));

  it("refuses a second submit and produces no second transition", () => {
    const first = submitted();
    const { reason, state } = expectRejected(submitAnswer(first));
    expect(reason).toBe("already-submitted");
    expect(state).toBe(first);
  });

  it("stays stable under a burst of repeated submits", () => {
    let state = submitted();
    for (let i = 0; i < 10; i++) {
      const transition = submitAnswer(state);
      expect(transition.status).toBe("rejected");
      state = transition.state;
    }
    expect(state.submission).toEqual({ selectedChoiceId: "a", correctChoiceId: "b", isCorrect: false });
    expect(isCorrect(state)).toBe(false);
  });

  it("refuses to change the answer after submitting", () => {
    // The lock is a state rule, not a `disabled` attribute, so a keyboard
    // activation or a synthetic event cannot get around it.
    const first = submitted();
    const { reason, state } = expectRejected(selectChoice(first, "b"));
    expect(reason).toBe("already-submitted");
    expect(state.selectedChoiceId).toBe("a");
    expect(isCorrect(state)).toBe(false);
  });

  it("never holds a submitted-but-editable state", () => {
    const state = submitted();
    expect(isSubmitted(state)).toBe(true);
    expect(selectChoice(state, "b").status).toBe("rejected");
  });
});

describe("the run: progression resets everything", () => {
  function runTo(state: TrainingRunState, choiceId: string): TrainingRunState {
    return expectOk(submitAnswer(expectOk(selectChoice(state, choiceId))));
  }

  it("refuses to advance before submitting", () => {
    const state = expectOk(selectChoice(startTrainingRun([threeChoice, secondQuestion]), "a"));
    const { reason } = expectRejected(advanceToNextQuestion(state));
    expect(reason).toBe("not-submitted");
  });

  it("clears selection, submission, correctness and feedback on the next question", () => {
    const answered = runTo(startTrainingRun([threeChoice, secondQuestion]), "a");
    expect(answered.submission).not.toBeNull();

    const next = expectOk(advanceToNextQuestion(answered));
    expect(currentQuestion(next)?.questionId).toBe("Q-RUN-002");
    expect(next.selectedChoiceId).toBeNull();
    expect(next.submission).toBeNull();
    expect(isSubmitted(next)).toBe(false);
    expect(isCorrect(next)).toBeNull();
    expect(runProgress(next)).toEqual({ position: 2, total: 2 });
  });

  it("keeps consecutive questions independent, correct after incorrect", () => {
    let state = runTo(startTrainingRun([threeChoice, secondQuestion]), "a");
    expect(isCorrect(state)).toBe(false);

    state = expectOk(advanceToNextQuestion(state));
    state = runTo(state, "x");
    expect(isCorrect(state)).toBe(true);
    expect(state.submission?.selectedChoiceId).toBe("x");
    expect(state.submission?.correctChoiceId).toBe("x");
  });

  it("does not leak a previous question's choice id into the next", () => {
    // "a" exists on question 1 and not on question 2. If selection leaked, the
    // next question would open with an id it does not own.
    let state = runTo(startTrainingRun([threeChoice, secondQuestion]), "a");
    state = expectOk(advanceToNextQuestion(state));
    expect(state.selectedChoiceId).toBeNull();
    expect(expectRejected(selectChoice(state, "a")).reason).toBe("unknown-choice");
  });

  it("stays clean across many consecutive questions", () => {
    const questions = Array.from({ length: 10 }, (_, i) =>
      questionOf({
        questionId: `Q-SEQ-${i}`,
        choices: [
          { id: "p", text: "Pick p" },
          { id: "q", text: "Pick q" }
        ],
        correctChoiceId: i % 2 === 0 ? "p" : "q"
      })
    );

    let state = startTrainingRun(questions);
    for (let i = 0; i < questions.length; i++) {
      expect(state.selectedChoiceId, `question ${i} opened with a stale selection`).toBeNull();
      expect(state.submission, `question ${i} opened with stale feedback`).toBeNull();
      expect(currentQuestion(state)?.questionId).toBe(`Q-SEQ-${i}`);

      state = runTo(state, "p");
      expect(isCorrect(state)).toBe(i % 2 === 0);

      const transition = advanceToNextQuestion(state);
      state = transition.state;
      if (i < questions.length - 1) expect(transition.status).toBe("ok");
    }

    expect(isRunComplete(state)).toBe(true);
    expect(currentQuestion(state)).toBeNull();
  });
});

describe("the run: finishing and empty runs", () => {
  it("reports completion and refuses further transitions", () => {
    let state = expectOk(submitAnswer(expectOk(selectChoice(startTrainingRun([threeChoice]), "b"))));
    state = expectOk(advanceToNextQuestion(state));

    expect(isRunComplete(state)).toBe(true);
    expect(currentQuestion(state)).toBeNull();
    expect(expectRejected(advanceToNextQuestion(state)).reason).toBe("run-complete");
    expect(expectRejected(selectChoice(state, "b")).reason).toBe("run-complete");
    expect(expectRejected(submitAnswer(state)).reason).toBe("run-complete");
  });

  it("handles an empty run without crashing", () => {
    const state = startTrainingRun([]);
    expect(isRunComplete(state)).toBe(true);
    expect(currentQuestion(state)).toBeNull();
    expect(expectRejected(submitAnswer(state)).reason).toBe("run-complete");
    expect(runProgress(state)).toEqual({ position: 0, total: 0 });
  });
});

describe("the run: malformed data fails safe", () => {
  it("refuses to submit a question whose answer key does not resolve, without crashing", () => {
    const malformed = { ...threeChoice, correctChoiceId: "nonexistent" } as TrainingQuestion;
    const state = expectOk(selectChoice(startTrainingRun([malformed]), "a"));
    const { reason, state: after } = expectRejected(submitAnswer(state));

    expect(reason).toBe("malformed-question");
    // Crucially: not graded as correct, and no submission recorded.
    expect(after.submission).toBeNull();
    expect(isCorrect(after)).toBeNull();
  });

  it("never mutates the questions it was given", () => {
    const questions = [threeChoice, secondQuestion];
    const before = JSON.stringify(questions);

    let state = startTrainingRun(questions);
    state = expectOk(selectChoice(state, "a"));
    state = expectOk(submitAnswer(state));
    state = expectOk(advanceToNextQuestion(state));

    expect(JSON.stringify(questions)).toBe(before);
    expect(Object.isFrozen(threeChoice) || JSON.stringify(threeChoice)).toBeTruthy();
  });

  it("leaves the previous state untouched on every refusal", () => {
    const state = startTrainingRun([threeChoice]);
    const snapshot = JSON.stringify(state);
    submitAnswer(state);
    selectChoice(state, "zzz");
    advanceToNextQuestion(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
