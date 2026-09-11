import { DEFAULT_SCORING_WEIGHTS, type ScoringWeights } from "./types.js";

export interface WeightsResolutionResult {
  success: boolean;
  weights?: ScoringWeights;
  error?: string;
}

const WEIGHT_SUM_TOLERANCE = 0.001;

/**
 * The UI never contains a weight or a threshold (Architecture Package
 * Section 12) — it only ever renders whatever this function (or the future
 * full evaluation engine that calls it) produces. Scenario-specific
 * overrides are merged onto the platform default here, not hardcoded per
 * scenario in application code.
 */
export function resolveScoringWeights(overrides?: Partial<ScoringWeights>): WeightsResolutionResult {
  const merged: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...overrides };
  const sum = Object.values(merged).reduce((acc, v) => acc + v, 0);

  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    return {
      success: false,
      error: `Resolved scoring weights must sum to 1.0, got ${sum.toFixed(4)}`
    };
  }

  return { success: true, weights: merged };
}
