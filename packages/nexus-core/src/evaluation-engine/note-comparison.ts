import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";
import type { DocumentationSection, Scenario } from "../scenario-engine/types.js";
import type { EvaluationError, EvaluationResult } from "./types.js";

/**
 * The note comparison required by Architecture Package Section 34(10):
 * "Review a note comparison (encounter vs. learner vs. expected)."
 *
 * This derives a view; it decides nothing. The encounter column is the
 * scenario's own per-section content, the learner column is their draft, and
 * the expected column is the requirement set the evaluator already scores
 * against. Each expectation's status is read back out of the evaluation's
 * errors rather than recomputed, so the comparison can never disagree with
 * the feedback shown beside it - if the evaluator called something an
 * omission, so does this.
 */

/**
 * How a single requirement fared, taken from the evaluation. Every value
 * except `documented` is an existing `ErrorType` that carries a
 * `relatedRequirementId`; `documented` means no error referenced it.
 */
export type NoteComparisonStatus =
  | "documented"
  | "omission"
  | "incorrect_negative"
  | "wrong_section"
  | "incorrect_terminology"
  | "critical_documentation_error";

export interface NoteComparisonExpectation {
  requirementId: string;
  description: string;
  /** The encounter fact this requirement traces to. */
  sourceFact: string;
  isPertinentNegative: boolean;
  status: NoteComparisonStatus;
}

export interface NoteComparisonRow {
  section: DocumentationSection;
  /** The scenario's source content for this section; empty when it has none. */
  encounter: string;
  /** What the learner wrote in this section. */
  learner: string;
  expected: NoteComparisonExpectation[];
}

/**
 * Which encounter field is the source for each documentation section.
 *
 * `additionalNotes` has no counterpart: the encounter carries no "notes"
 * field, so its encounter column is empty rather than filled with something
 * approximate.
 */
const ENCOUNTER_SOURCE: Record<DocumentationSection, keyof Scenario["encounter"] | null> = {
  chiefComplaint: "chiefComplaintRaw",
  hpi: "hpi",
  ros: "ros",
  physicalExam: "physicalExam",
  assessment: "assessment",
  plan: "plan",
  additionalNotes: null
};

const SECTION_ORDER: DocumentationSection[] = [
  "chiefComplaint",
  "hpi",
  "ros",
  "physicalExam",
  "assessment",
  "plan",
  "additionalNotes"
];

/** The error types that point back at a specific requirement. */
const REQUIREMENT_STATUSES: readonly NoteComparisonStatus[] = [
  "omission",
  "incorrect_negative",
  "wrong_section",
  "incorrect_terminology",
  // Decision D7. Without this the comparison would read back "documented" for
  // a requirement the feedback list calls a critical error - the exact
  // divergence this component exists to prevent.
  "critical_documentation_error"
];

function statusFor(requirementId: string, errors: readonly EvaluationError[]): NoteComparisonStatus {
  const match = errors.find(
    (e) =>
      e.relatedRequirementId === requirementId &&
      (REQUIREMENT_STATUSES as readonly string[]).includes(e.errorType)
  );
  return match ? (match.errorType as NoteComparisonStatus) : "documented";
}

function encounterText(scenario: Scenario, section: DocumentationSection): string {
  const key = ENCOUNTER_SOURCE[section];
  if (!key) return "";
  const value = scenario.encounter[key];
  return typeof value === "string" ? value : "";
}

/**
 * Builds one row per documentation section, in the order the learner
 * documents them. Sections with no requirements are still included: an empty
 * expected column is itself information ("nothing was required here").
 *
 * Only `requiredDocumentation` appears. The evaluator raises
 * requirement-linked errors for required items alone, so an optional item has
 * no status to read back - showing one would mean recomputing whether it was
 * documented, and a second opinion is exactly what this view must not have.
 */
export function buildNoteComparison(
  scenario: Scenario,
  draft: DocumentationDraft,
  evaluation: EvaluationResult
): NoteComparisonRow[] {
  return SECTION_ORDER.map((section) => ({
    section,
    encounter: encounterText(scenario, section),
    learner: draft[section] ?? "",
    expected: scenario.requiredDocumentation
      .filter((requirement) => requirement.section === section)
      .map((requirement) => ({
        requirementId: requirement.id,
        description: requirement.description,
        sourceFact: requirement.sourceFact,
        isPertinentNegative: requirement.isPertinentNegative === true,
        status: statusFor(requirement.id, evaluation.errors)
      }))
  }));
}
