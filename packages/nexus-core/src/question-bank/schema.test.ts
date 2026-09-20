import { describe, expect, it } from "vitest";
import { DIFFICULTY_LEVELS } from "../scenario-engine/difficulty.js";
import {
  CONTENT_STATUSES,
  LIFECYCLE_PROGRESSION,
  QUESTION_DIFFICULTY_LEVELS,
  isAboveCandidate,
  isProductionEligible,
  lifecycleRank
} from "./schema.js";
import { validateTrainingQuestion } from "./validate.js";
import { fullyPopulatedQuestion, minimalQuestion } from "./__fixtures__/questions.js";

function expectValid(raw: unknown) {
  const result = validateTrainingQuestion(raw);
  if (!result.success) throw new Error(`expected a valid question, got:\n  ${result.errors.join("\n  ")}`);
  return result.data;
}

describe("question bank schema: shapes it must accept", () => {
  it("accepts a minimally valid question", () => {
    expect(expectValid(minimalQuestion).questionId).toBe("Q-MIN-0001");
  });

  it("accepts a fully populated question", () => {
    expect(validateTrainingQuestion(fullyPopulatedQuestion).success).toBe(true);
  });

  it("accepts a question whose source is a shared ref, and one that carries its source inline", () => {
    expect(expectValid(minimalQuestion).source).toEqual({
      ref: "HHS-PR-SUMMARY",
      locator: "Heading 'What Information is Protected'"
    });
    const inline = expectValid({
      ...minimalQuestion,
      source: { authority: "U.S. HHS Office for Civil Rights", title: "Summary of the HIPAA Privacy Rule", locator: "p. 4" }
    });
    expect(inline.source).toEqual({
      authority: "U.S. HHS Office for Civil Rights",
      title: "Summary of the HIPAA Privacy Rule",
      locator: "p. 4"
    });
  });

  it("accepts a question with per-choice explanations alongside the rationale", () => {
    const parsed = expectValid(fullyPopulatedQuestion);
    expect(parsed.rationale).toBe(minimalQuestion.rationale);
    // Mapped rather than indexed: `noUncheckedIndexedAccess` is on, and this
    // asserts both explanations survive rather than only the first.
    expect(parsed.choices.map((c) => c.why)).toEqual([
      "Correct: that is the term HHS uses.",
      "A document, not the name for the information."
    ]);
  });

  it("accepts a question with a variantGroup", () => {
    expect(expectValid(fullyPopulatedQuestion).variantGroup).toBe("ICD-FY-EFFECTIVE-PERIOD");
  });

  it("accepts an ICD question carrying a codingReference", () => {
    expect(expectValid(fullyPopulatedQuestion).codingReference).toEqual(fullyPopulatedQuestion.codingReference);
  });

  it("accepts a non-ICD question with no codingReference, rather than forcing empty coding fields on it", () => {
    expect(expectValid(minimalQuestion).codingReference).toBeUndefined();
  });

  it("defaults only flags, and never invents a verification record", () => {
    const parsed = expectValid(minimalQuestion);
    expect(parsed.flags).toEqual([]);
    // The absence of verification must stay an absence: a defaulted record
    // would read as "checked by nobody, on no date" and could be mistaken for
    // a completed check.
    expect(parsed.verification).toBeUndefined();
  });

  it("accepts every declared question type and difficulty level", () => {
    for (const questionType of ["recognition", "recall", "interpretation", "scenario", "workflow-sequencing"]) {
      expect(validateTrainingQuestion({ ...minimalQuestion, questionType }).success).toBe(true);
    }
    for (const difficultyLevel of QUESTION_DIFFICULTY_LEVELS) {
      expect(validateTrainingQuestion({ ...minimalQuestion, difficultyLevel }).success).toBe(true);
    }
  });
});

describe("question bank lifecycle model", () => {
  it("orders the progression and keeps hold states off the ladder", () => {
    expect(lifecycleRank("candidate")).toBe(0);
    expect(lifecycleRank("production-eligible")).toBe(LIFECYCLE_PROGRESSION.length - 1);
    expect(lifecycleRank("blocked")).toBe(-1);
    expect(lifecycleRank("retired")).toBe(-1);

    expect(isAboveCandidate("candidate")).toBe(false);
    expect(isAboveCandidate("source-verified")).toBe(true);
    expect(isAboveCandidate("blocked")).toBe(false);
  });

  it("treats no status other than a fully verified production-eligible one as shippable", () => {
    for (const contentStatus of CONTENT_STATUSES) {
      const question = {
        ...minimalQuestion,
        contentStatus,
        reviewStatus: "approved",
        verification: {
          humanVerificationRequired: true,
          humanVerifiedBy: "A. Reviewer",
          humanVerifiedOn: "2026-09-19"
        }
      };
      const result = validateTrainingQuestion(question);
      if (!result.success) continue;
      expect(isProductionEligible(result.data)).toBe(contentStatus === "production-eligible");
    }
  });

  it("refuses to call a question shippable on a label alone", () => {
    // contentStatus says production-eligible, but the review has not concluded.
    const parsed = expectValid({
      ...minimalQuestion,
      contentStatus: "production-eligible",
      reviewStatus: "in-review",
      verification: { humanVerificationRequired: true, humanVerifiedBy: "A. Reviewer", humanVerifiedOn: "2026-09-19" }
    });
    expect(isProductionEligible(parsed)).toBe(false);
  });
});

describe("difficulty scale agreement", () => {
  it("uses the same 1-6 scale as the scenario side", () => {
    // Restated rather than imported (see schema.ts). This test is the seam: if
    // either side ever changes its scale, this fails loudly instead of the two
    // quietly meaning different things by "level 4".
    expect([...QUESTION_DIFFICULTY_LEVELS]).toEqual(DIFFICULTY_LEVELS.map((d) => d.level));
  });
});
