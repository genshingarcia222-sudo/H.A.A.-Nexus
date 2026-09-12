import { describe, expect, it } from "vitest";
import { evaluateAttempt } from "./evaluate.js";
import { createEmptyDraft } from "../simulation-engine/documentation-draft.js";
import type { Scenario } from "../scenario-engine/types.js";
import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: "SCRIBE-TEST-001",
    version: "1.0",
    title: "Test Scenario",
    specialty: "Family Medicine",
    encounterType: "Office Visit",
    difficulty: 1,
    complexityDimensions: {
      informationDensity: 1,
      complaintCount: 1,
      sectionsRequired: ["ros"],
      terminologyComplexity: 1,
      relevanceComplexity: 1,
      timePressure: 1,
      distraction: 1,
      ambiguity: 1,
      specificity: 1,
      requiredInfoCount: 1,
      errorRisk: 1
    },
    objectives: ["Test objective"],
    patient: { age: 40, sex: "male" },
    encounter: {
      chiefComplaintRaw: "cough for 3 days",
      narrative: "Patient reports cough for 3 days. Denies fever.",
      hpi: "Cough for 3 days.",
      ros: "Denies fever.",
      history: "",
      medications: [],
      allergies: [],
      physicalExam: "",
      assessment: "",
      plan: "",
      pertinentPositives: ["cough"],
      pertinentNegatives: ["denies fever"]
    },
    requiredDocumentation: [
      {
        id: "req-neg-fever",
        section: "ros",
        description: "Document absence of fever",
        sourceFact: "denies fever",
        acceptableVariants: ["no fever", "afebrile", "denies fever"],
        isPertinentNegative: true
      },
      {
        id: "req-cough",
        section: "hpi",
        description: "Document the cough",
        sourceFact: "cough for 3 days",
        acceptableVariants: ["non-productive cough", "cough x3 days", "3-day cough"]
      }
    ],
    optionalDocumentation: [],
    terminologyMappings: [],
    commonErrors: [],
    timeTargetSeconds: 120,
    tags: [],
    ...overrides
  };
}

function draft(overrides: Partial<DocumentationDraft>): DocumentationDraft {
  return { ...createEmptyDraft(), ...overrides };
}

describe("evaluateAttempt - correct submission", () => {
  it("scores highly with no errors when everything is documented correctly", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({
      scenario,
      draft: draft({ ros: "No fever.", hpi: "Non-productive cough x3 days." }),
      activeMs: 60_000
    });
    expect(result.errors).toHaveLength(0);
    expect(result.categoryScores.completeness).toBe(100);
    expect(result.categoryScores.accuracy).toBe(100);
    expect(result.overallScore).toBeGreaterThan(90);
  });
});

describe("evaluateAttempt - empty submission edge case", () => {
  it("scores zero completeness but full accuracy (nothing false was stated)", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({ scenario, draft: createEmptyDraft(), activeMs: 10_000 });
    expect(result.categoryScores.completeness).toBe(0);
    expect(result.categoryScores.accuracy).toBe(100);
    expect(result.errors.filter((e) => e.errorType === "omission")).toHaveLength(2);
  });
});

describe("evaluateAttempt - partial submission edge case", () => {
  it("only flags the missing requirement as an omission", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({
      scenario,
      draft: draft({ ros: "No fever." }), // cough not documented
      activeMs: 10_000
    });
    const omissions = result.errors.filter((e) => e.errorType === "omission");
    expect(omissions).toHaveLength(1);
    expect(omissions[0]!.relatedRequirementId).toBe("req-cough");
    expect(result.categoryScores.completeness).toBe(50);
  });
});

describe("evaluateAttempt - the spec's canonical fabrication example", () => {
  it("flags a fabricated temperature and penalizes accuracy", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({
      scenario,
      draft: draft({ ros: "No fever. Temperature 37.0°C.", hpi: "Non-productive cough x3 days." }),
      activeMs: 10_000
    });
    const fabrications = result.errors.filter((e) => e.errorType === "fabrication");
    expect(fabrications).toHaveLength(1);
    expect(fabrications[0]!.severity).toBe("critical");
    expect(result.categoryScores.accuracy).toBe(60); // 100 - 40
  });

  it("does not flag a value that the encounter actually provided", () => {
    const scenario = makeScenario({
      encounter: { ...makeScenario().encounter, ros: "Temp 38.2C, denies fever otherwise." }
    });
    const result = evaluateAttempt({
      scenario,
      draft: draft({ ros: "No fever. Temp 38.2C.", hpi: "Non-productive cough x3 days." }),
      activeMs: 10_000
    });
    expect(result.errors.filter((e) => e.errorType === "fabrication")).toHaveLength(0);
  });
});

describe("evaluateAttempt - wrong section", () => {
  it("flags wrong_section without penalizing completeness", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({
      scenario,
      draft: draft({ hpi: "No fever. Non-productive cough x3 days." }), // fever negative in hpi, not ros
      activeMs: 10_000
    });
    const wrongSection = result.errors.filter((e) => e.errorType === "wrong_section");
    expect(wrongSection).toHaveLength(1);
    expect(result.categoryScores.completeness).toBe(100); // still counted as documented
    expect(result.categoryScores.structure).toBeLessThan(100);
  });
});

describe("evaluateAttempt - incorrect terminology (raw lay term)", () => {
  it("flags incorrect_terminology when the learner copies the sourceFact verbatim", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({
      scenario,
      draft: draft({ ros: "No fever.", hpi: "cough for 3 days" }), // verbatim sourceFact, not a clinical variant
      activeMs: 10_000
    });
    const terminologyErrors = result.errors.filter((e) => e.errorType === "incorrect_terminology");
    expect(terminologyErrors).toHaveLength(1);
    expect(result.categoryScores.terminology).toBe(90);
    expect(result.categoryScores.completeness).toBe(100); // still counts as documented
  });
});

describe("evaluateAttempt - dangerous reversal", () => {
  it("flags incorrect_negative at critical severity and penalizes both accuracy and completeness", () => {
    const scenario = makeScenario();
    const result = evaluateAttempt({
      scenario,
      draft: draft({ ros: "Fever present.", hpi: "Non-productive cough x3 days." }),
      activeMs: 10_000
    });
    const reversals = result.errors.filter((e) => e.errorType === "incorrect_negative");
    expect(reversals).toHaveLength(1);
    expect(reversals[0]!.severity).toBe("critical");
    expect(result.categoryScores.accuracy).toBe(60);
    expect(result.categoryScores.completeness).toBe(50); // not counted as satisfied
  });
});

describe("evaluateAttempt - time management", () => {
  it("does not flag time_management when within target", () => {
    const scenario = makeScenario({ timeTargetSeconds: 120 });
    const result = evaluateAttempt({ scenario, draft: createEmptyDraft(), activeMs: 100_000 });
    expect(result.errors.filter((e) => e.errorType === "time_management")).toHaveLength(0);
    expect(result.categoryScores.timeEfficiency).toBe(100);
  });

  it("flags time_management when well over target and reduces timeEfficiency", () => {
    const scenario = makeScenario({ timeTargetSeconds: 60 });
    const result = evaluateAttempt({ scenario, draft: createEmptyDraft(), activeMs: 200_000 }); // 200s vs 60s target
    expect(result.errors.filter((e) => e.errorType === "time_management")).toHaveLength(1);
    expect(result.categoryScores.timeEfficiency).toBeLessThan(100);
  });
});

describe("evaluateAttempt - scoring weights", () => {
  it("uses the scenario's scoringRules override when present", () => {
    const scenario = makeScenario({ scoringRules: { accuracy: 0.5, completeness: 0.5, terminology: 0, relevance: 0, structure: 0, pertinentPosNeg: 0, timeEfficiency: 0 } });
    const result = evaluateAttempt({ scenario, draft: createEmptyDraft(), activeMs: 10_000 });
    expect(result.scoringWeightsUsed.accuracy).toBe(0.5);
    // accuracy=100, completeness=0 -> overall = 100*0.5 + 0*0.5 = 50
    expect(result.overallScore).toBe(50);
  });
});
