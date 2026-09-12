import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryScenarioRepository } from "./registry.js";
import type { Scenario } from "./types.js";

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
      chiefComplaintRaw: "test",
      narrative: "test",
      hpi: "",
      ros: "",
      history: "",
      medications: [],
      allergies: [],
      physicalExam: "",
      assessment: "",
      plan: "",
      pertinentPositives: [],
      pertinentNegatives: []
    },
    requiredDocumentation: [
      {
        id: "req-1",
        section: "chiefComplaint",
        description: "test",
        sourceFact: "test",
        acceptableVariants: ["test"]
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

describe("InMemoryScenarioRepository", () => {
  let repo: InMemoryScenarioRepository;

  beforeEach(() => {
    repo = new InMemoryScenarioRepository();
  });

  it("registers and retrieves a scenario by id + version", () => {
    const scenario = makeScenario();
    repo.register(scenario);
    expect(repo.get("SCRIBE-TEST-001", "1.0")).toEqual(scenario);
  });

  it("refuses to register the same scenario id+version twice", () => {
    repo.register(makeScenario());
    expect(() => repo.register(makeScenario())).toThrow(/already registered/);
  });

  it("returns undefined for an unknown scenario", () => {
    expect(repo.get("NOPE", "1.0")).toBeUndefined();
  });

  it("getLatest picks the highest version across registered instances", () => {
    repo.register(makeScenario({ version: "1.0" }));
    repo.register(makeScenario({ version: "1.10" }));
    repo.register(makeScenario({ version: "1.2" }));
    expect(repo.getLatest("SCRIBE-TEST-001")?.version).toBe("1.10");
  });

  it("getLatest returns undefined when the scenarioId has no registered versions", () => {
    expect(repo.getLatest("NOPE")).toBeUndefined();
  });

  it("list with no filter returns every registered scenario", () => {
    repo.register(makeScenario({ version: "1.0" }));
    repo.register(makeScenario({ scenarioId: "SCRIBE-TEST-002", version: "1.0" }));
    expect(repo.list()).toHaveLength(2);
  });

  it("filters by specialty", () => {
    repo.register(makeScenario({ scenarioId: "A", specialty: "Family Medicine" }));
    repo.register(makeScenario({ scenarioId: "B", specialty: "Cardiology" }));
    expect(repo.list({ specialty: "Cardiology" })).toHaveLength(1);
  });

  it("filters by difficulty", () => {
    repo.register(makeScenario({ scenarioId: "A", difficulty: 1 }));
    repo.register(makeScenario({ scenarioId: "B", difficulty: 4 }));
    expect(repo.list({ difficulty: 4 })).toHaveLength(1);
  });

  it("filters by tags (matches any)", () => {
    repo.register(makeScenario({ scenarioId: "A", tags: ["respiratory"] }));
    repo.register(makeScenario({ scenarioId: "B", tags: ["cardiac"] }));
    expect(repo.list({ tags: ["respiratory", "renal"] })).toHaveLength(1);
  });

  it("combines multiple filters", () => {
    repo.register(makeScenario({ scenarioId: "A", specialty: "Family Medicine", difficulty: 1 }));
    repo.register(makeScenario({ scenarioId: "B", specialty: "Family Medicine", difficulty: 4 }));
    expect(repo.list({ specialty: "Family Medicine", difficulty: 4 })).toHaveLength(1);
  });
});
