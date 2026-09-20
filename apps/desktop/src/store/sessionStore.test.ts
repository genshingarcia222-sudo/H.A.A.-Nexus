import { describe, expect, it, beforeEach } from "vitest";
import { useSessionStore } from "./sessionStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";
import { InMemorySessionRepository } from "@haa-nexus/nexus-core";

describe("sessionStore - persistence integration (Phase 5)", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    (sessionRepository as InMemorySessionRepository).clear();
  });

  it("persists a completed session to the repository on submit", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, updateField, submit } = useSessionStore.getState();

    start(scenario, "practice");
    const sessionId = useSessionStore.getState().session!.id;

    updateField("chiefComplaint", "Cough x3 days.");
    updateField("hpi", "Non-productive cough x3 days.");
    updateField("ros", "No fever. Denies dyspnea.");

    await submit();

    const saved = await sessionRepository.get(sessionId);
    expect(saved?.status).toBe("completed");
    expect(saved?.evaluation?.overallScore).toBeGreaterThan(90);
    expect(saved?.draft.chiefComplaint).toBe("Cough x3 days.");
  });

  it("persists an in-progress draft via persistDraft (the autosave path)", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, updateField, persistDraft } = useSessionStore.getState();

    start(scenario, "practice");
    const sessionId = useSessionStore.getState().session!.id;
    updateField("hpi", "Draft in progress.");

    await persistDraft();

    const saved = await sessionRepository.get(sessionId);
    expect(saved?.status).toBe("in_progress");
    expect(saved?.evaluation).toBeNull();
    expect(saved?.draft.hpi).toBe("Draft in progress.");
  });

  it("updates competency records for every scoring domain after submit", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, submit } = useSessionStore.getState();

    start(scenario, "practice");
    await submit();

    const accuracyRecord = await competencyRepository.get("practice", "accuracy");
    expect(accuracyRecord).toBeDefined();
    expect(accuracyRecord?.attemptCount).toBeGreaterThan(0);
  });

  it("shows up in findInterrupted while paused, and not once completed", async () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
    const { start, pause, submit } = useSessionStore.getState();

    start(scenario, "practice");
    const sessionId = useSessionStore.getState().session!.id;
    pause(); // this already calls persistDraft() internally

    let interrupted = await sessionRepository.findInterrupted();
    expect(interrupted.some((r) => r.id === sessionId)).toBe(true);

    useSessionStore.getState().resume();
    await submit();

    interrupted = await sessionRepository.findInterrupted();
    expect(interrupted.some((r) => r.id === sessionId)).toBe(false);
  });
});
