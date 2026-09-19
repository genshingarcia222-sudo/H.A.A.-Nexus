import { describe, expect, it } from "vitest";
import { isProductionEligible } from "./schema.js";
import { validateQuestionBank, validateTrainingQuestion } from "./validate.js";
import { fullyPopulatedQuestion, minimalQuestion } from "./__fixtures__/questions.js";

function errorsFor(raw: unknown): string[] {
  const result = validateTrainingQuestion(raw);
  expect(result.success, "expected this question to be rejected, but it validated").toBe(false);
  return result.success ? [] : result.errors;
}

function without(question: Record<string, unknown>, key: string) {
  const { [key]: _removed, ...rest } = question;
  return rest;
}

describe("question bank validator: malformed records are rejected", () => {
  it("rejects a question with no id", () => {
    expect(errorsFor(without(minimalQuestion, "questionId")).join("\n")).toMatch(/questionId/);
  });

  it("rejects a question with no question text, and an empty one", () => {
    expect(errorsFor(without(minimalQuestion, "question")).join("\n")).toMatch(/question/);
    expect(errorsFor({ ...minimalQuestion, question: "" }).join("\n")).toMatch(/question/);
  });

  it("rejects a question with no choices, or only one", () => {
    expect(errorsFor({ ...minimalQuestion, choices: [] }).join("\n")).toMatch(/choices/);
    expect(errorsFor({ ...minimalQuestion, choices: [{ id: "a", text: "Only one" }] }).join("\n")).toMatch(/choices/);
  });

  it("rejects duplicate choice ids", () => {
    const errors = errorsFor({
      ...minimalQuestion,
      choices: [
        { id: "a", text: "First" },
        { id: "a", text: "Second" }
      ]
    });
    expect(errors.join("\n")).toMatch(/Duplicate choice id "a"/);
  });

  it("rejects a correct-answer reference that matches no choice", () => {
    // The failure the current knowledge-check shape allows: an answer key
    // pointing at an option that is not there.
    const errors = errorsFor({ ...minimalQuestion, correctChoiceId: "z" });
    expect(errors.join("\n")).toMatch(/correctChoiceId "z" does not match any choice id/);
  });

  it("rejects an empty choice text and an empty choice id", () => {
    expect(errorsFor({ ...minimalQuestion, choices: [{ id: "a", text: "" }, { id: "b", text: "B" }] }).join("\n")).toMatch(
      /choices\.0\.text/
    );
    expect(errorsFor({ ...minimalQuestion, choices: [{ id: "", text: "A" }, { id: "b", text: "B" }] }).join("\n")).toMatch(
      /choices\.0\.id/
    );
  });

  it("rejects a malformed source: neither a complete ref nor a complete inline citation", () => {
    expect(errorsFor({ ...minimalQuestion, source: { ref: "HHS-PR-SUMMARY" } }).join("\n")).toMatch(/source/);
    expect(errorsFor({ ...minimalQuestion, source: { authority: "HHS", locator: "p. 4" } }).join("\n")).toMatch(/source/);
    expect(errorsFor({ ...minimalQuestion, source: "HHS summary" }).join("\n")).toMatch(/source/);
    // Half ref, half inline: guessing which one the author meant would be worse
    // than saying so.
    expect(
      errorsFor({ ...minimalQuestion, source: { ref: "HHS-PR-SUMMARY", locator: "p. 4", authority: "HHS" } }).join("\n")
    ).toMatch(/source/);
  });

  it("rejects a question with no rationale", () => {
    expect(errorsFor(without(minimalQuestion, "rationale")).join("\n")).toMatch(/rationale/);
  });

  it("rejects an invalid lifecycle state and an invalid review state", () => {
    expect(errorsFor({ ...minimalQuestion, contentStatus: "PRODUCTION-READY" }).join("\n")).toMatch(/contentStatus/);
    expect(errorsFor({ ...minimalQuestion, reviewStatus: "done" }).join("\n")).toMatch(/reviewStatus/);
  });

  it("rejects an invalid difficulty: out of range, fractional, or a string", () => {
    expect(errorsFor({ ...minimalQuestion, difficultyLevel: 7 }).join("\n")).toMatch(/difficultyLevel/);
    expect(errorsFor({ ...minimalQuestion, difficultyLevel: 0 }).join("\n")).toMatch(/difficultyLevel/);
    expect(errorsFor({ ...minimalQuestion, difficultyLevel: 2.5 }).join("\n")).toMatch(/difficultyLevel/);
    expect(errorsFor({ ...minimalQuestion, difficultyLevel: "2" }).join("\n")).toMatch(/difficultyLevel/);
  });

  it("rejects an invalid question type", () => {
    expect(errorsFor({ ...minimalQuestion, questionType: "multiple-choice" }).join("\n")).toMatch(/questionType/);
  });

  it("rejects malformed ICD metadata", () => {
    expect(
      errorsFor({ ...minimalQuestion, codingReference: { system: "ICD-10-CM", jurisdiction: "US" } }).join("\n")
    ).toMatch(/codingReference\.release/);
    expect(
      errorsFor({
        ...minimalQuestion,
        codingReference: { system: "ICD-10-CM", jurisdiction: "US", release: "FY2027", codes: [""] }
      }).join("\n")
    ).toMatch(/codingReference\.codes/);
    expect(
      errorsFor({
        ...minimalQuestion,
        codingReference: { system: "ICD-10-CM", jurisdiction: "US", release: "FY2027", effectiveFrom: "Oct 2026" }
      }).join("\n")
    ).toMatch(/effectiveFrom/);
  });

  it("rejects a malformed verification record and a non-ISO date", () => {
    expect(
      errorsFor({ ...minimalQuestion, verification: { humanVerifiedBy: null, humanVerifiedOn: null } }).join("\n")
    ).toMatch(/humanVerificationRequired/);
    expect(
      errorsFor({
        ...minimalQuestion,
        verification: { humanVerificationRequired: true, humanVerifiedBy: "A. Reviewer", humanVerifiedOn: "19/09/2026" }
      }).join("\n")
    ).toMatch(/humanVerifiedOn/);
  });

  it("rejects an empty flag string rather than carrying a blank flag", () => {
    expect(errorsFor({ ...minimalQuestion, flags: [""] }).join("\n")).toMatch(/flags/);
  });
});

describe("question bank validator: no silent field loss", () => {
  it("rejects an unknown field instead of stripping it", () => {
    // This is the whole point of the bank being strict. The lesson schema drops
    // unknown keys without a word, which is how a rationale or a provenance
    // block could be authored, accepted, and then simply not exist.
    const errors = errorsFor({ ...minimalQuestion, tier: "pro" });
    expect(errors.join("\n")).toMatch(/tier/);
    expect(errors.join("\n")).toMatch(/[Uu]nrecognized|[Uu]nrecognised/);
  });

  it("rejects an unknown field nested inside a choice, a source or a coding reference", () => {
    expect(
      errorsFor({ ...minimalQuestion, choices: [{ id: "a", text: "A", colour: "green" }, { id: "b", text: "B" }] }).join("\n")
    ).toMatch(/colour/);
    expect(
      errorsFor({ ...minimalQuestion, source: { ref: "HHS-PR-SUMMARY", locator: "p. 4", page: 4 } }).join("\n")
    ).toMatch(/source/);
    expect(
      errorsFor({
        ...minimalQuestion,
        codingReference: { system: "ICD-10-CM", jurisdiction: "US", release: "FY2027", chapter: "I" }
      }).join("\n")
    ).toMatch(/chapter/);
  });
});

describe("question bank validator: validation preserves every canonical field", () => {
  it("returns a fully populated question unchanged", () => {
    const result = validateTrainingQuestion(fullyPopulatedQuestion);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const q = result.data;
    expect(q.questionId).toBe(fullyPopulatedQuestion.questionId);
    expect(q.question).toBe(fullyPopulatedQuestion.question);
    expect(q.choices).toEqual(fullyPopulatedQuestion.choices);
    expect(q.correctChoiceId).toBe(fullyPopulatedQuestion.correctChoiceId);
    expect(q.rationale).toBe(fullyPopulatedQuestion.rationale);
    expect(q.source).toEqual(fullyPopulatedQuestion.source);
    expect(q.difficultyLevel).toBe(fullyPopulatedQuestion.difficultyLevel);
    expect(q.domain).toBe(fullyPopulatedQuestion.domain);
    expect(q.skillArea).toBe(fullyPopulatedQuestion.skillArea);
    expect(q.questionType).toBe(fullyPopulatedQuestion.questionType);
    expect(q.learningObjective).toBe(fullyPopulatedQuestion.learningObjective);
    expect(q.contentStatus).toBe(fullyPopulatedQuestion.contentStatus);
    expect(q.reviewStatus).toBe(fullyPopulatedQuestion.reviewStatus);
    expect(q.variantGroup).toBe(fullyPopulatedQuestion.variantGroup);
    expect(q.validUntil).toBe(fullyPopulatedQuestion.validUntil);
    expect(q.flags).toEqual(fullyPopulatedQuestion.flags);
    expect(q.verification).toEqual(fullyPopulatedQuestion.verification);
    expect(q.codingReference).toEqual(fullyPopulatedQuestion.codingReference);

    // Nothing added, nothing dropped.
    expect(Object.keys(q).sort()).toEqual(Object.keys(fullyPopulatedQuestion).sort());
  });
});

describe("question bank validator: a candidate cannot become production-eligible by being parsed", () => {
  it("leaves a candidate a candidate", () => {
    const result = validateTrainingQuestion(minimalQuestion);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.contentStatus).toBe("candidate");
    expect(result.data.reviewStatus).toBe("pending");
    expect(isProductionEligible(result.data)).toBe(false);
  });

  it("rejects any status above candidate with no recorded human verification", () => {
    for (const contentStatus of ["source-verified", "content-reviewed", "approved", "production-eligible"]) {
      // No verification block at all.
      expect(errorsFor({ ...minimalQuestion, contentStatus }).join("\n")).toMatch(/requires a recorded human verification/);
      // A verification block that records only that verification is *needed*.
      expect(
        errorsFor({
          ...minimalQuestion,
          contentStatus,
          verification: { humanVerificationRequired: true, humanVerifiedBy: null, humanVerifiedOn: null }
        }).join("\n")
      ).toMatch(/requires a recorded human verification/);
    }
  });

  it("accepts a promoted question only once a person is recorded against it", () => {
    const result = validateTrainingQuestion({
      ...minimalQuestion,
      contentStatus: "source-verified",
      reviewStatus: "in-review",
      verification: {
        locatorConfidence: "PRIMARY-REGULATION-EXTRACT",
        humanVerificationRequired: true,
        humanVerifiedBy: "A. Reviewer",
        humanVerifiedOn: "2026-09-19"
      }
    });
    expect(result.success).toBe(true);
    if (result.success) expect(isProductionEligible(result.data)).toBe(false);
  });
});

describe("question bank container", () => {
  const bank = {
    bankId: "TEST-BANK",
    version: "1",
    sources: {
      "HHS-PR-SUMMARY": {
        authority: "U.S. HHS Office for Civil Rights",
        title: "Summary of the HIPAA Privacy Rule",
        url: "https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html"
      }
    },
    questions: [minimalQuestion]
  };

  it("accepts a well-formed bank and defaults an absent sources table", () => {
    expect(validateQuestionBank(bank).success).toBe(true);
    const inlineOnly = validateQuestionBank({
      bankId: "TEST-BANK",
      version: "1",
      questions: [
        { ...minimalQuestion, source: { authority: "HHS", title: "Summary of the HIPAA Privacy Rule", locator: "p. 4" } }
      ]
    });
    expect(inlineOnly.success).toBe(true);
    if (inlineOnly.success) expect(inlineOnly.data.sources).toEqual({});
  });

  it("rejects duplicate question ids within a bank", () => {
    const result = validateQuestionBank({ ...bank, questions: [minimalQuestion, { ...minimalQuestion }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.join("\n")).toMatch(/Duplicate question id "Q-MIN-0001"/);
  });

  it("rejects a source ref that no sources entry defines", () => {
    const result = validateQuestionBank({ ...bank, sources: {} });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.join("\n")).toMatch(/is not defined in the bank's sources/);
  });

  it("rejects an empty bank and an unknown container field", () => {
    expect(validateQuestionBank({ ...bank, questions: [] }).success).toBe(false);
    expect(validateQuestionBank({ ...bank, entitlementTier: "pro" }).success).toBe(false);
  });
});
