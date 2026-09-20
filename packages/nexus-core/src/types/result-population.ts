import type { SimulationMode } from "../simulation-engine/types.js";

/**
 * Which body of results an attempt belongs to (decision D5, owner-selected
 * 2026-09-20).
 *
 * Practice and Assessment are **separate analytical and competency
 * populations**. They are not two labels over one record and not two filters
 * over one aggregate: a completed Assessment must never mutate, overwrite or
 * become indistinguishable from Practice competency, and neither may be
 * reconstructed from a merged total afterwards. The distinction is carried
 * through persistence and every domain calculation.
 *
 * They measure different things. Practice measures performance during
 * training activity; Assessment measures performance under formal exam
 * conditions. Both contain scores, which is not a reason to add them together.
 */
export type ResultPopulation = "practice" | "assessment";

export const RESULT_POPULATIONS: readonly ResultPopulation[] = ["practice", "assessment"] as const;

/**
 * The population a mode's results belong to.
 *
 * **Simulation counts as practice**, exactly where it has always counted. D5
 * separated Assessment from Practice and said nothing about simulation, so
 * moving it - into its own population, or into Assessment - would be deciding
 * something nobody decided. It stays with the training activity it is.
 */
export function resultPopulationFor(mode: SimulationMode): ResultPopulation {
  return mode === "assessment" ? "assessment" : "practice";
}
