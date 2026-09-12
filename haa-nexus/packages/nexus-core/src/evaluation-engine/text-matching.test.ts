import { describe, expect, it } from "vitest";
import { normalizeText, containsPhrase, findFirstMatch, splitSentences } from "./text-matching.js";

describe("normalizeText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeText("  No   FEVER  ")).toBe("no fever");
  });
});

describe("containsPhrase", () => {
  it("matches regardless of case and spacing", () => {
    expect(containsPhrase("Patient denies FEVER today", "denies fever")).toBe(true);
  });

  it("returns false when the phrase isn't present", () => {
    expect(containsPhrase("Patient reports cough", "denies fever")).toBe(false);
  });

  it("returns false for an empty needle rather than matching everything", () => {
    expect(containsPhrase("anything", "")).toBe(false);
  });
});

describe("findFirstMatch", () => {
  it("returns the first variant found", () => {
    expect(findFirstMatch("No fever noted.", ["afebrile", "no fever", "denies fever"])).toBe("no fever");
  });

  it("returns null when no variant matches", () => {
    expect(findFirstMatch("Patient reports fever.", ["afebrile", "no fever", "denies fever"])).toBeNull();
  });
});

describe("splitSentences", () => {
  it("splits on sentence punctuation", () => {
    expect(splitSentences("No fever. Denies chest pain.")).toEqual(["No fever.", "Denies chest pain."]);
  });
});
