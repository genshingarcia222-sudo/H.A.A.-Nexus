import { describe, expect, it, beforeEach } from "vitest";
import { computeAnalytics, InMemorySessionRepository } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "./scenarios.js";

describe("analytics flow (Phase 7) - real submissions through to computeAnalytics", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    (sessionRepository as InMemorySessionRepository).clear();
  });

  it("reflects a real fully-correct submission in overall performance", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, updateField, submit } = useSessionStore.getState();

    start(scenario, "practice");
    updateField("chiefComplaint", "Cough x3 days.");
    updateField("hpi", "Non-productive cough x3 days.");
    updateField("ros", "No fever. Denies dyspnea.");
    await submit();

    const [sessions, competencies] = await Promise.all([sessionRepository.list(), competencyRepository.list()]);
    const summary = computeAnalytics("practice", sessions, competencies, scenarioRepository.list().length);

    expect(summary.sessionsEvaluated).toBe(1);
    expect(summary.averageScore).toBeGreaterThan(95);
    expect(summary.scenarioProgress).toEqual({ attempted: 1, total: 2 });
    expect(summary.errorTrends).toEqual([]);
  });

  it("surfaces a fabrication error in the recurring-errors trend after a real submission", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, updateField, submit } = useSessionStore.getState();

    start(scenario, "practice");
    updateField("ros", "No fever. Temperature 37.0°C.");
    await submit();

    const [sessions, competencies] = await Promise.all([sessionRepository.list(), competencyRepository.list()]);
    const summary = computeAnalytics("practice", sessions, competencies, scenarioRepository.list().length);

    expect(summary.errorTrends.some((e) => e.errorType === "fabrication")).toBe(true);
  });

  it("shows weakest/strongest areas reflecting real competency records after submission", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, submit } = useSessionStore.getState();

    start(scenario, "practice"); // empty draft -> low completeness, full accuracy
    await submit();

    const [sessions, competencies] = await Promise.all([sessionRepository.list(), competencyRepository.list()]);
    const summary = computeAnalytics("practice", sessions, competencies, scenarioRepository.list().length);

    // completeness is unambiguously the/a weakest domain (score 0, no ties
    // at that level for this scenario+empty-draft combination).
    expect(summary.weakestAreas.some((a) => a.domain === "completeness")).toBe(true);
    // Several domains tie at the maximum score for an empty-but-not-fabricating
    // submission (accuracy, terminology, structure, timeEfficiency all score
    // 100) - which specific 3 land in the top-3 "strongest" slice among a
    // 4-way tie is arbitrary insertion-order behavior, not a guaranteed
    // per-domain property. Assert the property that IS guaranteed instead.
    expect(summary.strongestAreas).toHaveLength(3);
    expect(summary.strongestAreas.every((a) => a.avgScore === 100)).toBe(true);
  });
});
