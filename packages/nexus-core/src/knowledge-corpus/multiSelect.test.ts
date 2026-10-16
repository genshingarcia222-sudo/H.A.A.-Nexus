import { describe, expect, it } from "vitest";
import { AssessmentItemSchema, RESPONSE_FORMATS } from "./item.js";
import { expectedSelection, isFullyCorrect, scoreSelection } from "./scoring.js";

/**
 * O5 — multi-select is carried, and scored all-or-nothing.
 *
 * Decided 2026-10-14 under the owner's standing authorisation and since
 * authorised directly: 15 of the 432 authored knowledgebase records are
 * genuinely multi-select, each with exactly two correct choices. Dropping them,
 * re-authoring them without a reviewer, or holding them back were all rejected.
 *
 * The scoring rule is **all-or-nothing**. What these tests mostly guard is the
 * ways that rule could be weakened without anyone noticing: an extra wrong
 * selection being filtered away, a single id being accepted as a complete
 * answer through the inherited `correctChoiceId`, or a multi-select set sitting
 * ignored on a single-answer item.
 */

const base = {
  questionId: "NEXUS-L2-PRIV-000004",
  family: "ITEM" as const,
  revision: 1,
  domain: "Medical Scribing",
  skillArea: "Privacy & Confidentiality",
  difficultyLevel: 2 as const,
  questionType: "recall" as const,
  learningObjective: "Identify the disclosures the minimum necessary standard does not apply to.",
  question: "Which disclosures are outside the minimum necessary standard?",
  choices: [
    { id: "a", text: "A disclosure to the patient themselves" },
    { id: "b", text: "A disclosure required by law" },
    { id: "c", text: "A disclosure to a colleague for interest" },
    { id: "d", text: "A disclosure to a marketing firm" }
  ],
  correctChoiceId: "a",
  rationale: "The Rule lists both among its exceptions.",
  source: { ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" },
  modality: "DIRECT_KNOWLEDGE" as const,
  contentStatus: "candidate" as const,
  reviewStatus: "pending" as const,
  provenance: {
    generationMethod: "MACHINE_DRAFTED" as const,
    authoredBy: "machine:claude-code",
    authoredOn: "2026-09-21"
  }
};

const parse = (overrides: Record<string, unknown> = {}) =>
  AssessmentItemSchema.safeParse({ ...base, ...overrides });

const multi = (overrides: Record<string, unknown> = {}) =>
  parse({ responseFormat: "MULTI_SELECT", correctChoiceIds: ["a", "b"], ...overrides });

/** A parsed multi-select item, for the scoring tests. */
function multiItem() {
  const r = multi();
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
}

function singleItem() {
  const r = parse();
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
}

describe("O5: the contract accepts multi-select, additively", () => {
  it("offers MULTI_SELECT as a response format", () => {
    expect(RESPONSE_FORMATS).toContain("MULTI_SELECT");
    expect(RESPONSE_FORMATS).toContain("SINGLE_BEST_ANSWER");
  });

  it("accepts a well-formed multi-select item", () => {
    const r = multi();
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (!r.success) return;
    expect(r.data.correctChoiceIds).toEqual(["a", "b"]);
    expect(r.data.responseFormat).toBe("MULTI_SELECT");
  });

  it("BACKWARD COMPATIBILITY: an existing single-answer item is untouched", () => {
    // The 303 array-form records that hold one id, and every pre-existing item,
    // must keep behaving exactly as they did. This is the regression that
    // matters most, because O5 touched a shared schema.
    const r = parse();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.responseFormat).toBe("SINGLE_BEST_ANSWER");
    expect(r.data.correctChoiceIds).toBeUndefined();
  });

  it("serialises and re-parses without losing the set", () => {
    const item = multiItem();
    const round = AssessmentItemSchema.safeParse(JSON.parse(JSON.stringify(item)));
    expect(round.success, round.success ? "" : JSON.stringify(round.error?.issues)).toBe(true);
    if (!round.success) return;
    expect(round.data.correctChoiceIds).toEqual(["a", "b"]);
    expect(round.data.correctChoiceId).toBe("a");
  });
});

describe("O5: the format and the set must agree, in both directions", () => {
  it("rejects MULTI_SELECT with no set, which would score as a single answer", () => {
    const r = parse({ responseFormat: "MULTI_SELECT" });
    expect(r.success).toBe(false);
  });

  it("rejects a set on a single-answer item, which would be silently ignored", () => {
    const r = parse({ correctChoiceIds: ["a", "b"] });
    expect(r.success).toBe(false);
  });

  it("rejects a set naming a choice that does not exist", () => {
    expect(multi({ correctChoiceIds: ["a", "zzz"] }).success).toBe(false);
  });

  it("rejects a repeated id in the set", () => {
    expect(multi({ correctChoiceIds: ["a", "a"] }).success).toBe(false);
  });

  it("rejects a set of one, which is a single answer wearing a costume", () => {
    expect(multi({ correctChoiceIds: ["a"] }).success).toBe(false);
  });

  it("rejects marking every choice correct", () => {
    expect(multi({ correctChoiceIds: ["a", "b", "c", "d"] }).success).toBe(false);
  });

  it("requires correctChoiceId to be inside the set", () => {
    // Otherwise the inherited field - which a pre-multi-select consumer still
    // reads - would point at a wrong answer.
    expect(multi({ correctChoiceIds: ["b", "c"], correctChoiceId: "a" }).success).toBe(false);
    expect(multi({ correctChoiceIds: ["a", "b"], correctChoiceId: "a" }).success).toBe(true);
  });
});

describe("O5: all-or-nothing scoring", () => {
  it("gives credit for exactly the expected set, in any order", () => {
    const item = multiItem();
    expect(scoreSelection(item, ["a", "b"]).credit).toBe(1);
    expect(scoreSelection(item, ["b", "a"]).credit).toBe(1);
    expect(isFullyCorrect(item, ["b", "a"])).toBe(true);
  });

  it("gives NOTHING for an incomplete answer", () => {
    const item = multiItem();
    const score = scoreSelection(item, ["a"]);
    expect(score.credit).toBe(0);
    expect(score.reason).toBe("incomplete");
  });

  it("gives NOTHING when a wrong choice is added to the right ones", () => {
    // The headline rule. A learner who selects everything must not score as a
    // learner who knew the answer.
    const item = multiItem();
    const score = scoreSelection(item, ["a", "b", "d"]);
    expect(score.credit).toBe(0);
    expect(score.reason).toBe("extra-selection");
  });

  it("does not silently filter an invalid selection into a correct one", () => {
    // If `zzz` were quietly dropped, this would score 1. That is the exact
    // "silent filtering or normalization" O5 forbids.
    const item = multiItem();
    const score = scoreSelection(item, ["a", "b", "zzz"]);
    expect(score.credit).toBe(0);
    expect(score.reason).toBe("unknown-choice");
  });

  it("does not normalise a duplicate selection into a correct one", () => {
    const item = multiItem();
    const score = scoreSelection(item, ["a", "b", "b"]);
    expect(score.credit).toBe(0);
    expect(score.reason).toBe("duplicate-selection");
  });

  it("gives nothing for an empty selection", () => {
    expect(scoreSelection(multiItem(), []).reason).toBe("empty-selection");
  });

  it("NEVER scores a multi-select item from correctChoiceId alone", () => {
    // `correctChoiceId` is "a" and is a genuinely correct choice, so a consumer
    // that only knew about single answers would accept ["a"] as complete. The
    // scorer must not.
    const item = multiItem();
    expect(item.correctChoiceId).toBe("a");
    expect(scoreSelection(item, [item.correctChoiceId]).credit).toBe(0);
  });

  it("reports the expected set so a learner can be told what was missed", () => {
    const score = scoreSelection(multiItem(), ["a"]);
    expect(score.expected).toEqual(["a", "b"]);
    expect(score.selected).toEqual(["a"]);
  });

  it("is deterministic: the same inputs give the same score", () => {
    const item = multiItem();
    const a = scoreSelection(item, ["a", "d"]);
    const b = scoreSelection(item, ["a", "d"]);
    expect(a).toEqual(b);
  });
});

describe("O5: single-answer scoring is unchanged", () => {
  it("credits the correct single choice", () => {
    expect(scoreSelection(singleItem(), ["a"]).credit).toBe(1);
  });

  it("gives nothing for the wrong single choice", () => {
    expect(scoreSelection(singleItem(), ["b"]).credit).toBe(0);
  });

  it("refuses two selections on a single-answer item", () => {
    const score = scoreSelection(singleItem(), ["a", "b"]);
    expect(score.credit).toBe(0);
    expect(score.reason).toBe("multiple-for-single-answer");
  });

  it("expectedSelection falls back to the single correct id", () => {
    expect(expectedSelection(singleItem())).toEqual(["a"]);
    expect(expectedSelection(multiItem())).toEqual(["a", "b"]);
  });
});
