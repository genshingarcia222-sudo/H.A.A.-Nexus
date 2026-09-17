import type { SessionRecord } from "../persistence/types.js";

export interface Recommendation {
  id: string;
  reason: string;
  recommendedType: "lesson" | "scenario";
  recommendedId: string;
  createdAt: number;
}

interface RecommendationRule {
  id: string;
  /** Checks aggregated error counts (see aggregateErrorCounts below) from recent history. */
  matches: (counts: Record<string, number>) => boolean;
  recommendedType: "lesson" | "scenario";
  recommendedId: string | ((currentScenarioId: string) => string);
  reason: string;
}

/**
 * Counts both by bare errorType (e.g. "omission") and by "errorType:section"
 * (e.g. "omission:hpi"), so rules can be as targeted or as broad as the
 * spec's own examples ("repeated HPI omissions" is section-specific;
 * "terminology errors" is not).
 */
function aggregateErrorCounts(recentSessions: SessionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of recentSessions) {
    if (!session.evaluation) continue;
    for (const error of session.evaluation.errors) {
      counts[error.errorType] = (counts[error.errorType] ?? 0) + 1;
      const sectionKey = `${error.errorType}:${error.section}`;
      counts[sectionKey] = (counts[sectionKey] ?? 0) + 1;
    }
  }
  return counts;
}

const RULES: RecommendationRule[] = [
  {
    id: "repeated-hpi-omission",
    matches: (counts) => (counts["omission:hpi"] ?? 0) >= 2,
    recommendedType: "lesson",
    recommendedId: "hpi-fundamentals",
    reason: "Repeated omissions in the HPI section across recent attempts."
  },
  {
    id: "repeated-terminology-errors",
    matches: (counts) => (counts["incorrect_terminology"] ?? 0) >= 2,
    recommendedType: "lesson",
    recommendedId: "medical-terminology",
    reason: "Repeated use of lay phrasing instead of clinical terminology."
  },
  {
    id: "repeated-time-failures",
    matches: (counts) => (counts["time_management"] ?? 0) >= 2,
    recommendedType: "scenario",
    recommendedId: (currentScenarioId) => currentScenarioId,
    reason: "Repeated documentation times well over target - timed practice will help."
  },
  {
    id: "fabrication-detected",
    // Fabrication is Critical severity by design (Architecture Package
    // Section 15/17) - it triggers remediation on a single occurrence,
    // unlike the "repeated" rules above.
    matches: (counts) => (counts["fabrication"] ?? 0) >= 1,
    recommendedType: "lesson",
    recommendedId: "accuracy-and-unsupported-inference",
    reason: "Documented clinical information that the encounter never provided."
  }
];

/**
 * Generates recommendations from the most recent `lookback` evaluated
 * sessions (Architecture Package Section 23 - deterministic rule-based
 * adaptation; AI may enhance this later, per Section 12, but nothing here
 * requires it).
 */
export function generateRecommendations(
  sessionHistory: SessionRecord[],
  currentScenarioId: string,
  now: number,
  lookback = 5
): Recommendation[] {
  const evaluated = sessionHistory.filter((s) => s.evaluation).slice(0, lookback);
  const counts = aggregateErrorCounts(evaluated);

  const recommendations: Recommendation[] = [];
  for (const rule of RULES) {
    if (rule.matches(counts)) {
      recommendations.push({
        // Derived from the rule, not a counter: each rule fires at most once
        // per call, so this is unique within the result and identical every
        // time the same history is evaluated (Phase 7 accepted debt A1).
        id: `rec:${rule.id}`,
        reason: rule.reason,
        recommendedType: rule.recommendedType,
        recommendedId:
          typeof rule.recommendedId === "function" ? rule.recommendedId(currentScenarioId) : rule.recommendedId,
        createdAt: now
      });
    }
  }
  return recommendations;
}
