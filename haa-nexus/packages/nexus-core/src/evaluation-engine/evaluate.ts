import type { Scenario } from "../scenario-engine/types.js";
import { DEFAULT_SCORING_WEIGHTS } from "../scenario-engine/types.js";
import { resolveScoringWeights } from "../scenario-engine/weights.js";
import { enforceSeverityFloor } from "../scenario-engine/severity.js";
import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";
import { evaluateRequirement } from "./requirement-evaluator.js";
import { findUnsupportedNumericMentions } from "./numeric-fabrication.js";
import {
  omissionFeedback,
  wrongSectionFeedback,
  incorrectTerminologyFeedback,
  incorrectNegativeFeedback,
  fabricationFeedback,
  timeManagementFeedback
} from "./feedback-templates.js";
import type { EvaluationError, EvaluationResult, CategoryScores } from "./types.js";

let errorIdCounter = 0;
function nextErrorId(): string {
  errorIdCounter += 1;
  return `err-${errorIdCounter}`;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function buildEncounterFullText(scenario: Scenario): string {
  const e = scenario.encounter;
  return [
    e.chiefComplaintRaw,
    e.narrative,
    e.hpi,
    e.ros,
    e.history,
    e.physicalExam,
    e.assessment,
    e.plan,
    e.socialHistory ?? "",
    e.familyHistory ?? "",
    ...e.medications,
    ...e.allergies,
    ...e.pertinentPositives,
    ...e.pertinentNegatives
  ].join(" ");
}

function buildDocumentedFullText(draft: DocumentationDraft): string {
  return Object.values(draft).join(" ");
}

export interface EvaluateAttemptParams {
  scenario: Scenario;
  draft: DocumentationDraft;
  /** Active (non-paused) documentation time, in milliseconds - see simulation-engine's computeLiveActiveMs. */
  activeMs: number;
}

export function evaluateAttempt(params: EvaluateAttemptParams): EvaluationResult {
  const { scenario, draft, activeMs } = params;
  const errors: EvaluationError[] = [];

  const requiredResults = scenario.requiredDocumentation.map((req) => evaluateRequirement(req, draft));
  const optionalResults = scenario.optionalDocumentation.map((req) => evaluateRequirement(req, draft));

  let fabricationLikeCount = 0; // fabrication + reversed negatives, both "asserted something false"

  for (const result of requiredResults) {
    const { requirement } = result;
    if (!result.found && !result.negationReversed) {
      errors.push({
        id: nextErrorId(),
        errorType: "omission",
        severity: enforceSeverityFloor("omission", "major"),
        section: requirement.section,
        relatedRequirementId: requirement.id,
        ...omissionFeedback(requirement)
      });
    } else if (!result.found && result.negationReversed) {
      fabricationLikeCount += 1;
      errors.push({
        id: nextErrorId(),
        errorType: "incorrect_negative",
        severity: enforceSeverityFloor("incorrect_negative", "critical"),
        section: requirement.section,
        relatedRequirementId: requirement.id,
        ...incorrectNegativeFeedback(requirement)
      });
    } else if (result.found && result.isWrongSection) {
      errors.push({
        id: nextErrorId(),
        errorType: "wrong_section",
        severity: enforceSeverityFloor("wrong_section", "major"),
        section: requirement.section,
        relatedRequirementId: requirement.id,
        ...wrongSectionFeedback(requirement, result.foundInSection!)
      });
    } else if (result.found && result.usedRawLayTerm) {
      errors.push({
        id: nextErrorId(),
        errorType: "incorrect_terminology",
        severity: enforceSeverityFloor("incorrect_terminology", "minor"),
        section: requirement.section,
        relatedRequirementId: requirement.id,
        ...incorrectTerminologyFeedback(requirement, requirement.sourceFact)
      });
    }
  }

  // Numeric fabrication check, across the whole note vs. the whole encounter.
  const unsupportedMentions = findUnsupportedNumericMentions(
    buildDocumentedFullText(draft),
    buildEncounterFullText(scenario)
  );
  for (const mention of unsupportedMentions) {
    fabricationLikeCount += 1;
    errors.push({
      id: nextErrorId(),
      errorType: "fabrication",
      severity: enforceSeverityFloor("fabrication", "critical"),
      section: "additionalNotes", // fabricated values aren't tied to one specific required section
      ...fabricationFeedback(mention)
    });
  }

  // Time management.
  const elapsedSeconds = activeMs / 1000;
  const overTimeRatio = elapsedSeconds / scenario.timeTargetSeconds;
  if (overTimeRatio > 1.5) {
    errors.push({
      id: nextErrorId(),
      errorType: "time_management",
      severity: enforceSeverityFloor("time_management", "minor"),
      section: "additionalNotes",
      ...timeManagementFeedback(elapsedSeconds, scenario.timeTargetSeconds)
    });
  }

  // ---- Category scores ----
  const totalRequired = requiredResults.length;
  const matchedRequired = requiredResults.filter((r) => r.found).length;
  const wrongSectionCount = requiredResults.filter((r) => r.found && r.isWrongSection).length;
  const rawLayTermCount = requiredResults.filter((r) => r.found && r.usedRawLayTerm).length;

  const pertinentNegRequirements = requiredResults.filter((r) => r.requirement.isPertinentNegative);
  const pertinentNegMatched = pertinentNegRequirements.filter((r) => r.found).length;

  const totalOptional = optionalResults.length;
  const matchedOptional = optionalResults.filter((r) => r.found).length;

  const accuracy = clamp(100 - fabricationLikeCount * 40);
  const completeness = totalRequired > 0 ? clamp((matchedRequired / totalRequired) * 100) : 100;
  const terminology = clamp(100 - rawLayTermCount * 10);
  const relevance = totalOptional > 0 ? clamp(80 + (matchedOptional / totalOptional) * 20) : 100;
  const structure = totalRequired > 0 ? clamp(100 - (wrongSectionCount / totalRequired) * 100) : 100;
  const pertinentPosNeg =
    pertinentNegRequirements.length > 0
      ? clamp((pertinentNegMatched / pertinentNegRequirements.length) * 100)
      : 100;
  const timeEfficiency = overTimeRatio <= 1 ? 100 : clamp(100 - (overTimeRatio - 1) * 100);

  const categoryScores: CategoryScores = {
    accuracy,
    completeness,
    terminology,
    relevance,
    structure,
    pertinentPosNeg,
    timeEfficiency
  };

  const resolution = resolveScoringWeights(scenario.scoringRules);
  const weights = resolution.success && resolution.weights ? resolution.weights : DEFAULT_SCORING_WEIGHTS;

  const overallScore = clamp(
    categoryScores.accuracy * weights.accuracy +
      categoryScores.completeness * weights.completeness +
      categoryScores.terminology * weights.terminology +
      categoryScores.relevance * weights.relevance +
      categoryScores.structure * weights.structure +
      categoryScores.pertinentPosNeg * weights.pertinentPosNeg +
      categoryScores.timeEfficiency * weights.timeEfficiency
  );

  return {
    overallScore,
    categoryScores,
    errors,
    scoringWeightsUsed: weights,
    timeEfficiencyRatio: overTimeRatio,
    evaluatedAt: Date.now()
  };
}
