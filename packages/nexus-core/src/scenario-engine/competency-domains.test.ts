import { describe, expect, it } from "vitest";
import { COMPETENCY_DOMAINS, DEFAULT_SCORING_WEIGHTS } from "./types.js";

/**
 * A2 — the competency domains have exactly one declaration.
 *
 * A2 was not a disagreement about which domains are right. It was two lists:
 * the module registry declared 12 section-level labels, the evaluator scored 7
 * categories, and nothing read the registry's, so the drift could never be
 * caught by use. The registry's list is gone and these are the survivors.
 *
 * `satisfies readonly (keyof ScoringWeights)[]` already makes a mismatch a
 * compile error. These tests cover what the compiler cannot: that the list is
 * *complete*, not merely a valid subset.
 */
describe("COMPETENCY_DOMAINS", () => {
  it("names every scoring weight, so no domain can be silently left unscored", () => {
    // The compiler rejects a domain that is not a weight. It would happily
    // accept a list missing one - which would mean a category the evaluator
    // produces never reaching a competency record.
    expect([...COMPETENCY_DOMAINS].sort()).toEqual(Object.keys(DEFAULT_SCORING_WEIGHTS).sort());
  });

  it("declares each domain once", () => {
    expect(new Set(COMPETENCY_DOMAINS).size).toBe(COMPETENCY_DOMAINS.length);
  });

  it("is the seven the evaluator actually produces", () => {
    // Pinned explicitly: changing this set changes what competency *means* and
    // what is stored in every CompetencyRecord, which A2 deliberately did not
    // do. Per-section competency remains a product decision with a migration.
    expect([...COMPETENCY_DOMAINS].sort()).toEqual([
      "accuracy",
      "completeness",
      "pertinentPosNeg",
      "relevance",
      "structure",
      "terminology",
      "timeEfficiency"
    ]);
  });
});
