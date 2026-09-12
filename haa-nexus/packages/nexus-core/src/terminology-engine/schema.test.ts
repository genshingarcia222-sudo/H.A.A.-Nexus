import { describe, expect, it } from "vitest";
import { validateTerminologyEntry } from "./schema.js";

const validEntry = {
  id: "dry-cough-nonproductive",
  layTerm: "dry cough",
  clinicalTerm: "non-productive cough",
  acceptedAlternatives: ["non-productive cough", "cough without sputum"],
  category: "Respiratory",
  explanation: "A cough that does not produce sputum or mucus.",
  commonMistakes: ["Documenting 'dry cough' verbatim instead of clinical terminology."]
};

describe("validateTerminologyEntry", () => {
  it("accepts a well-formed entry", () => {
    const result = validateTerminologyEntry(validEntry);
    expect(result.success).toBe(true);
  });

  it("rejects an entry missing a clinical term", () => {
    const { clinicalTerm, ...rest } = validEntry;
    const result = validateTerminologyEntry(rest);
    expect(result.success).toBe(false);
  });

  it("defaults acceptedAlternatives and commonMistakes to empty arrays when omitted", () => {
    const { acceptedAlternatives, commonMistakes, ...rest } = validEntry;
    const result = validateTerminologyEntry(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acceptedAlternatives).toEqual([]);
      expect(result.data.commonMistakes).toEqual([]);
    }
  });
});
