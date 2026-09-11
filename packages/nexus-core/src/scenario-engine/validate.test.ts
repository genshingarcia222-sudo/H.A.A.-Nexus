import { describe, expect, it } from "vitest";
import { validateScenario } from "./validate.js";

function validScenario(overrides: Record<string, unknown> = {}) {
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
      sectionsRequired: ["chiefComplaint"],
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
      chiefComplaintRaw: "test complaint",
      narrative: "Patient reports test complaint. Denies fever.",
      hpi: "",
      ros: "Denies fever.",
      history: "",
      medications: [],
      allergies: [],
      physicalExam: "",
      assessment: "",
      plan: "",
      pertinentPositives: [],
      pertinentNegatives: ["denies fever"]
    },
    requiredDocumentation: [
      {
        id: "req-neg-fever",
        section: "ros",
        description: "Document absence of fever",
        sourceFact: "denies fever",
        acceptableVariants: ["no fever", "afebrile"],
        isPertinentNegative: true
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

describe("validateScenario", () => {
  it("accepts a well-formed scenario", () => {
    const result = validateScenario(validScenario());
    expect(result.success).toBe(true);
  });

  it("rejects a requirement with an empty sourceFact (no fabrication traceability)", () => {
    const result = validateScenario(
      validScenario({
        requiredDocumentation: [
          {
            id: "req-bad",
            section: "ros",
            description: "bad requirement",
            sourceFact: "",
            acceptableVariants: ["x"]
          }
        ]
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes("sourceFact"))).toBe(true);
    }
  });

  it("rejects difficulty outside 1-6", () => {
    const result = validateScenario(validScenario({ difficulty: 7 }));
    expect(result.success).toBe(false);
  });

  it("rejects a scenario with zero required documentation items", () => {
    const result = validateScenario(validScenario({ requiredDocumentation: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects duplicate requirement ids across required/optional documentation", () => {
    const base = validScenario();
    const result = validateScenario({
      ...base,
      optionalDocumentation: [
        {
          id: "req-neg-fever", // duplicate of the required item's id
          section: "ros",
          description: "duplicate id",
          sourceFact: "denies fever",
          acceptableVariants: ["no fever"]
        }
      ]
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
    }
  });

  it("rejects a full scoringRules override that doesn't sum to 1.0", () => {
    const result = validateScenario(
      validScenario({
        scoringRules: {
          accuracy: 0.5,
          completeness: 0.5,
          terminology: 0.5,
          relevance: 0,
          structure: 0,
          pertinentPosNeg: 0,
          timeEfficiency: 0
        }
      })
    );
    expect(result.success).toBe(false);
  });

  it("accepts a partial scoringRules override that still resolves to a sum of 1.0 against the default", () => {
    // accuracy default 0.25 -> 0.30, completeness default 0.20 -> 0.15; net sum unchanged
    const result = validateScenario(
      validScenario({
        scoringRules: { accuracy: 0.3, completeness: 0.15 }
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects a partial scoringRules override that breaks the sum away from 1.0", () => {
    const result = validateScenario(
      validScenario({
        scoringRules: { accuracy: 0.9 }
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects non-scenario garbage input without throwing", () => {
    const result = validateScenario({ nonsense: true });
    expect(result.success).toBe(false);
  });
});
