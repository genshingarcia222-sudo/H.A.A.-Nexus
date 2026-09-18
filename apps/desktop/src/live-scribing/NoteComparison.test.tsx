// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { EvaluationError, EvaluationResult, Scenario } from "@haa-nexus/nexus-core";
import { createEmptyDraft } from "@haa-nexus/nexus-core";
import { NoteComparison } from "./NoteComparison.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Architecture Package Section 34(10), as rendered. Uses the real shipped
 * scenario so the encounter column is proven against actual content rather
 * than a fixture shaped to suit the component.
 */

const scenario = scenarioRepository.list()[0] as Scenario;

function evaluationWith(errors: EvaluationError[]): EvaluationResult {
  return { errors } as unknown as EvaluationResult;
}

const draft = { ...createEmptyDraft(), hpi: "Cough for three days.", ros: "No fever." };

afterEach(() => {
  cleanup();
});

describe("NoteComparison - rendered", () => {
  it("shows a row per documentation section with all three columns", () => {
    render(<NoteComparison scenario={scenario} draft={draft} evaluation={evaluationWith([])} />);
    for (const label of ["Section", "Encounter", "Your note", "Expected"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeTruthy();
    }
    for (const section of ["Chief Complaint", "HPI", "ROS", "Physical Exam", "Assessment", "Plan", "Additional Notes"]) {
      expect(screen.getByRole("rowheader", { name: section })).toBeTruthy();
    }
  });

  it("puts the real encounter content in the encounter column", () => {
    render(<NoteComparison scenario={scenario} draft={draft} evaluation={evaluationWith([])} />);
    const hpiRow = screen.getByRole("rowheader", { name: "HPI" }).closest("tr")!;
    expect(within(hpiRow).getByText(scenario.encounter.hpi, { exact: false })).toBeTruthy();
    expect(within(hpiRow).getByText("Cough for three days.")).toBeTruthy();
  });

  it("says so, in words, when a section was left empty", () => {
    render(<NoteComparison scenario={scenario} draft={createEmptyDraft()} evaluation={evaluationWith([])} />);
    expect(screen.getAllByText("Nothing documented").length).toBeGreaterThan(0);
  });

  it("marks a missed requirement as Missing, using the evaluator's own classification", () => {
    const requirement = scenario.requiredDocumentation[0]!;
    render(
      <NoteComparison
        scenario={scenario}
        draft={draft}
        evaluation={evaluationWith([
          {
            id: `omission:${requirement.id}`,
            errorType: "omission",
            severity: "major",
            section: requirement.section,
            relatedRequirementId: requirement.id,
            what: "",
            why: "",
            how: ""
          } as EvaluationError
        ])}
      />
    );
    const row = screen.getByText(requirement.description).closest("li")!;
    expect(within(row).getByText("Missing")).toBeTruthy();
    // Status is conveyed in text, not by colour alone.
    expect(row.textContent).toContain("Missing");
  });

  it("marks requirements with no error against them as Documented", () => {
    render(<NoteComparison scenario={scenario} draft={draft} evaluation={evaluationWith([])} />);
    expect(screen.getAllByText("Documented").length).toBe(scenario.requiredDocumentation.length);
  });

  it("traces every expectation back to the encounter fact it came from", () => {
    render(<NoteComparison scenario={scenario} draft={draft} evaluation={evaluationWith([])} />);
    for (const requirement of scenario.requiredDocumentation) {
      expect(screen.getByText(`from: ${requirement.sourceFact}`)).toBeTruthy();
    }
  });
});
