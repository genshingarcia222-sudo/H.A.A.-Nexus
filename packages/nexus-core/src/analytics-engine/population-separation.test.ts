import { describe, expect, it } from "vitest";
import { computeAnalytics } from "./compute.js";
import { updateCompetencyRecord, type CompetencyRecord } from "../competency-engine/index.js";
import type { SessionRecord } from "../persistence/types.js";
import type { SimulationMode } from "../simulation-engine/types.js";
import type { EvaluationResult } from "../evaluation-engine/types.js";

/**
 * Decision D5 — Practice and Assessment are separate analytics populations.
 *
 * The separation is in the aggregation, not in the presentation: these call
 * `computeAnalytics` directly with a mixed dataset and assert each population
 * sees only its own attempts. A UI that filtered correctly over a merged
 * aggregate would fail these.
 */

function session(id: string, mode: SimulationMode, score: number | null, startedAt: number): SessionRecord {
  const evaluation =
    score === null
      ? null
      : ({ overallScore: score, errors: [{ errorType: "omission", section: "hpi" }] } as unknown as EvaluationResult);
  return {
    id,
    scenarioId: `SCEN-${mode}`,
    scenarioVersion: "1.0",
    scenarioTitle: "Test",
    mode,
    status: "completed",
    startedAt,
    activeMs: 1000,
    pausedMs: 0,
    completedAt: startedAt + 1000,
    flags: [],
    draft: {} as SessionRecord["draft"],
    evaluation
  };
}

function competency(population: "practice" | "assessment", domain: string, score: number): CompetencyRecord {
  return updateCompetencyRecord(undefined, population, domain, score, 1000);
}

const TOTAL_SCENARIOS = 5;

describe("D5: analytics aggregate one population at a time", () => {
  const mixed = [
    session("a1", "assessment", 40, 4000),
    session("p1", "practice", 90, 3000),
    session("s1", "simulation", 80, 2000),
    session("a2", "assessment", 50, 1000)
  ];
  const competencies = [competency("practice", "accuracy", 85), competency("assessment", "accuracy", 45)];

  it("a practice-only dataset produces the existing practice result", () => {
    const practiceOnly = [session("p1", "practice", 90, 2000), session("p2", "practice", 70, 1000)];
    const summary = computeAnalytics("practice", practiceOnly, [competency("practice", "accuracy", 80)], TOTAL_SCENARIOS);

    expect(summary.sessionsEvaluated).toBe(2);
    expect(summary.averageScore).toBe(80);
  });

  it("an assessment-only dataset produces an assessment result", () => {
    const assessmentOnly = [session("a1", "assessment", 40, 2000), session("a2", "assessment", 60, 1000)];
    const summary = computeAnalytics(
      "assessment",
      assessmentOnly,
      [competency("assessment", "accuracy", 50)],
      TOTAL_SCENARIOS
    );

    expect(summary.sessionsEvaluated).toBe(2);
    expect(summary.averageScore).toBe(50);
  });

  it("a mixed dataset produces two distinct aggregates", () => {
    const practice = computeAnalytics("practice", mixed, competencies, TOTAL_SCENARIOS);
    const assessment = computeAnalytics("assessment", mixed, competencies, TOTAL_SCENARIOS);

    // practice + simulation: (90 + 80) / 2
    expect(practice.sessionsEvaluated).toBe(2);
    expect(practice.averageScore).toBe(85);
    // assessment: (40 + 50) / 2
    expect(assessment.sessionsEvaluated).toBe(2);
    expect(assessment.averageScore).toBe(45);
    expect(practice.averageScore).not.toBe(assessment.averageScore);
  });

  it("assessment records do not inflate practice analytics", () => {
    const withoutAssessment = mixed.filter((s) => s.mode !== "assessment");
    expect(computeAnalytics("practice", mixed, competencies, TOTAL_SCENARIOS)).toEqual(
      computeAnalytics("practice", withoutAssessment, competencies, TOTAL_SCENARIOS)
    );
  });

  it("practice records do not inflate assessment analytics", () => {
    const onlyAssessment = mixed.filter((s) => s.mode === "assessment");
    expect(computeAnalytics("assessment", mixed, competencies, TOTAL_SCENARIOS)).toEqual(
      computeAnalytics("assessment", onlyAssessment, competencies, TOTAL_SCENARIOS)
    );
  });

  it("simulation counts as practice, exactly where it always counted", () => {
    const simOnly = [session("s1", "simulation", 80, 1000)];
    expect(computeAnalytics("practice", simOnly, [], TOTAL_SCENARIOS).sessionsEvaluated).toBe(1);
    expect(computeAnalytics("assessment", simOnly, [], TOTAL_SCENARIOS).sessionsEvaluated).toBe(0);
  });

  it("an empty assessment population behaves correctly rather than throwing", () => {
    const practiceOnly = [session("p1", "practice", 90, 1000)];
    const summary = computeAnalytics("assessment", practiceOnly, competencies, TOTAL_SCENARIOS);

    expect(summary.sessionsEvaluated).toBe(0);
    expect(summary.averageScore).toBeNull();
    expect(summary.trend).toBe("insufficient-data");
    expect(summary.errorTrends).toEqual([]);
    expect(summary.scenarioProgress).toEqual({ attempted: 0, total: TOTAL_SCENARIOS });
  });

  it("keeps competency snapshots in their own population", () => {
    const practice = computeAnalytics("practice", mixed, competencies, TOTAL_SCENARIOS);
    const assessment = computeAnalytics("assessment", mixed, competencies, TOTAL_SCENARIOS);

    expect(practice.strongestAreas.map((a) => Math.round(a.avgScore))).toEqual([85]);
    expect(assessment.strongestAreas.map((a) => Math.round(a.avgScore))).toEqual([45]);
  });

  it("scopes scenario progress to the population", () => {
    // Attempting a scenario in an assessment does not mark it attempted in
    // practice: the two populations answer "what have I attempted" separately.
    const practice = computeAnalytics("practice", mixed, competencies, TOTAL_SCENARIOS);
    const assessment = computeAnalytics("assessment", mixed, competencies, TOTAL_SCENARIOS);

    expect(practice.scenarioProgress.attempted).toBe(2); // SCEN-practice, SCEN-simulation
    expect(assessment.scenarioProgress.attempted).toBe(1); // SCEN-assessment
  });

  it("preserves the existing validity filtering inside each population", () => {
    // Unevaluated and non-finite scores are still excluded, as before D5.
    const withJunk = [
      session("a1", "assessment", 40, 3000),
      session("a2", "assessment", null, 2000),
      session("a3", "assessment", Number.NaN, 1000)
    ];
    const summary = computeAnalytics("assessment", withJunk, [], TOTAL_SCENARIOS);

    expect(summary.sessionsEvaluated).toBe(1);
    expect(summary.averageScore).toBe(40);
  });
});
