import { describe, expect, it } from "vitest";
import { evaluateAttempt } from "./evaluate.js";
import { buildNoteComparison } from "./note-comparison.js";
import { createEmptyDraft } from "../simulation-engine/documentation-draft.js";
import { validateScenario } from "../scenario-engine/index.js";
import scenarioJson from "../../../../content/scenarios/live-scribing/SCRIBE-FM-014-v1.0.json";
import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";
import type { RequirementItem, Scenario } from "../scenario-engine/types.js";

/**
 * Decision D7 — how contradictory learner documentation is graded.
 *
 * Decided 2026-09-20 under delegated authority: a note that documents a
 * pertinent negative **and** asserts the opposite in the same section is a
 * `critical_documentation_error`, at critical severity, and counts against
 * accuracy like any other unsupported assertion.
 *
 * Architecture Package §28 requires "contradictory learner input" as an
 * edge-case fixture but states no expected outcome. This file supplies that
 * outcome.
 *
 * Before D7, the first match satisfied the requirement and the contradiction
 * was silently ignored: "No fever. Fever present." scored **accuracy 100**
 * with no error at all. `critical_documentation_error` is not a new
 * classification - it is the type the architecture already reserved for
 * defects dangerous regardless of category, with a critical severity floor,
 * and no evaluator path produced it until now.
 */

const validated = validateScenario(scenarioJson);
if (!validated.success) throw new Error(`fixture scenario is invalid: ${validated.errors.join(", ")}`);
const scenario: Scenario = validated.data;

/** The encounter denies fever, so "fever" is the pertinent negative to contradict. */
function evaluate(draft: Partial<DocumentationDraft>) {
  return evaluateAttempt({
    scenario,
    draft: { ...createEmptyDraft(), ...draft },
    activeMs: 60_000
  });
}

const contradictions = (result: ReturnType<typeof evaluate>) =>
  result.errors.filter((e) => e.errorType === "critical_documentation_error");

describe("D7: a self-contradictory pertinent negative", () => {
  it("is reported as a critical documentation error", () => {
    const result = evaluate({ ros: "No fever. Fever present." });
    const found = contradictions(result);

    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("critical");
    expect(found[0]!.section).toBe("ros");
  });

  it("explains the contradiction rather than describing it as a plain omission", () => {
    const [error] = contradictions(evaluate({ ros: "No fever. Fever present." }));

    expect(error!.what).toMatch(/also asserts the opposite/);
    expect(error!.why).toMatch(/cannot be acted on|no way to know which is true/);
    expect(error!.how).toMatch(/remove the contradicting statement/);
  });

  it("costs accuracy, where before D7 it cost nothing at all", () => {
    // The regression this decision exists to fix: a note asserting both a
    // fact and its negation used to score as perfectly accurate.
    const contradictory = evaluate({ ros: "No fever. Fever present." });
    const consistent = evaluate({ ros: "No fever." });

    expect(contradictory.categoryScores.accuracy).toBeLessThan(consistent.categoryScores.accuracy);
    expect(contradictory.overallScore).toBeLessThan(consistent.overallScore);
  });

  it("does not also report the requirement as omitted - it was documented", () => {
    const result = evaluate({ ros: "No fever. Fever present." });
    const feverErrors = result.errors.filter((e) => e.relatedRequirementId === "req-neg-fever");

    expect(feverErrors).toHaveLength(1);
    expect(feverErrors[0]!.errorType).toBe("critical_documentation_error");
  });

  it("is deterministic, like every other evaluation result", () => {
    const a = evaluate({ ros: "No fever. Fever present." });
    const b = evaluate({ ros: "No fever. Fever present." });
    expect(a.errors.map((e) => e.id)).toEqual(b.errors.map((e) => e.id));
  });
});

describe("D7 does not fire on notes that are merely imperfect", () => {
  it("leaves a correctly documented pertinent negative alone", () => {
    const result = evaluate({ ros: "Denies fever, denies chest pain, denies shortness of breath." });
    expect(contradictions(result)).toEqual([]);
  });

  it("leaves a plain omission as an omission", () => {
    const result = evaluate({ ros: "" });
    expect(contradictions(result)).toEqual([]);
    expect(result.errors.some((e) => e.errorType === "omission")).toBe(true);
  });

  it("leaves a plain reversal as incorrect_negative, not a contradiction", () => {
    // The negation is absent entirely - the learner asserted the positive and
    // nothing else. That is the pre-existing dangerous-reversal case, and D7
    // did not change it.
    const result = evaluate({ ros: "Fever present." });
    const fever = result.errors.filter((e) => e.relatedRequirementId === "req-neg-fever");

    expect(fever).toHaveLength(1);
    expect(fever[0]!.errorType).toBe("incorrect_negative");
    expect(contradictions(result)).toEqual([]);
  });

  it("does not fire for a requirement that is not a pertinent negative", () => {
    // The rule is scoped to pertinent negatives, where the existing negation
    // machinery can detect a contradiction reliably. It does not claim to be
    // general contradiction detection.
    //
    // This takes the very requirement that *does* contradict above and clears
    // only its `isPertinentNegative` flag, so the scope guard is the single
    // difference between the two cases. Using the shipped content instead
    // would pass either way: those requirements have no negated variants, so
    // detection returns false whether the guard exists or not.
    const asNonNegative = {
      ...scenario,
      requiredDocumentation: scenario.requiredDocumentation.map((req: RequirementItem) =>
        req.id === "req-neg-fever" ? { ...req, isPertinentNegative: false } : req
      )
    };

    const result = evaluateAttempt({
      scenario: asNonNegative,
      draft: { ...createEmptyDraft(), ros: "No fever. Fever present." },
      activeMs: 60_000
    });

    expect(result.errors.filter((e) => e.errorType === "critical_documentation_error")).toEqual([]);
  });

  it("scores a consistent note exactly as it did before D7", () => {
    // D7 changed one previously-unreported case. A note with no contradiction
    // must be graded identically to before.
    const result = evaluate({
      chiefComplaint: "Cough x3 days",
      hpi: "Non-productive cough for three days.",
      ros: "Denies fever, denies dyspnea."
    });

    expect(contradictions(result)).toEqual([]);
    expect(result.categoryScores.accuracy).toBe(100);
  });
});

describe("D7 reaches the note comparison, so both surfaces agree", () => {
  it("reads back the contradiction rather than reporting the requirement as documented", () => {
    // The note comparison exists so the comparison and the feedback list can
    // never tell the learner different things. A contradicted requirement was
    // previously read back as "documented" - green - while the feedback list
    // called it critical.
    const draft = { ...createEmptyDraft(), ros: "No fever. Fever present." };
    const result = evaluateAttempt({ scenario, draft, activeMs: 60_000 });
    const rows = buildNoteComparison(scenario, draft, result);

    const fever = rows
      .flatMap((row) => row.expected)
      .find((e) => e.requirementId === "req-neg-fever");

    expect(fever?.status).toBe("critical_documentation_error");
  });
});
