import { describe, expect, it } from "vitest";
import { InMemoryQuestionBankRepository } from "../question-bank/repository.js";
import { validateTrainingQuestion } from "../question-bank/validate.js";
import type { QuestionBankRepository } from "../question-bank/repository.js";
import type { TrainingQuestion } from "../question-bank/schema.js";
import { minimalQuestion } from "../question-bank/__fixtures__/questions.js";
import { createSeededRandom, selectTrainingQuestions } from "./question-selection.js";
import {
  advanceToNextQuestion,
  answeredCount,
  currentQuestion,
  isRunComplete,
  runProgress,
  selectChoice,
  startTrainingRun,
  submitAnswer
} from "./question-run.js";
import type { TrainingRunState } from "./question-run.js";

/**
 * The ten-question run as a *lifecycle*: created once, walked through, finished,
 * and restarted only on purpose.
 *
 * M22 proved one question behaves. This proves the run around it does: that the
 * sequence is chosen once and then left alone, that question ten ends the run
 * rather than wrapping to an eleventh, and that a new run is a deliberate act
 * which inherits nothing.
 *
 * Fixtures are structural variants of the existing bank fixture — ids and
 * classification metadata differ, the clinical text does not.
 */

const VERIFIED = {
  humanVerificationRequired: false,
  humanVerifiedBy: "TEST FIXTURE (no person verified this; not medical content)",
  humanVerifiedOn: "2026-09-20"
};

function eligible(id: string, overrides: Record<string, unknown> = {}): TrainingQuestion {
  const result = validateTrainingQuestion({
    ...minimalQuestion,
    questionId: id,
    contentStatus: "production-eligible",
    reviewStatus: "approved",
    verification: VERIFIED,
    ...overrides
  });
  if (!result.success) throw new Error(`fixture ${id} invalid:\n  ${result.errors.join("\n  ")}`);
  return result.data;
}

function bankOf(questions: TrainingQuestion[]): InMemoryQuestionBankRepository {
  const repo = new InMemoryQuestionBankRepository();
  for (const question of questions) repo.register(question);
  return repo;
}

/** Twelve eligible questions, spread across variant groups and skill areas. */
function wideBank(): InMemoryQuestionBankRepository {
  const skills = ["Run mechanics", "Answer identity", "Content lifecycle"];
  return bankOf(
    Array.from({ length: 12 }, (_, i) =>
      eligible(`Q-LIFE-${String(i).padStart(2, "0")}`, {
        variantGroup: `GROUP-${i % 6}`,
        skillArea: skills[i % skills.length],
        learningObjective: `Objective ${i % 4}`
      })
    )
  );
}

/** Counts how often a consumer asks the bank for its eligible pool. */
function countingBank(inner: QuestionBankRepository): { repo: QuestionBankRepository; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    repo: {
      getById: (id: string) => inner.getById(id),
      getAll: () => inner.getAll(),
      getProductionEligible: () => {
        calls += 1;
        return inner.getProductionEligible();
      }
    }
  };
}

function startRunOf(repo: QuestionBankRepository, seed = 1, count = 10): TrainingRunState {
  const result = selectTrainingQuestions(repo, { count }, createSeededRandom(seed));
  if (result.status !== "success") throw new Error(`expected a run, got ${result.status}`);
  return startTrainingRun(result.questions);
}

function answerCurrent(state: TrainingRunState): TrainingRunState {
  const question = currentQuestion(state);
  if (!question) throw new Error("no current question to answer");
  const firstChoice = question.choices[0];
  if (!firstChoice) throw new Error("question has no choices");

  const selected = selectChoice(state, firstChoice.id);
  if (selected.status !== "ok") throw new Error(`select refused: ${selected.reason}`);
  const submitted = submitAnswer(selected.state);
  if (submitted.status !== "ok") throw new Error(`submit refused: ${submitted.reason}`);
  return submitted.state;
}

/** Answers and advances every question, returning the finished run. */
function walkWholeRun(state: TrainingRunState): TrainingRunState {
  let current = state;
  while (!isRunComplete(current)) {
    current = answerCurrent(current);
    const advanced = advanceToNextQuestion(current);
    if (advanced.status !== "ok") throw new Error(`advance refused: ${advanced.reason}`);
    current = advanced.state;
  }
  return current;
}

describe("run creation: exactly ten, or an explicit shortfall", () => {
  it("creates a run of exactly ten from a larger eligible pool", () => {
    const state = startRunOf(wideBank());
    expect(state.questions).toHaveLength(10);
    expect(new Set(state.questions.map((q) => q.questionId)).size).toBe(10);
    expect(runProgress(state)).toEqual({ position: 1, total: 10 });
    expect(answeredCount(state)).toBe(0);
  });

  it("reports insufficiency rather than creating a short run", () => {
    // Nine eligible questions cannot become a ten-question run, and must not
    // become a quiet nine-question one either.
    const result = selectTrainingQuestions(
      bankOf(Array.from({ length: 9 }, (_, i) => eligible(`Q-NINE-${i}`))),
      { count: 10 },
      createSeededRandom(1)
    );
    expect(result.status).toBe("insufficient-eligible-content");
    if (result.status !== "insufficient-eligible-content") return;
    expect(result.requested).toBe(10);
    expect(result.available).toBe(9);
  });

  it("counts only production-eligible content towards the ten", () => {
    const repo = bankOf([
      ...Array.from({ length: 10 }, (_, i) =>
        eligible(`Q-CAND-${i}`, { contentStatus: "candidate", reviewStatus: "pending", verification: undefined })
      ),
      ...Array.from({ length: 10 }, (_, i) => eligible(`Q-OK-${i}`))
    ]);
    const state = startRunOf(repo);
    expect(state.questions).toHaveLength(10);
    expect(state.questions.every((q) => q.questionId.startsWith("Q-OK-"))).toBe(true);
  });
});

describe("the selector runs once per run, never per question", () => {
  it("asks the bank for its pool exactly once while a run is created", () => {
    const { repo, calls } = countingBank(wideBank());
    startRunOf(repo);
    expect(calls()).toBe(1);
  });

  it("never re-consults the bank while the learner works through the run", () => {
    const { repo, calls } = countingBank(wideBank());
    const state = startRunOf(repo);
    const callsAfterCreation = calls();

    walkWholeRun(state);

    // Ten answers and nine advances later, the pool has not been asked for
    // again: the sequence was decided once.
    expect(calls()).toBe(callsAfterCreation);
  });

  it("keeps the selected sequence identical from first question to last", () => {
    const state = startRunOf(wideBank());
    const plannedOrder = state.questions.map((q) => q.questionId);

    let current = state;
    const seenInOrder: string[] = [];
    while (!isRunComplete(current)) {
      const question = currentQuestion(current);
      if (question) seenInOrder.push(question.questionId);
      current = answerCurrent(current);
      const advanced = advanceToNextQuestion(current);
      if (advanced.status !== "ok") break;
      current = advanced.state;
    }

    expect(seenInOrder).toEqual(plannedOrder);
    expect(current.questions.map((q) => q.questionId)).toEqual(plannedOrder);
  });
});

describe("progression: one question per advance, and none skipped", () => {
  it("advances exactly one question per accepted transition", () => {
    let state = startRunOf(wideBank());
    for (let expectedIndex = 0; expectedIndex < 10; expectedIndex++) {
      expect(state.index).toBe(expectedIndex);
      expect(runProgress(state).position).toBe(expectedIndex + 1);
      expect(answeredCount(state)).toBe(expectedIndex);

      state = answerCurrent(state);
      // Submitting does not advance: the learner keeps their feedback until
      // they choose to move on.
      expect(state.index).toBe(expectedIndex);
      expect(state.submission).not.toBeNull();

      const advanced = advanceToNextQuestion(state);
      expect(advanced.status).toBe("ok");
      state = advanced.state;
    }
    expect(isRunComplete(state)).toBe(true);
  });

  it("ignores repeated advance attempts on an answered question", () => {
    // The state machine is the guard: a burst of Next cannot skip ahead,
    // because only the first one finds a submission to advance past.
    let state = answerCurrent(startRunOf(wideBank()));
    const first = advanceToNextQuestion(state);
    expect(first.status).toBe("ok");
    state = first.state;
    expect(state.index).toBe(1);

    for (let i = 0; i < 5; i++) {
      const repeat = advanceToNextQuestion(state);
      expect(repeat.status).toBe("rejected");
      if (repeat.status === "rejected") expect(repeat.reason).toBe("not-submitted");
      state = repeat.state;
    }
    expect(state.index).toBe(1);
  });

  it("visits all ten distinct questions, skipping none", () => {
    const state = startRunOf(wideBank());
    const expectedIds = state.questions.map((q) => q.questionId);

    let current = state;
    const visited: string[] = [];
    while (!isRunComplete(current)) {
      const question = currentQuestion(current);
      if (question) visited.push(question.questionId);
      current = answerCurrent(current);
      const advanced = advanceToNextQuestion(current);
      if (advanced.status !== "ok") break;
      current = advanced.state;
    }

    expect(visited).toHaveLength(10);
    expect(visited).toEqual(expectedIds);
    expect(new Set(visited).size).toBe(10);
  });
});

describe("question ten is the end of the run", () => {
  function atLastQuestion(): TrainingRunState {
    let state = startRunOf(wideBank());
    for (let i = 0; i < 9; i++) {
      state = answerCurrent(state);
      const advanced = advanceToNextQuestion(state);
      if (advanced.status !== "ok") throw new Error("could not reach question 10");
      state = advanced.state;
    }
    return state;
  }

  it("reaches question ten with the run still open", () => {
    const state = atLastQuestion();
    expect(state.index).toBe(9);
    expect(runProgress(state)).toEqual({ position: 10, total: 10 });
    expect(isRunComplete(state)).toBe(false);
    expect(currentQuestion(state)).not.toBeNull();
  });

  it("keeps the tenth answer's feedback until the learner moves on", () => {
    const answered = answerCurrent(atLastQuestion());
    expect(answered.submission).not.toBeNull();
    expect(isRunComplete(answered)).toBe(false);
    expect(currentQuestion(answered)?.questionId).toBe(answered.questions[9]?.questionId);
  });

  it("completes on advancing past question ten, with ten of ten answered", () => {
    const advanced = advanceToNextQuestion(answerCurrent(atLastQuestion()));
    expect(advanced.status).toBe("ok");
    const done = advanced.state;

    expect(isRunComplete(done)).toBe(true);
    expect(answeredCount(done)).toBe(10);
    expect(done.questions).toHaveLength(10);
  });

  it("has no eleventh question, and does not wrap around to the first", () => {
    const done = walkWholeRun(startRunOf(wideBank()));
    expect(currentQuestion(done)).toBeNull();
    expect(done.index).toBe(10);
    // Wrapping would put index back at 0 and re-serve question one.
    expect(done.index).not.toBe(0);
    expect(done.questions[done.index]).toBeUndefined();
  });

  it("refuses every interaction after completion", () => {
    const done = walkWholeRun(startRunOf(wideBank()));
    const firstChoiceId = done.questions[0]?.choices[0]?.id ?? "a";

    for (const transition of [
      selectChoice(done, firstChoiceId),
      submitAnswer(done),
      advanceToNextQuestion(done)
    ]) {
      expect(transition.status).toBe("rejected");
      if (transition.status === "rejected") expect(transition.reason).toBe("run-complete");
      expect(transition.state).toBe(done);
    }
  });

  it("does not restart itself", () => {
    const done = walkWholeRun(startRunOf(wideBank()));
    // Nothing in the terminal state produces a new run; only an explicit call
    // to the selector can, and the finished state is inert.
    expect(isRunComplete(done)).toBe(true);
    expect(done.selectedChoiceId).toBeNull();
    expect(done.submission).toBeNull();
    expect(answeredCount(done)).toBe(10);
  });
});

describe("a new run inherits nothing", () => {
  it("starts clean after a completed run", () => {
    const bank = wideBank();
    const finished = walkWholeRun(startRunOf(bank, 1));
    expect(isRunComplete(finished)).toBe(true);

    const fresh = startRunOf(bank, 2);
    expect(fresh.index).toBe(0);
    expect(fresh.selectedChoiceId).toBeNull();
    expect(fresh.submission).toBeNull();
    expect(isRunComplete(fresh)).toBe(false);
    expect(answeredCount(fresh)).toBe(0);
    expect(runProgress(fresh)).toEqual({ position: 1, total: 10 });
  });

  it("re-consults the bank, because a new run is a new selection", () => {
    const { repo, calls } = countingBank(wideBank());
    walkWholeRun(startRunOf(repo, 1));
    const afterFirstRun = calls();

    startRunOf(repo, 2);
    expect(calls()).toBe(afterFirstRun + 1);
  });

  it("does not carry the previous run's questions into the new one by reference", () => {
    const bank = wideBank();
    const first = startRunOf(bank, 1);
    const second = startRunOf(bank, 2);
    expect(second.questions).not.toBe(first.questions);
    expect(second.questions).toHaveLength(10);
  });

  it("records no history: nothing accumulates across runs", () => {
    const bank = wideBank();
    for (let i = 0; i < 3; i++) {
      const finished = walkWholeRun(startRunOf(bank, i + 1));
      expect(finished.questions).toHaveLength(10);
      expect(answeredCount(finished)).toBe(10);
    }
    // The bank is exactly as it was: no question was marked used, seen or spent.
    expect(bank.getAll()).toHaveLength(12);
    expect(bank.getProductionEligible()).toHaveLength(12);
  });
});

describe("replay and determinism across runs", () => {
  it("reproduces the same sequence from the same seed", () => {
    const bank = wideBank();
    const a = startRunOf(bank, 4242).questions.map((q) => q.questionId);
    const b = startRunOf(bank, 4242).questions.map((q) => q.questionId);
    expect(a).toEqual(b);
  });

  it("allows a different seed to produce a different valid sequence", () => {
    const bank = wideBank();
    const sequences = [1, 2, 3, 4, 5, 6].map((seed) => startRunOf(bank, seed).questions.map((q) => q.questionId).join(","));
    // Not every seed must differ — that would be a false requirement — but the
    // selection must not be seed-blind.
    expect(new Set(sequences).size).toBeGreaterThan(1);
    for (const sequence of sequences) expect(sequence.split(",")).toHaveLength(10);
  });

  it("produces a valid run whatever the seed, never a padded or short one", () => {
    const bank = wideBank();
    for (const seed of [0, 7, 99, 1234, 65535]) {
      const questions = startRunOf(bank, seed).questions;
      expect(questions).toHaveLength(10);
      expect(new Set(questions.map((q) => q.questionId)).size).toBe(10);
      expect(questions.every((q) => q.contentStatus === "production-eligible")).toBe(true);
    }
  });

  it("keeps diversity a preference of the selector, not a guarantee of the run", () => {
    // Twelve questions across six variant groups: a run of ten cannot avoid
    // repeating a group, and must not fail because of it.
    const state = startRunOf(wideBank(), 11);
    expect(state.questions).toHaveLength(10);
    expect(new Set(state.questions.map((q) => q.variantGroup)).size).toBeGreaterThan(1);

    // A pool with no diversity at all still fills a run.
    const uniform = bankOf(Array.from({ length: 10 }, (_, i) => eligible(`Q-SAME-${i}`, { variantGroup: "ONE" })));
    expect(startRunOf(uniform).questions).toHaveLength(10);
  });
});
