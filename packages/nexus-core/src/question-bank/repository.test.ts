import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryQuestionBankRepository } from "./repository.js";
import type { TrainingQuestion } from "./schema.js";
import { validateTrainingQuestion } from "./validate.js";
import { fullyPopulatedQuestion, minimalQuestion } from "./__fixtures__/questions.js";

/** Fixtures go through the real validator, so the repository only ever holds valid records. */
function asQuestion(raw: unknown): TrainingQuestion {
  const result = validateTrainingQuestion(raw);
  if (!result.success) throw new Error(`fixture does not validate:\n  ${result.errors.join("\n  ")}`);
  return result.data;
}

const candidate = asQuestion(minimalQuestion);
const icdCandidate = asQuestion(fullyPopulatedQuestion);

/** The only shape that is genuinely cleared for a learner: promoted, reviewed, and signed for. */
const approved = asQuestion({
  ...minimalQuestion,
  questionId: "Q-APPROVED-0001",
  contentStatus: "production-eligible",
  reviewStatus: "approved",
  verification: {
    humanVerificationRequired: true,
    humanVerifiedBy: "A. Reviewer",
    humanVerifiedOn: "2026-09-19"
  }
});

describe("InMemoryQuestionBankRepository", () => {
  let repo: InMemoryQuestionBankRepository;
  beforeEach(() => {
    repo = new InMemoryQuestionBankRepository();
  });

  it("starts empty", () => {
    expect(repo.getAll()).toEqual([]);
    expect(repo.getProductionEligible()).toEqual([]);
    expect(repo.getById("Q-MIN-0001")).toBeUndefined();
    expect(repo.size).toBe(0);
  });

  it("retrieves a question by id", () => {
    repo.register(candidate);
    expect(repo.getById("Q-MIN-0001")?.question).toBe(minimalQuestion.question);
  });

  it("returns undefined for an id it does not hold", () => {
    repo.register(candidate);
    expect(repo.getById("Q-NOT-HERE")).toBeUndefined();
  });

  it("lists every registered question", () => {
    repo.register(candidate);
    repo.register(icdCandidate);
    expect(repo.getAll()).toHaveLength(2);
    expect(repo.size).toBe(2);
  });

  it("registers a whole bank in file order", () => {
    repo.registerBank({
      bankId: "TEST-BANK",
      version: "1",
      sources: {},
      questions: [candidate, icdCandidate, approved]
    });
    expect(repo.getAll().map((q) => q.questionId)).toEqual(["Q-MIN-0001", "Q-FULL-0001", "Q-APPROVED-0001"]);
  });

  it("refuses a duplicate id rather than overwriting", () => {
    // Overwriting would make one question silently disappear, and with a
    // citation attached that is a question whose source no longer matches it.
    repo.register(candidate);
    expect(() => repo.register(candidate)).toThrow(/already registered/);
    expect(repo.size).toBe(1);
  });

  it("reads deterministically: same order every time, a fresh array each call", () => {
    repo.register(icdCandidate);
    repo.register(candidate);
    repo.register(approved);

    const first = repo.getAll();
    const second = repo.getAll();
    expect(first.map((q) => q.questionId)).toEqual(second.map((q) => q.questionId));
    expect(first.map((q) => q.questionId)).toEqual(["Q-FULL-0001", "Q-MIN-0001", "Q-APPROVED-0001"]);

    // A consumer sorting or splicing what it was handed must not disturb the
    // next reader.
    first.reverse();
    first.pop();
    expect(repo.getAll().map((q) => q.questionId)).toEqual(["Q-FULL-0001", "Q-MIN-0001", "Q-APPROVED-0001"]);
  });
});

describe("InMemoryQuestionBankRepository: content is not mutable through it", () => {
  it("hands out frozen records", () => {
    const repo = new InMemoryQuestionBankRepository();
    repo.register(candidate);
    const stored = repo.getById("Q-MIN-0001");
    expect(stored).toBeDefined();
    if (!stored) return;

    const [firstChoice] = stored.choices;
    expect(firstChoice).toBeDefined();
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.choices)).toBe(true);
    expect(Object.isFrozen(firstChoice)).toBe(true);

    // Promotion by assignment is the failure this prevents.
    expect(() => {
      (stored as { contentStatus: string }).contentStatus = "production-eligible";
    }).toThrow();
    expect(repo.getById("Q-MIN-0001")?.contentStatus).toBe("candidate");
  });

  it("stores a private copy, leaving the caller's own object untouched", () => {
    const repo = new InMemoryQuestionBankRepository();
    const source = asQuestion({ ...minimalQuestion, questionId: "Q-SOURCE-0001" });
    repo.register(source);

    // Registering must not freeze the caller's object as a side effect.
    expect(Object.isFrozen(source)).toBe(false);

    source.question = "mutated after registration";
    expect(repo.getById("Q-SOURCE-0001")?.question).toBe(minimalQuestion.question);
  });
});

describe("InMemoryQuestionBankRepository: content status is observable, and gates nothing by accident", () => {
  it("keeps candidate and review status exactly as registered", () => {
    const repo = new InMemoryQuestionBankRepository();
    repo.register(candidate);
    const stored = repo.getById("Q-MIN-0001");
    expect(stored?.contentStatus).toBe("candidate");
    expect(stored?.reviewStatus).toBe("pending");
    expect(stored?.verification).toBeUndefined();
  });

  it("serves candidates from getAll but never from getProductionEligible", () => {
    // Development and validation tooling needs to see candidates. A
    // learner-facing consumer asks the other question.
    const repo = new InMemoryQuestionBankRepository();
    repo.register(candidate);
    repo.register(icdCandidate);

    expect(repo.getAll()).toHaveLength(2);
    expect(repo.getProductionEligible()).toEqual([]);
  });

  it("includes a question only once it is promoted, reviewed and signed for", () => {
    const repo = new InMemoryQuestionBankRepository();
    repo.register(candidate);
    repo.register(approved);

    expect(repo.getProductionEligible().map((q) => q.questionId)).toEqual(["Q-APPROVED-0001"]);
  });

  it("excludes a question labelled production-eligible whose review has not concluded", () => {
    const repo = new InMemoryQuestionBankRepository();
    repo.register(
      asQuestion({
        ...minimalQuestion,
        questionId: "Q-LABELLED-ONLY",
        contentStatus: "production-eligible",
        reviewStatus: "in-review",
        verification: {
          humanVerificationRequired: true,
          humanVerifiedBy: "A. Reviewer",
          humanVerifiedOn: "2026-09-19"
        }
      })
    );
    expect(repo.getProductionEligible()).toEqual([]);
  });
});
