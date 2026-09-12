import { describe, expect, it } from "vitest";
import { generateRecommendations } from "./index.js";
import type { SessionRecord } from "../persistence/types.js";
import type { EvaluationError } from "../evaluation-engine/types.js";

function makeSession(errors: EvaluationError[]): SessionRecord {
  return {
    id: `s-${Math.random()}`,
    scenarioId: "SCRIBE-FM-014",
    scenarioVersion: "1.0",
    scenarioTitle: "Three-Day Cough",
    mode: "practice",
    status: "completed",
    startedAt: 1000,
    activeMs: 60000,
    pausedMs: 0,
    completedAt: 2000,
    flags: [],
    draft: { chiefComplaint: "", hpi: "", ros: "", physicalExam: "", assessment: "", plan: "", additionalNotes: "" },
    evaluation: {
      overallScore: 70,
      categoryScores: {
        accuracy: 100,
        completeness: 70,
        terminology: 100,
        relevance: 100,
        structure: 100,
        pertinentPosNeg: 100,
        timeEfficiency: 100
      },
      errors,
      scoringWeightsUsed: {
        accuracy: 0.25,
        completeness: 0.2,
        terminology: 0.15,
        relevance: 0.1,
        structure: 0.1,
        pertinentPosNeg: 0.1,
        timeEfficiency: 0.1
      },
      timeEfficiencyRatio: 0.5,
      evaluatedAt: 1500
    }
  };
}

function makeError(errorType: EvaluationError["errorType"], section: EvaluationError["section"] = "hpi"): EvaluationError {
  return { id: `e-${Math.random()}`, errorType, severity: "minor", section, what: "", why: "", how: "" };
}

describe("generateRecommendations", () => {
  it("recommends HPI fundamentals after 2 HPI omissions in recent history", () => {
    const history = [makeSession([makeError("omission", "hpi")]), makeSession([makeError("omission", "hpi")])];
    const recs = generateRecommendations(history, "SCRIBE-FM-014", 1000);
    expect(recs.some((r) => r.recommendedId === "hpi-fundamentals")).toBe(true);
  });

  it("does not recommend HPI fundamentals after only 1 HPI omission", () => {
    const history = [makeSession([makeError("omission", "hpi")])];
    const recs = generateRecommendations(history, "SCRIBE-FM-014", 1000);
    expect(recs.some((r) => r.recommendedId === "hpi-fundamentals")).toBe(false);
  });

  it("does not recommend HPI fundamentals for omissions in a different section", () => {
    const history = [makeSession([makeError("omission", "ros")]), makeSession([makeError("omission", "ros")])];
    const recs = generateRecommendations(history, "SCRIBE-FM-014", 1000);
    expect(recs.some((r) => r.recommendedId === "hpi-fundamentals")).toBe(false);
  });

  it("recommends terminology training after 2 incorrect_terminology errors", () => {
    const history = [makeSession([makeError("incorrect_terminology")]), makeSession([makeError("incorrect_terminology")])];
    const recs = generateRecommendations(history, "SCRIBE-FM-014", 1000);
    expect(recs.some((r) => r.recommendedId === "medical-terminology")).toBe(true);
  });

  it("recommends retrying the current scenario after 2 time_management errors", () => {
    const history = [makeSession([makeError("time_management")]), makeSession([makeError("time_management")])];
    const recs = generateRecommendations(history, "SCRIBE-IM-032", 1000);
    const rec = recs.find((r) => r.recommendedType === "scenario");
    expect(rec?.recommendedId).toBe("SCRIBE-IM-032");
  });

  it("recommends accuracy training after a single fabrication (no repetition required)", () => {
    const history = [makeSession([makeError("fabrication")])];
    const recs = generateRecommendations(history, "SCRIBE-FM-014", 1000);
    expect(recs.some((r) => r.recommendedId === "accuracy-and-unsupported-inference")).toBe(true);
  });

  it("returns no recommendations for a clean history", () => {
    const history = [makeSession([])];
    expect(generateRecommendations(history, "SCRIBE-FM-014", 1000)).toEqual([]);
  });

  it("only considers sessions within the lookback window", () => {
    // 2 HPI omissions, but beyond a lookback of 1 - should not fire
    const history = [makeSession([]), makeSession([makeError("omission", "hpi")]), makeSession([makeError("omission", "hpi")])];
    const recs = generateRecommendations(history, "SCRIBE-FM-014", 1000, 1);
    expect(recs.some((r) => r.recommendedId === "hpi-fundamentals")).toBe(false);
  });
});
