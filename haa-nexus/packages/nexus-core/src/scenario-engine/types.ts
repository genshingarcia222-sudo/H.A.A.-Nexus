export type DocumentationSection =
  | "chiefComplaint"
  | "hpi"
  | "ros"
  | "physicalExam"
  | "assessment"
  | "plan"
  | "additionalNotes";

export type ErrorType =
  | "omission"
  | "fabrication"
  | "unsupported_inference"
  | "incorrect_terminology"
  | "incorrect_interpretation"
  | "wrong_section"
  | "incomplete_hpi"
  | "incorrect_positive"
  | "incorrect_negative"
  | "irrelevant_information"
  | "excessive_information"
  | "formatting"
  | "time_management"
  | "critical_documentation_error";

export type ErrorSeverity = "critical" | "major" | "minor";

export interface ComplexityDimensions {
  informationDensity: number; // 1-5
  complaintCount: number;
  sectionsRequired: DocumentationSection[];
  terminologyComplexity: number; // 1-5
  relevanceComplexity: number; // 1-5
  timePressure: number; // 1-5
  distraction: number; // 1-5
  ambiguity: number; // 1-5
  specificity: number; // 1-5
  requiredInfoCount: number;
  errorRisk: number; // 1-5
}

export interface RequirementItem {
  id: string;
  section: DocumentationSection;
  description: string;
  /** Exact supporting fact from `encounter`. This is what makes fabrication
   * detection possible at all — the evaluator only ever compares learner
   * statements against traceable sourceFacts, never against general
   * clinical plausibility. */
  sourceFact: string;
  acceptableVariants: string[];
  isPertinentNegative?: boolean;
}

export interface EncounterData {
  chiefComplaintRaw: string;
  narrative: string;
  hpi: string;
  ros: string;
  history: string;
  medications: string[];
  allergies: string[];
  socialHistory?: string;
  familyHistory?: string;
  physicalExam: string;
  assessment: string;
  plan: string;
  pertinentPositives: string[];
  pertinentNegatives: string[];
}

export interface CommonScenarioError {
  description: string;
  errorType: ErrorType;
  severity: ErrorSeverity;
}

export interface ScoringWeights {
  accuracy: number;
  completeness: number;
  terminology: number;
  relevance: number;
  structure: number;
  pertinentPosNeg: number;
  timeEfficiency: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  accuracy: 0.25,
  completeness: 0.2,
  terminology: 0.15,
  relevance: 0.1,
  structure: 0.1,
  pertinentPosNeg: 0.1,
  timeEfficiency: 0.1
};

export interface Scenario {
  scenarioId: string;
  version: string;
  title: string;
  specialty: string;
  encounterType: string;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  complexityDimensions: ComplexityDimensions;
  objectives: string[];
  patient: {
    age: number;
    sex: string;
    demographicsNote?: string;
  };
  encounter: EncounterData;
  requiredDocumentation: RequirementItem[];
  optionalDocumentation: RequirementItem[];
  terminologyMappings: string[];
  commonErrors: CommonScenarioError[];
  scoringRules?: Partial<ScoringWeights>;
  timeTargetSeconds: number;
  tags: string[];
}
