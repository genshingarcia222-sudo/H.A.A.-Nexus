import type { SessionRecord } from "../persistence/types.js";
import type { CompetencyRecord } from "../competency-engine/index.js";
import type { AnalyticsSummary, CompetencySnapshot, ErrorTrendEntry, PerformanceTrend } from "./types.js";

const TREND_TOLERANCE = 3;
const MIN_SESSIONS_FOR_TREND = 4;
const TOP_N_AREAS = 3;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Sessions are assumed newest-first, matching SessionRepository.list()'s
 * contract. Splits evaluated sessions into a recent half and an older half
 * and compares their averages, using the same tolerance-band approach as
 * the competency engine's trend calculation, for consistency.
 */
function computeTrend(scoresNewestFirst: number[]): PerformanceTrend {
  if (scoresNewestFirst.length < MIN_SESSIONS_FOR_TREND) return "insufficient-data";

  const midpoint = Math.floor(scoresNewestFirst.length / 2);
  const recent = scoresNewestFirst.slice(0, midpoint);
  const older = scoresNewestFirst.slice(midpoint);

  const recentAvg = average(recent);
  const olderAvg = average(older);

  if (recentAvg > olderAvg + TREND_TOLERANCE) return "up";
  if (recentAvg < olderAvg - TREND_TOLERANCE) return "down";
  return "flat";
}

/**
 * Computes the full analytics summary from data that already exists in
 * SessionRepository and CompetencyRepository - deliberately no separate
 * analytics store or duplicated data (Architecture Package Section 18).
 * Every figure traces to a real evaluated session or competency record;
 * nothing here is synthesized for display.
 */
export function computeAnalytics(
  sessionsNewestFirst: SessionRecord[],
  competencyRecords: CompetencyRecord[],
  totalScenarioCount: number
): AnalyticsSummary {
  const evaluated = sessionsNewestFirst.filter(
    // Defensive: excludes any record where evaluation exists but its score
    // is malformed (NaN, non-finite) rather than letting it silently poison
    // the average - real evaluations from evaluateAttempt() always produce
    // a finite number, but this guards against corrupted/partial data.
    (s) => s.evaluation !== null && Number.isFinite(s.evaluation.overallScore)
  );
  const scores = evaluated.map((s) => s.evaluation!.overallScore);

  const attemptedScenarioIds = new Set(sessionsNewestFirst.map((s) => s.scenarioId));

  const errorCounts = new Map<string, number>();
  for (const session of evaluated) {
    // Defensive: session.evaluation.errors is typed as always-present, but
    // this guards against malformed/incomplete data that could reach here
    // from an imperfect deserialization (e.g. a future migration, or a
    // partially-written record) without crashing the whole analytics view.
    const errors = session.evaluation!.errors ?? [];
    for (const error of errors) {
      errorCounts.set(error.errorType, (errorCounts.get(error.errorType) ?? 0) + 1);
    }
  }
  const errorTrends: ErrorTrendEntry[] = Array.from(errorCounts.entries())
    .map(([errorType, count]) => ({ errorType: errorType as ErrorTrendEntry["errorType"], count }))
    .sort((a, b) => b.count - a.count);

  const attemptedCompetencies = competencyRecords.filter((c) => c.attemptCount > 0);
  const sortedByScore = [...attemptedCompetencies].sort((a, b) => a.avgScore - b.avgScore);
  const toSnapshot = (c: CompetencyRecord): CompetencySnapshot => ({
    domain: c.domain,
    level: c.level,
    avgScore: c.avgScore,
    attemptCount: c.attemptCount
  });

  return {
    sessionsEvaluated: evaluated.length,
    averageScore: scores.length > 0 ? average(scores) : null,
    trend: computeTrend(scores),
    weakestAreas: sortedByScore.slice(0, TOP_N_AREAS).map(toSnapshot),
    strongestAreas: sortedByScore
      .slice(-TOP_N_AREAS)
      .reverse()
      .map(toSnapshot),
    errorTrends,
    scenarioProgress: {
      attempted: attemptedScenarioIds.size,
      total: totalScenarioCount
    }
  };
}
