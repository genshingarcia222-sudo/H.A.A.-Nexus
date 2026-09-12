import { describe, expect, it } from "vitest";
import { evaluateRequirement } from "./requirement-evaluator.js";
import { createEmptyDraft } from "../simulation-engine/documentation-draft.js";
import type { RequirementItem } from "../scenario-engine/types.js";

const feverNegative: RequirementItem = {
  id: "req-neg-fever",
  section: "ros",
  description: "Document absence of fever",
  sourceFact: "denies fever",
  acceptableVariants: ["no fever", "afebrile", "denies fever"],
  isPertinentNegative: true
};

const dyspneaRequirement: RequirementItem = {
  id: "req-pos-dyspnea",
  section: "ros",
  description: "Document exertional dyspnea",
  sourceFact: "shortness of breath on exertion",
  acceptableVariants: ["exertional dyspnea", "dyspnea on exertion"]
};

describe("evaluateRequirement", () => {
  it("satisfies via an exact acceptable variant in the correct section", () => {
    const draft = { ...createEmptyDraft(), ros: "No fever. Denies chest pain." };
    const result = evaluateRequirement(feverNegative, draft);
    expect(result.found).toBe(true);
    expect(result.foundInSection).toBe("ros");
    expect(result.isWrongSection).toBe(false);
    expect(result.usedRawLayTerm).toBe(false);
  });

  it("flags usedRawLayTerm when the learner copies the sourceFact verbatim instead of a clinical variant", () => {
    const draft = { ...createEmptyDraft(), ros: "Shortness of breath on exertion noted." };
    const result = evaluateRequirement(dyspneaRequirement, draft);
    expect(result.found).toBe(true);
    expect(result.usedRawLayTerm).toBe(true);
  });

  it("flags isWrongSection when the match is found in a different section", () => {
    const draft = { ...createEmptyDraft(), hpi: "Exertional dyspnea reported." };
    const result = evaluateRequirement(dyspneaRequirement, draft);
    expect(result.found).toBe(true);
    expect(result.isWrongSection).toBe(true);
    expect(result.foundInSection).toBe("hpi");
  });

  it("reports a plain omission when the concept never appears anywhere", () => {
    const draft = createEmptyDraft();
    const result = evaluateRequirement(feverNegative, draft);
    expect(result.found).toBe(false);
    expect(result.negationReversed).toBe(false);
  });

  it("flags negationReversed when the bare concept is asserted without negation", () => {
    const draft = { ...createEmptyDraft(), ros: "Fever present on exam." };
    const result = evaluateRequirement(feverNegative, draft);
    expect(result.found).toBe(false);
    expect(result.negationReversed).toBe(true);
  });

  it("does not check for reversal on non-pertinent-negative requirements", () => {
    // "exertional dyspnea" mentioned without a negation cue is just a
    // (differently worded) omission for a positive-finding requirement,
    // not a "reversal" concept, since isPertinentNegative is unset.
    const draft = createEmptyDraft();
    const result = evaluateRequirement(dyspneaRequirement, draft);
    expect(result.negationReversed).toBe(false);
  });
});
