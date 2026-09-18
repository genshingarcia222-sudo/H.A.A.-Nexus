import { describe, expect, it } from "vitest";
import { buildNoteComparison, type NoteComparisonRow } from "./note-comparison.js";
import type { EvaluationError, EvaluationResult } from "./types.js";
import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";
import type { Scenario } from "../scenario-engine/types.js";

/**
 * Architecture Package Section 34(10): "Review a note comparison (encounter
 * vs. learner vs. expected)."
 *
 * The comparison must never contradict the feedback shown beside it, so every
 * status here is read back out of the evaluation rather than recomputed.
 */

const scenario = {
  scenarioId: "SCRIBE-TEST-900",
  version: "1.0",
  title: "Test encounter",
  encounter: {
    chiefComplaintRaw: "my chest hurts",
    narrative: "Patient reports chest pain.",
    hpi: "Chest pain for two days, worse on exertion.",
    ros: "Denies fever.",
    history: "Hypertension.",
    medications: ["lisinopril"],
    allergies: [],
    physicalExam: "Lungs clear.",
    assessment: "Likely angina.",
    plan: "ECG, troponin.",
    pertinentPositives: ["exertional pain"],
    pertinentNegatives: ["no fever"]
  },
  optionalDocumentation: [
    { id: "R-OPT-1", section: "hpi", description: "Social history detail", sourceFact: "smoker", acceptableVariants: ["smoker"] }
  ],
  requiredDocumentation: [
    { id: "R-HPI-1", section: "hpi", description: "Duration of chest pain", sourceFact: "two days", acceptableVariants: ["two days"] },
    { id: "R-HPI-2", section: "hpi", description: "Exertional character", sourceFact: "worse on exertion", acceptableVariants: ["exertional"] },
    { id: "R-ROS-1", section: "ros", description: "Absence of fever", sourceFact: "Denies fever", acceptableVariants: ["no fever"], isPertinentNegative: true },
    { id: "R-PE-1", section: "physicalExam", description: "Lung findings", sourceFact: "Lungs clear", acceptableVariants: ["lungs clear"] }
  ]
} as unknown as Scenario;

const draft: DocumentationDraft = {
  chiefComplaint: "Chest pain",
  hpi: "Two days of chest pain.",
  ros: "Fever present.",
  physicalExam: "",
  assessment: "",
  plan: "",
  additionalNotes: "Follow up next week."
};

function evaluationWith(errors: EvaluationError[]): EvaluationResult {
  return { errors } as unknown as EvaluationResult;
}

const err = (requirementId: string, errorType: string, section: string): EvaluationError =>
  ({ id: `${errorType}:${requirementId}`, errorType, section, relatedRequirementId: requirementId } as unknown as EvaluationError);

const rowFor = (rows: NoteComparisonRow[], section: string) => rows.find((r) => r.section === section)!;

describe("note comparison - the three columns", () => {
  const rows = buildNoteComparison(scenario, draft, evaluationWith([]));

  it("covers every documentation section, in documentation order", () => {
    expect(rows.map((r) => r.section)).toEqual([
      "chiefComplaint",
      "hpi",
      "ros",
      "physicalExam",
      "assessment",
      "plan",
      "additionalNotes"
    ]);
  });

  it("takes the encounter column from the scenario's own content for that section", () => {
    expect(rowFor(rows, "chiefComplaint").encounter).toBe("my chest hurts");
    expect(rowFor(rows, "hpi").encounter).toBe("Chest pain for two days, worse on exertion.");
    expect(rowFor(rows, "physicalExam").encounter).toBe("Lungs clear.");
    expect(rowFor(rows, "plan").encounter).toBe("ECG, troponin.");
  });

  it("leaves the encounter column empty for additionalNotes, which has no counterpart", () => {
    // Better an empty cell than an approximation presented as source content.
    expect(rowFor(rows, "additionalNotes").encounter).toBe("");
    expect(rowFor(rows, "additionalNotes").learner).toBe("Follow up next week.");
  });

  it("takes the learner column from the draft, including empty sections", () => {
    expect(rowFor(rows, "hpi").learner).toBe("Two days of chest pain.");
    expect(rowFor(rows, "assessment").learner).toBe("");
  });

  it("groups the expected column by the requirement's own section", () => {
    expect(rowFor(rows, "hpi").expected.map((e) => e.requirementId)).toEqual(["R-HPI-1", "R-HPI-2"]);
    expect(rowFor(rows, "ros").expected.map((e) => e.requirementId)).toEqual(["R-ROS-1"]);
    expect(rowFor(rows, "assessment").expected).toEqual([]);
  });

  it("carries the source fact and pertinent-negative flag through", () => {
    const ros = rowFor(rows, "ros").expected[0]!;
    expect(ros.sourceFact).toBe("Denies fever");
    expect(ros.isPertinentNegative).toBe(true);
    expect(rowFor(rows, "hpi").expected[0]!.isPertinentNegative).toBe(false);
  });
});

describe("note comparison - status comes from the evaluation, never recomputed", () => {
  it("marks a requirement documented when no error references it", () => {
    const rows = buildNoteComparison(scenario, draft, evaluationWith([]));
    expect(rowFor(rows, "hpi").expected.map((e) => e.status)).toEqual(["documented", "documented"]);
  });

  it("reflects each requirement-linked error type exactly as the evaluator classified it", () => {
    const rows = buildNoteComparison(
      scenario,
      draft,
      evaluationWith([
        err("R-HPI-2", "omission", "hpi"),
        err("R-ROS-1", "incorrect_negative", "ros"),
        err("R-PE-1", "wrong_section", "physicalExam")
      ])
    );
    expect(rowFor(rows, "hpi").expected.map((e) => e.status)).toEqual(["documented", "omission"]);
    expect(rowFor(rows, "ros").expected[0]!.status).toBe("incorrect_negative");
    expect(rowFor(rows, "physicalExam").expected[0]!.status).toBe("wrong_section");
  });

  it("reflects a terminology error against the requirement it was raised for", () => {
    const rows = buildNoteComparison(scenario, draft, evaluationWith([err("R-HPI-1", "incorrect_terminology", "hpi")]));
    expect(rowFor(rows, "hpi").expected[0]!.status).toBe("incorrect_terminology");
  });

  it("ignores errors that do not name a requirement, such as whole-note fabrication", () => {
    const fabrication = { id: "fabrication:101.5#1", errorType: "fabrication", section: "hpi" } as unknown as EvaluationError;
    const rows = buildNoteComparison(scenario, draft, evaluationWith([fabrication]));
    expect(rowFor(rows, "hpi").expected.every((e) => e.status === "documented")).toBe(true);
  });

  it("leaves optional documentation out, because it has no status to read back", () => {
    // The evaluator raises requirement-linked errors for required items only,
    // so an optional item would always look "documented" - including one would
    // mean recomputing, and a second opinion is what this view must not have.
    const rows = buildNoteComparison(scenario, draft, evaluationWith([]));
    const ids = rows.flatMap((r) => r.expected.map((e) => e.requirementId));
    expect(ids).not.toContain("R-OPT-1");
    expect(ids).toEqual(["R-HPI-1", "R-HPI-2", "R-ROS-1", "R-PE-1"]);
  });

  it("does not mutate the scenario, draft or evaluation it reads", () => {
    const evaluation = evaluationWith([err("R-HPI-1", "omission", "hpi")]);
    const snapshot = JSON.stringify({ scenario, draft, evaluation });
    buildNoteComparison(scenario, draft, evaluation);
    expect(JSON.stringify({ scenario, draft, evaluation })).toBe(snapshot);
  });
});
