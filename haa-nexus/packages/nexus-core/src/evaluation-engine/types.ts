import type { ErrorType, ErrorSeverity, DocumentationSection, ScoringWeights } from "../scenario-engine/types.js";

export interface EvaluationError {
  id: string;
  errorType: ErrorType;
  severity: ErrorSeverity;
  section: DocumentationSection;
  relatedRequirementId?: string;
  /** What the learner did. */
  what: string;
  /** Why it matters. */
  why: string;
  /** How to correct it. */
  how: string;
}

/** Category scores, each 0-100, keyed the same as ScoringWeights. */
export type CategoryScores = ScoringWeights;

export interface EvaluationResult {
  overallScore: number;
  categoryScores: CategoryScores;
  errors: EvaluationError[];
  scoringWeightsUsed: ScoringWeights;
  timeEfficiencyRatio: number;
  evaluatedAt: number;
}
