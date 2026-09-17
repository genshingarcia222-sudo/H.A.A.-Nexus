import {
  difficultyLabel,
  minimumTierForDifficulty,
  TIER_LABELS,
  type Scenario
} from "@haa-nexus/nexus-core";

/**
 * The one explanation shown wherever a scenario is locked - in the library
 * card, and when a retry or resume is refused. Kept in one place so the
 * wording cannot drift between entry points.
 *
 * States what access level includes the scenario and nothing more: no
 * price, no countdown, no scarcity claim (Business Model Spec Section 5 UX
 * requirement). The tier is derived from the capability matrix via
 * `minimumTierForDifficulty`, never hard-coded here.
 */
export function lockedScenarioMessage(scenario: Scenario): string {
  const tier = minimumTierForDifficulty(scenario.difficulty);
  const level = difficultyLabel(scenario.difficulty);
  return tier
    ? `${level} scenarios are included with ${TIER_LABELS[tier]}.`
    : `${level} scenarios are not included in any current access level.`;
}
