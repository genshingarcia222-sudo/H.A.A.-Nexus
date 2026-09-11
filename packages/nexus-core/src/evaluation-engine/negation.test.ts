import { describe, expect, it } from "vitest";
import { deriveBareConcept, detectReversedNegative } from "./negation.js";

describe("deriveBareConcept", () => {
  it("strips 'denies' to get the bare concept", () => {
    expect(deriveBareConcept("denies fever")).toBe("fever");
  });

  it("strips 'no ' to get the bare concept", () => {
    expect(deriveBareConcept("no chest pain")).toBe("chest pain");
  });

  it("returns null for a phrase with no recognized negation cue", () => {
    expect(deriveBareConcept("chest pain")).toBeNull();
  });

  it("returns null for a bare negation cue with nothing left over", () => {
    expect(deriveBareConcept("afebrile")).toBeNull();
  });
});

describe("detectReversedNegative", () => {
  const variants = ["no fever", "denies fever", "afebrile"];
  const sourceFact = "denies fever";

  it("flags when the learner asserts the concept without any negation cue", () => {
    expect(detectReversedNegative("Fever present on exam.", variants, sourceFact)).toBe(true);
  });

  it("does not flag when the concept is correctly negated", () => {
    expect(detectReversedNegative("No fever noted.", variants, sourceFact)).toBe(false);
  });

  it("does not flag when the concept is absent from the text entirely (that's an omission, not a reversal)", () => {
    expect(detectReversedNegative("Reports mild cough.", variants, sourceFact)).toBe(false);
  });

  it("only checks the sentence containing the concept, not the whole text", () => {
    const text = "No chest pain. Fever present.";
    // "fever" appears without a cue in its own sentence -> should flag
    expect(detectReversedNegative(text, variants, sourceFact)).toBe(true);
  });
});
