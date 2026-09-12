import { describe, expect, it } from "vitest";
import { resolveScoringWeights } from "./weights.js";
import { DEFAULT_SCORING_WEIGHTS } from "./types.js";

describe("resolveScoringWeights", () => {
  it("returns the platform default when no override is given", () => {
    const result = resolveScoringWeights();
    expect(result.success).toBe(true);
    expect(result.weights).toEqual(DEFAULT_SCORING_WEIGHTS);
  });

  it("merges a partial override that preserves the 1.0 sum", () => {
    const result = resolveScoringWeights({ accuracy: 0.3, completeness: 0.15 });
    expect(result.success).toBe(true);
    expect(result.weights?.accuracy).toBe(0.3);
    expect(result.weights?.completeness).toBe(0.15);
    // untouched weights keep their default value
    expect(result.weights?.terminology).toBe(DEFAULT_SCORING_WEIGHTS.terminology);
  });

  it("fails when the merged weights don't sum to 1.0", () => {
    const result = resolveScoringWeights({ accuracy: 0.9 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sum to 1\.0/);
  });
});
