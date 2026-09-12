import type { CompetencyLevel } from "../competency-engine/index.js";
import type { ErrorType } from "../scenario-engine/types.js";

export interface CompetencySnapshot {
  domain: string;
  level: CompetencyLevel;
  avgScore: number;
  attemptCount: number;
}

export interface ErrorTrendEntry {
  errorType: ErrorType;
  count: number;
}

export type PerformanceTrend = "up" | "down" | "flat" | "insufficient-data";

export interface AnalyticsSummary {
  sessionsEvaluated: number;
  /** null when no session has been evaluated yet - never fabricated as 0. */
  averageScore: number | null;
  trend: PerformanceTrend;
  /** Bottom 3 competency domains by avgScore, excluding domains with no attempts yet. */
  weakestAreas: CompetencySnapshot[];
  /** Top 3 competency domains by avgScore, excluding domains with no attempts yet. */
  strongestAreas: CompetencySnapshot[];
  /** All error types seen across history, sorted by frequency descending. Empty array if none. */
  errorTrends: ErrorTrendEntry[];
  scenarioProgress: {
    attempted: number;
    total: number;
  };
}
