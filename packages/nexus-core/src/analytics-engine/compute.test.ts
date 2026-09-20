// Call sites updated for decision D5 (2026-09-20): competency and analytics
// are computed per result population. These fixtures are all practice-mode, so
// they pass "practice" and assert exactly what they asserted before - the
// population argument is threaded through, no expectation was changed.
import { describe, expect, it } from "vitest";
import { computeAnalytics } from "./compute.js";
import type { SessionRecord } from "../persistence/types.js";
import type { CompetencyRecord } from "../competency-engine/index.js";
import type { EvaluationError } from "../evaluation-engine/types.js";

function makeSession(scenarioId: string, overallScore: number | null, errors: EvaluationError[] = []): SessionRecord {
  return {
    id: `s-${Math.random()}`,
    scenarioId,
    scenarioVersion: "1.0",
    scenarioTitle: scenarioId,
    mode: "practice",
    status: overallScore === null ? "in_progress" : "completed",
    startedAt: 1000,
    activeMs: 60000,
    pausedMs: 0,
    completedAt: overallScore === null ? null : 2000,
    flags: [],
    draft: { chiefComplaint: "", hpi: "", ros: "", physicalExam: "", assessment: "", plan: "", additionalNotes: "" },
    evaluation:
      overallScore === null
        ? null
        : {
            overallScore,
            categoryScores: {
              accuracy: 100,
              completeness: 100,
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

function makeError(errorType: EvaluationError["errorType"]): EvaluationError {
  return { id: `e-${Math.random()}`, errorType, severity: "minor", section: "hpi", what: "", why: "", how: "" };
}

function makeCompetency(domain: string, avgScore: number, attemptCount: number): CompetencyRecord {
  return {
    population: "practice",
    domain,
    level: "developing",
    avgScore,
    recentScore: avgScore,
    trend: "flat",
    attemptCount,
    confidence: 0.5,
    recentScores: [avgScore],
    updatedAt: 1000
  };
}

describe("computeAnalytics - empty-data behavior", () => {
  it("returns null average and insufficient-data trend with no sessions at all", () => {
    const result = computeAnalytics("practice", [], [], 2);
    expect(result.sessionsEvaluated).toBe(0);
    expect(result.averageScore).toBeNull();
    expect(result.trend).toBe("insufficient-data");
    expect(result.weakestAreas).toEqual([]);
    expect(result.strongestAreas).toEqual([]);
    expect(result.errorTrends).toEqual([]);
    expect(result.scenarioProgress).toEqual({ attempted: 0, total: 2 });
  });

  it("ignores in-progress (unevaluated) sessions entirely for scoring", () => {
    const result = computeAnalytics("practice", [makeSession("A", null)], [], 2);
    expect(result.sessionsEvaluated).toBe(0);
    expect(result.averageScore).toBeNull();
    // scenario progress still counts it as "attempted" even if not evaluated
    expect(result.scenarioProgress.attempted).toBe(1);
  });
});

describe("computeAnalytics - averages and trend", () => {
  it("computes a plain average with fewer than 4 sessions (insufficient-data trend)", () => {
    const sessions = [makeSession("A", 80), makeSession("A", 90)];
    const result = computeAnalytics("practice", sessions, [], 1);
    expect(result.averageScore).toBe(85);
    expect(result.trend).toBe("insufficient-data");
  });

  it("detects an upward trend when recent sessions score meaningfully higher", () => {
    // newest-first: recent half scores much higher than older half
    const sessions = [makeSession("A", 95), makeSession("A", 92), makeSession("A", 60), makeSession("A", 58)];
    const result = computeAnalytics("practice", sessions, [], 1);
    expect(result.trend).toBe("up");
  });

  it("detects a downward trend when recent sessions score meaningfully lower", () => {
    const sessions = [makeSession("A", 55), makeSession("A", 58), makeSession("A", 90), makeSession("A", 92)];
    const result = computeAnalytics("practice", sessions, [], 1);
    expect(result.trend).toBe("down");
  });

  it("reports flat when scores are within the tolerance band", () => {
    const sessions = [makeSession("A", 81), makeSession("A", 80), makeSession("A", 79), makeSession("A", 80)];
    const result = computeAnalytics("practice", sessions, [], 1);
    expect(result.trend).toBe("flat");
  });
});

describe("computeAnalytics - weak/strong areas", () => {
  it("excludes domains with zero attempts", () => {
    const competencies = [makeCompetency("HPI", 40, 3), makeCompetency("ROS", 0, 0)];
    const result = computeAnalytics("practice", [], competencies, 1);
    expect(result.weakestAreas.map((a) => a.domain)).toEqual(["HPI"]);
  });

  it("sorts weakest ascending and strongest descending by avgScore", () => {
    const competencies = [
      makeCompetency("A", 90, 5),
      makeCompetency("B", 40, 5),
      makeCompetency("C", 70, 5),
      makeCompetency("D", 20, 5)
    ];
    const result = computeAnalytics("practice", [], competencies, 1);
    expect(result.weakestAreas.map((a) => a.domain)).toEqual(["D", "B", "C"]);
    expect(result.strongestAreas.map((a) => a.domain)).toEqual(["A", "C", "B"]);
  });
});

describe("computeAnalytics - error trends", () => {
  it("aggregates and sorts error type frequency descending", () => {
    const sessions = [
      makeSession("A", 70, [makeError("omission"), makeError("omission")]),
      makeSession("A", 80, [makeError("fabrication")])
    ];
    const result = computeAnalytics("practice", sessions, [], 1);
    expect(result.errorTrends).toEqual([
      { errorType: "omission", count: 2 },
      { errorType: "fabrication", count: 1 }
    ]);
  });

  it("returns an empty array when no errors occurred", () => {
    const result = computeAnalytics("practice", [makeSession("A", 100)], [], 1);
    expect(result.errorTrends).toEqual([]);
  });
});

describe("computeAnalytics - scenario progress", () => {
  it("counts distinct scenarios attempted against the total available", () => {
    const sessions = [makeSession("A", 80), makeSession("A", 90), makeSession("B", 70)];
    const result = computeAnalytics("practice", sessions, [], 5);
    expect(result.scenarioProgress).toEqual({ attempted: 2, total: 5 });
  });
});

describe("computeAnalytics - large history datasets", () => {
  it("computes correctly over 200 sessions without error", () => {
    const sessions = Array.from({ length: 200 }, (_, i) =>
      makeSession(i % 3 === 0 ? "A" : "B", 50 + (i % 50), i % 7 === 0 ? [makeError("omission")] : [])
    );
    const result = computeAnalytics("practice", sessions, [], 3);
    expect(result.sessionsEvaluated).toBe(200);
    expect(result.averageScore).not.toBeNull();
    expect(Number.isFinite(result.averageScore!)).toBe(true);
    expect(result.scenarioProgress.attempted).toBe(2);
    expect(result.errorTrends.find((e) => e.errorType === "omission")?.count).toBeGreaterThan(0);
  });
});

describe("computeAnalytics - malformed/incomplete data resilience", () => {
  it("excludes a session whose evaluation has a non-finite overallScore rather than poisoning the average", () => {
    const corrupted = makeSession("A", 80);
    // Simulate corrupted/partial data reaching this function despite the
    // type system - e.g. from an imperfect deserialization.
    (corrupted.evaluation as { overallScore: number }).overallScore = NaN;
    const sessions = [makeSession("A", 90), corrupted];

    const result = computeAnalytics("practice", sessions, [], 1);
    expect(result.sessionsEvaluated).toBe(1);
    expect(result.averageScore).toBe(90);
  });

  it("tolerates a missing errors array on an evaluation without throwing", () => {
    const malformed = makeSession("A", 80);
    // @ts-expect-error - deliberately simulating malformed data that
    // bypasses the type system, to prove the runtime guard works.
    malformed.evaluation.errors = undefined;

    expect(() => computeAnalytics("practice", [malformed], [], 1)).not.toThrow();
    const result = computeAnalytics("practice", [malformed], [], 1);
    expect(result.errorTrends).toEqual([]);
  });
});
