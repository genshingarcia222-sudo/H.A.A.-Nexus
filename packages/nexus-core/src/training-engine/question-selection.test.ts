import { describe, expect, it } from "vitest";
import { InMemoryQuestionBankRepository } from "../question-bank/repository.js";
import { validateTrainingQuestion } from "../question-bank/validate.js";
import type { TrainingQuestion } from "../question-bank/schema.js";
import { minimalQuestion } from "../question-bank/__fixtures__/questions.js";
import {
  DEFAULT_TRAINING_RUN_SIZE,
  createSeededRandom,
  createTrainingQuestionSelector,
  selectTrainingQuestions
} from "./question-selection.js";

/**
 * Selection fixtures are structural variants of the one existing bank fixture:
 * ids and classification metadata differ, the clinical text does not. No
 * medical content is authored here — that belongs to the content archive under
 * its source rules, not to a test file.
 */

interface Variant {
  id: string;
  difficultyLevel?: number;
  domain?: string;
  skillArea?: string;
  questionType?: string;
  learningObjective?: string;
  variantGroup?: string;
  eligible?: boolean;
}

const VERIFIED = {
  humanVerificationRequired: true,
  humanVerifiedBy: "A. Reviewer",
  humanVerifiedOn: "2026-09-19"
};

function question(variant: Variant): TrainingQuestion {
  const { id, eligible = true, ...overrides } = variant;
  const raw = {
    ...minimalQuestion,
    ...overrides,
    questionId: id,
    ...(eligible
      ? { contentStatus: "production-eligible", reviewStatus: "approved", verification: VERIFIED }
      : { contentStatus: "candidate", reviewStatus: "pending" })
  };
  const result = validateTrainingQuestion(raw);
  if (!result.success) throw new Error(`fixture ${id} does not validate:\n  ${result.errors.join("\n  ")}`);
  return result.data;
}

function repositoryOf(variants: Variant[]): InMemoryQuestionBankRepository {
  const repo = new InMemoryQuestionBankRepository();
  for (const variant of variants) repo.register(question(variant));
  return repo;
}

/** Twelve eligible questions spread across domains, skills, types and levels. */
function wideRepository(): InMemoryQuestionBankRepository {
  const domains = ["Medical Scribing", "ICD"];
  const skills = ["Privacy & Confidentiality", "Lookup Literacy", "Specificity"];
  const types = ["recognition", "recall", "interpretation", "scenario"];
  return repositoryOf(
    Array.from({ length: 12 }, (_, i) => ({
      id: `Q-WIDE-${String(i).padStart(3, "0")}`,
      domain: domains[i % domains.length],
      skillArea: skills[i % skills.length],
      questionType: types[i % types.length],
      learningObjective: `Objective ${i % 6}`,
      variantGroup: `GROUP-${i % 6}`,
      difficultyLevel: (i % 3) + 1
    }))
  );
}

function expectSuccess(result: ReturnType<typeof selectTrainingQuestions>): TrainingQuestion[] {
  if (result.status !== "success") {
    throw new Error(`expected a successful selection, got ${result.status}: ${JSON.stringify(result)}`);
  }
  return result.questions;
}

describe("training question selection: a ten-question run", () => {
  it("defaults to ten questions", () => {
    expect(DEFAULT_TRAINING_RUN_SIZE).toBe(10);
    const questions = expectSuccess(selectTrainingQuestions(wideRepository(), {}, createSeededRandom(1)));
    expect(questions).toHaveLength(10);
  });

  it("never repeats a question inside a run", () => {
    const questions = expectSuccess(selectTrainingQuestions(wideRepository(), {}, createSeededRandom(7)));
    expect(new Set(questions.map((q) => q.questionId)).size).toBe(questions.length);
  });

  it("returns exactly the requested count, never more", () => {
    const repo = wideRepository();
    for (const count of [1, 3, 10, 12]) {
      expect(expectSuccess(selectTrainingQuestions(repo, { count }, createSeededRandom(2)))).toHaveLength(count);
    }
  });

  it("reports insufficiency rather than padding a short pool", () => {
    // Seven eligible questions, ten requested. Repeating three to reach ten
    // would be a run the learner cannot trust.
    const repo = repositoryOf(Array.from({ length: 7 }, (_, i) => ({ id: `Q-SMALL-${i}` })));
    const result = selectTrainingQuestions(repo, {}, createSeededRandom(1));
    expect(result.status).toBe("insufficient-eligible-content");
    if (result.status !== "insufficient-eligible-content") return;
    expect(result.requested).toBe(10);
    expect(result.available).toBe(7);
  });

  it("reports insufficiency for an empty bank", () => {
    const result = selectTrainingQuestions(new InMemoryQuestionBankRepository(), {}, createSeededRandom(1));
    expect(result.status).toBe("insufficient-eligible-content");
    if (result.status !== "insufficient-eligible-content") return;
    expect(result.available).toBe(0);
  });
});

describe("training question selection: eligibility", () => {
  it("never selects candidate content", () => {
    const repo = repositoryOf([
      ...Array.from({ length: 10 }, (_, i) => ({ id: `Q-CANDIDATE-${i}`, eligible: false })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `Q-READY-${i}` }))
    ]);
    const questions = expectSuccess(selectTrainingQuestions(repo, {}, createSeededRandom(3)));
    expect(questions).toHaveLength(10);
    expect(questions.every((q) => q.questionId.startsWith("Q-READY-"))).toBe(true);
    expect(questions.every((q) => q.contentStatus === "production-eligible")).toBe(true);
  });

  it("treats a bank of candidates as an empty pool", () => {
    // The Pilot 001 situation exactly: plenty of content, none of it cleared.
    const repo = repositoryOf(Array.from({ length: 12 }, (_, i) => ({ id: `Q-PILOTLIKE-${i}`, eligible: false })));
    expect(repo.getAll()).toHaveLength(12);

    const result = selectTrainingQuestions(repo, {}, createSeededRandom(1));
    expect(result.status).toBe("insufficient-eligible-content");
    if (result.status !== "insufficient-eligible-content") return;
    expect(result.available).toBe(0);
  });

  it("honours a caller-supplied exclusion list without storing it", () => {
    const repo = wideRepository();
    const excludeQuestionIds = ["Q-WIDE-000", "Q-WIDE-001"];
    const questions = expectSuccess(selectTrainingQuestions(repo, { count: 10, excludeQuestionIds }, createSeededRandom(4)));
    expect(questions.map((q) => q.questionId)).not.toContain("Q-WIDE-000");
    expect(questions.map((q) => q.questionId)).not.toContain("Q-WIDE-001");

    // Nothing was remembered: an identical later call without the list may
    // return those ids again.
    const pool = expectSuccess(selectTrainingQuestions(repo, { count: 12 }, createSeededRandom(4)));
    expect(pool.map((q) => q.questionId)).toContain("Q-WIDE-000");
  });

  it("reports insufficiency when exclusions shrink the pool below the run", () => {
    const repo = wideRepository();
    const excludeQuestionIds = Array.from({ length: 5 }, (_, i) => `Q-WIDE-${String(i).padStart(3, "0")}`);
    const result = selectTrainingQuestions(repo, { excludeQuestionIds }, createSeededRandom(1));
    expect(result.status).toBe("insufficient-eligible-content");
    if (result.status !== "insufficient-eligible-content") return;
    expect(result.available).toBe(7);
  });
});

describe("training question selection: filtering", () => {
  it("filters by difficulty, and never substitutes another level", () => {
    const repo = repositoryOf([
      ...Array.from({ length: 6 }, (_, i) => ({ id: `Q-L2-${i}`, difficultyLevel: 2 })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `Q-L5-${i}`, difficultyLevel: 5 }))
    ]);

    const questions = expectSuccess(selectTrainingQuestions(repo, { count: 6, difficultyLevels: [2] }, createSeededRandom(5)));
    expect(questions.every((q) => q.difficultyLevel === 2)).toBe(true);

    // Six at level 2 exist but ten were asked for. Widening to level 5 to fill
    // the run would misrepresent what the learner practised.
    const short = selectTrainingQuestions(repo, { difficultyLevels: [2] }, createSeededRandom(5));
    expect(short.status).toBe("insufficient-eligible-content");
    if (short.status !== "insufficient-eligible-content") return;
    expect(short.available).toBe(6);
  });

  it("accepts several difficulty levels at once", () => {
    const repo = repositoryOf([
      ...Array.from({ length: 5 }, (_, i) => ({ id: `Q-A-${i}`, difficultyLevel: 1 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `Q-B-${i}`, difficultyLevel: 3 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `Q-C-${i}`, difficultyLevel: 6 }))
    ]);
    const questions = expectSuccess(
      selectTrainingQuestions(repo, { count: 10, difficultyLevels: [1, 3] }, createSeededRandom(6))
    );
    expect(questions.every((q) => q.difficultyLevel === 1 || q.difficultyLevel === 3)).toBe(true);
  });

  it("filters by domain and by skill area", () => {
    const repo = wideRepository();
    const byDomain = expectSuccess(selectTrainingQuestions(repo, { count: 6, domains: ["ICD"] }, createSeededRandom(8)));
    expect(byDomain.every((q) => q.domain === "ICD")).toBe(true);

    const bySkill = expectSuccess(
      selectTrainingQuestions(repo, { count: 4, skillAreas: ["Lookup Literacy"] }, createSeededRandom(8))
    );
    expect(bySkill.every((q) => q.skillArea === "Lookup Literacy")).toBe(true);
  });
});

describe("training question selection: determinism", () => {
  it("returns the same run for the same request and the same seed", () => {
    const repo = wideRepository();
    const first = expectSuccess(selectTrainingQuestions(repo, { count: 10 }, createSeededRandom(42)));
    const second = expectSuccess(selectTrainingQuestions(repo, { count: 10 }, createSeededRandom(42)));
    expect(first.map((q) => q.questionId)).toEqual(second.map((q) => q.questionId));
  });

  it("can return a different valid run for a different seed", () => {
    const repo = wideRepository();
    const runs = [11, 22, 33, 44, 55].map((seed) =>
      expectSuccess(selectTrainingQuestions(repo, { count: 10 }, createSeededRandom(seed)))
        .map((q) => q.questionId)
        .join(",")
    );
    // Not every seed must differ, but the selector must not be seed-blind.
    expect(new Set(runs).size).toBeGreaterThan(1);
  });

  it("uses only the injected source, never ambient randomness", () => {
    // A fixed source makes the run a pure function of the pool and the request.
    const repo = wideRepository();
    const alwaysZero = () => 0;
    const a = expectSuccess(selectTrainingQuestions(repo, { count: 10 }, alwaysZero));
    const b = expectSuccess(selectTrainingQuestions(repo, { count: 10 }, alwaysZero));
    expect(a.map((q) => q.questionId)).toEqual(b.map((q) => q.questionId));
  });
});

describe("training question selection: diversity", () => {
  it("spreads a run across variant groups when the pool allows", () => {
    // Twelve questions in six variant groups; a ten-question run cannot avoid
    // some repetition, but it must not pile onto one group.
    const questions = expectSuccess(selectTrainingQuestions(wideRepository(), { count: 6 }, createSeededRandom(9)));
    expect(new Set(questions.map((q) => q.variantGroup)).size).toBe(6);
  });

  it("prefers unseen skill areas and question types over repeats", () => {
    const repo = repositoryOf([
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `Q-SAME-${i}`,
        skillArea: "Privacy & Confidentiality",
        questionType: "recognition",
        variantGroup: "GROUP-SAME"
      })),
      { id: "Q-OTHER-1", skillArea: "Lookup Literacy", questionType: "recall", variantGroup: "GROUP-OTHER-1" },
      { id: "Q-OTHER-2", skillArea: "Specificity", questionType: "scenario", variantGroup: "GROUP-OTHER-2" }
    ]);

    const questions = expectSuccess(selectTrainingQuestions(repo, { count: 3 }, createSeededRandom(12)));
    // The two distinct questions are cheaper than a third from the crowded
    // group, so both must appear in a three-question run.
    expect(questions.map((q) => q.questionId)).toContain("Q-OTHER-1");
    expect(questions.map((q) => q.questionId)).toContain("Q-OTHER-2");
  });

  it("still fills the run when the pool offers no diversity at all", () => {
    // Diversity is a preference. A uniform pool yields a full run rather than
    // an error: refusing here would turn a content-shape problem into a
    // learner-visible failure.
    const repo = repositoryOf(
      Array.from({ length: 10 }, (_, i) => ({ id: `Q-UNIFORM-${i}`, variantGroup: "GROUP-ONE" }))
    );
    const questions = expectSuccess(selectTrainingQuestions(repo, {}, createSeededRandom(13)));
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((q) => q.questionId)).size).toBe(10);
  });

  it("never lets diversity override a hard filter", () => {
    const repo = repositoryOf([
      ...Array.from({ length: 10 }, (_, i) => ({ id: `Q-L1-${i}`, difficultyLevel: 1, variantGroup: "GROUP-ONE" })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `Q-L4-${i}`, difficultyLevel: 4, variantGroup: `GROUP-${i}` }))
    ]);
    // Level 1 is uniform and level 4 is varied; the filter still wins.
    const questions = expectSuccess(selectTrainingQuestions(repo, { difficultyLevels: [1] }, createSeededRandom(14)));
    expect(questions).toHaveLength(10);
    expect(questions.every((q) => q.difficultyLevel === 1)).toBe(true);
  });
});

describe("training question selection: invalid requests", () => {
  const repo = wideRepository();

  function errorsFor(request: Parameters<typeof selectTrainingQuestions>[1]): string[] {
    const result = selectTrainingQuestions(repo, request, createSeededRandom(1));
    expect(result.status, `expected invalid-request, got ${result.status}`).toBe("invalid-request");
    return result.status === "invalid-request" ? result.errors : [];
  }

  it("rejects a non-positive or fractional count", () => {
    expect(errorsFor({ count: 0 }).join()).toMatch(/count must be a positive integer/);
    expect(errorsFor({ count: -5 }).join()).toMatch(/count/);
    expect(errorsFor({ count: 2.5 }).join()).toMatch(/count/);
  });

  it("rejects a difficulty outside the 1-6 scale", () => {
    expect(errorsFor({ difficultyLevels: [7 as never] }).join()).toMatch(/outside the 1-6 scale/);
    expect(errorsFor({ difficultyLevels: [0 as never] }).join()).toMatch(/outside the 1-6 scale/);
  });

  it("rejects empty filter lists rather than reading them as no filter", () => {
    expect(errorsFor({ difficultyLevels: [] }).join()).toMatch(/at least one level/);
    expect(errorsFor({ domains: [] }).join()).toMatch(/at least one value/);
    expect(errorsFor({ skillAreas: [] }).join()).toMatch(/at least one value/);
  });

  it("rejects blank filter values", () => {
    expect(errorsFor({ domains: [""] }).join()).toMatch(/non-empty strings/);
    expect(errorsFor({ excludeQuestionIds: [""] }).join()).toMatch(/non-empty strings/);
  });

  it("refuses an invalid request before looking at the pool", () => {
    // An empty bank plus an invalid count must report the request problem, not
    // insufficiency: the caller's bug is the actionable one.
    const result = selectTrainingQuestions(new InMemoryQuestionBankRepository(), { count: 0 }, createSeededRandom(1));
    expect(result.status).toBe("invalid-request");
  });
});

describe("training question selection: it changes nothing", () => {
  it("returns the bank's own frozen records, unmodified", () => {
    const repo = wideRepository();
    const before = repo.getAll().map((q) => JSON.stringify(q));

    const questions = expectSuccess(selectTrainingQuestions(repo, {}, createSeededRandom(15)));
    for (const question of questions) {
      expect(Object.isFrozen(question)).toBe(true);
      expect(question.contentStatus).toBe("production-eligible");
    }

    expect(repo.getAll().map((q) => JSON.stringify(q))).toEqual(before);
    expect(repo.getAll()).toHaveLength(12);
  });

  it("does not disturb the pool for the next caller", () => {
    const repo = wideRepository();
    const first = expectSuccess(selectTrainingQuestions(repo, { count: 10 }, createSeededRandom(16)));
    first.reverse();
    const second = expectSuccess(selectTrainingQuestions(repo, { count: 10 }, createSeededRandom(16)));
    expect(second).toHaveLength(10);
    expect(repo.getAll()).toHaveLength(12);
  });
});

describe("createTrainingQuestionSelector", () => {
  it("binds a repository and a source, and defaults the run to ten", () => {
    const selector = createTrainingQuestionSelector(wideRepository(), createSeededRandom(21));
    const result = selector.select();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.questions).toHaveLength(10);
  });
});

describe("Training runtime integration: bank to repository to run", () => {
  it("produces a ten-question run from loaded bank content", async () => {
    // The whole chain, with no UI: validated bank content -> repository ->
    // selector -> ten questions. Nothing scores, records or gates here.
    const { createQuestionBankRepository } = await import("../question-bank/loader.js");

    const bank = {
      bankId: "INTEGRATION-BANK",
      version: "1",
      sources: {
        "HHS-PR-SUMMARY": {
          authority: "U.S. HHS Office for Civil Rights",
          title: "Summary of the HIPAA Privacy Rule"
        }
      },
      questions: Array.from({ length: 12 }, (_, i) => ({
        ...minimalQuestion,
        questionId: `Q-INT-${i}`,
        variantGroup: `GROUP-${i % 6}`,
        contentStatus: "production-eligible",
        reviewStatus: "approved",
        verification: VERIFIED
      }))
    };

    const loaded = createQuestionBankRepository([{ file: "integration.json", contents: JSON.stringify(bank) }]);
    expect(loaded.success, loaded.success ? "" : `bank did not load:\n  ${loaded.errors.join("\n  ")}`).toBe(true);
    if (!loaded.success) return;

    const result = createTrainingQuestionSelector(loaded.repository, createSeededRandom(99)).select();
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.questions).toHaveLength(DEFAULT_TRAINING_RUN_SIZE);
    expect(new Set(result.questions.map((q) => q.questionId)).size).toBe(DEFAULT_TRAINING_RUN_SIZE);
  });
});
