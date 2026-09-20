export type CompetencyLevel = "unassessed" | "introduced" | "developing" | "competent" | "advanced" | "mastered";
export type CompetencyTrend = "up" | "down" | "flat";

import type { ResultPopulation } from "../types/result-population.js";

export interface CompetencyRecord {
  /**
   * Which body of results this record aggregates (decision D5). Practice and
   * Assessment are separate populations, so the same learner and domain has
   * up to one record per population and they never merge.
   */
  population: ResultPopulation;
  domain: string;
  level: CompetencyLevel;
  avgScore: number;
  recentScore: number;
  trend: CompetencyTrend;
  attemptCount: number;
  /** 0..1, grows toward 1 as attemptCount approaches the 10-attempt evidence ceiling. */
  confidence: number;
  /** Rolling window (last 10) of scores, used to compute avgScore/trend. */
  recentScores: number[];
  updatedAt: number;
}

const ROLLING_WINDOW = 10;
const TREND_TOLERANCE = 3;

/**
 * Level thresholds (Architecture Package Section 14). Checked from the
 * strictest level down so a record only ever lands on the highest level
 * whose full condition (both attempt count and average score) is met.
 */
function computeLevel(avgScore: number, attemptCount: number, trend: CompetencyTrend): CompetencyLevel {
  if (attemptCount === 0) return "unassessed";
  if (attemptCount >= 10 && avgScore >= 95 && trend !== "down") return "mastered";
  if (attemptCount >= 8 && avgScore >= 88) return "advanced";
  if (attemptCount >= 5 && avgScore >= 75) return "competent";
  if (attemptCount >= 3 && avgScore >= 50) return "developing";
  return "introduced";
}

export function createUnassessedRecord(
  population: ResultPopulation,
  domain: string,
  now: number
): CompetencyRecord {
  return {
    population,
    domain,
    level: "unassessed",
    avgScore: 0,
    recentScore: 0,
    trend: "flat",
    attemptCount: 0,
    confidence: 0,
    recentScores: [],
    updatedAt: now
  };
}

/**
 * Folds a new evaluation score into a domain's competency record.
 * Deliberately simple and auditable: a rolling average over the last 10
 * scores, a tolerance-banded trend, and a confidence value that scales
 * toward 1.0 as attempts approach that same 10-attempt window - not a
 * statistical model, just enough to keep "Mastered" from being reachable
 * off a single lucky attempt (Architecture Package Section 14).
 */
export function updateCompetencyRecord(
  existing: CompetencyRecord | undefined,
  population: ResultPopulation,
  domain: string,
  newScore: number,
  now: number
): CompetencyRecord {
  // A record only ever folds into its own population (D5). Passing another
  // population's record here would silently merge two separate signals, so it
  // is refused rather than quietly averaged.
  if (existing && existing.population !== population) {
    throw new Error(
      `Cannot fold a ${population} score into a ${existing.population} competency record for "${domain}".`
    );
  }
  const previousScores = existing?.recentScores ?? [];
  const recentScores = [...previousScores, newScore].slice(-ROLLING_WINDOW);
  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

  const priorAvg =
    previousScores.length > 0 ? previousScores.reduce((a, b) => a + b, 0) / previousScores.length : avgScore;
  const trend: CompetencyTrend =
    newScore > priorAvg + TREND_TOLERANCE ? "up" : newScore < priorAvg - TREND_TOLERANCE ? "down" : "flat";

  return {
    population,
    domain,
    level: computeLevel(avgScore, attemptCount, trend),
    avgScore,
    recentScore: newScore,
    trend,
    attemptCount,
    confidence: Math.min(1, attemptCount / ROLLING_WINDOW),
    recentScores,
    updatedAt: now
  };
}
