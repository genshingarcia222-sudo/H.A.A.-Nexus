import { describe, expect, it, beforeEach } from "vitest";
import { generateRecommendations, createEmptyDraft, InMemorySessionRepository } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository, lessonRepository } from "./scenarios.js";

describe("recommendation flow (Phase 6) - the same sequence SubmissionSummary runs", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    // sessionRepository is a module-level singleton (matching how the real
    // app uses it); clear it between tests so one test's submissions don't
    // leak into another's recommendation lookback window.
    (sessionRepository as InMemorySessionRepository).clear();
  });

  it("recommends the accuracy lesson after submitting a fabricated value", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, updateField, submit } = useSessionStore.getState();

    start(scenario, "practice");
    updateField("ros", "No fever. Temperature 37.0°C.");
    await submit();

    const history = await sessionRepository.list();
    const recs = generateRecommendations(history, scenario.scenarioId, Date.now());

    const accuracyRec = recs.find((r) => r.recommendedId === "accuracy-and-unsupported-inference");
    expect(accuracyRec).toBeDefined();
    // Confirm the recommended lesson actually exists in the shipped content
    // (this is exactly the cross-check the content-QA test in nexus-core
    // also runs, exercised here through the live app wiring instead).
    expect(lessonRepository.get(accuracyRec!.recommendedId)).toBeDefined();
  });

  it("recommends HPI remediation after two separate sessions with HPI omissions", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, submit } = useSessionStore.getState();

    // Two clean-slate submissions, each omitting everything (including HPI).
    start(scenario, "practice");
    await submit();
    start(scenario, "practice");
    await submit();

    const history = await sessionRepository.list();
    const recs = generateRecommendations(history, scenario.scenarioId, Date.now());
    expect(recs.some((r) => r.recommendedId === "hpi-fundamentals")).toBe(true);
  });

  it("produces no recommendations after a single clean, fully-documented submission", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, updateField, submit } = useSessionStore.getState();

    start(scenario, "practice");
    updateField("chiefComplaint", "Cough x3 days.");
    updateField("hpi", "Non-productive cough x3 days.");
    updateField("ros", "No fever. Denies dyspnea.");
    await submit();

    const history = await sessionRepository.list();
    const recs = generateRecommendations(history, scenario.scenarioId, Date.now());
    expect(recs).toEqual([]);
  });

  it("draft passed to createEmptyDraft never accidentally satisfies a requirement (sanity check for the omission test above)", () => {
    const draft = createEmptyDraft();
    expect(Object.values(draft).every((v) => v === "")).toBe(true);
  });
});
