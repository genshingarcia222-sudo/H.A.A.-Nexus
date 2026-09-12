import { scenarioSchema } from "./schema.js";
import type { Scenario } from "./types.js";
import { resolveScoringWeights } from "./weights.js";

export type ScenarioValidationResult =
  | { success: true; data: Scenario }
  | { success: false; errors: string[] };

/**
 * The only path by which scenario JSON becomes a trusted `Scenario` object.
 * Nothing downstream (evaluation engine, UI) should accept raw scenario
 * JSON that hasn't been through this — a missing sourceFact, an
 * out-of-range difficulty, or an unresolvable scoringRules override are all
 * hard failures here, not warnings (Architecture Package Section 29).
 */
export function validateScenario(raw: unknown): ScenarioValidationResult {
  const parsed = scenarioSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    };
  }

  const scenario = parsed.data as Scenario;

  // Schema-level checks pass, but the weights must also actually resolve
  // against the platform default (covers partial overrides, which the
  // schema's own sum-check intentionally skips — see schema.ts).
  const weightsResult = resolveScoringWeights(scenario.scoringRules);
  if (!weightsResult.success) {
    return { success: false, errors: [weightsResult.error ?? "Unresolvable scoring weights"] };
  }

  return { success: true, data: scenario };
}
