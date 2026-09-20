// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  computeAnalytics,
  createEmptyDraft,
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type SessionRecord
} from "@haa-nexus/nexus-core";
import { Dashboard } from "./Dashboard.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Decision D6 — what happens to an interrupted Assessment.
 *
 * Owner-delegated, selected 2026-09-20: **a learner may retake an interrupted
 * Assessment as a new attempt.** The interrupted attempt is recorded as
 * abandoned rather than deleted, and contributes nothing. Exact in-place
 * resume is deliberately *not* offered: restoring an attempt changes elapsed
 * time, which feeds `timeEfficiencyRatio` and therefore the score, and that is
 * D8 (with A6 as its engineering half) - still undecided.
 *
 * Why a retake does not undermine exam integrity: D2 means the learner can see
 * no performance information at all during an active Assessment, so there is
 * nothing to score-shop against, and the abandoned record keeps the audit
 * trail. An interrupted Assessment carries no evaluation, so under D5 it
 * counts in neither population.
 *
 * The behaviour these pin already existed; D6 authorizes it, and this file is
 * what stops it being changed by accident.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

const PRO = { tier: "pro", status: "active", currentPeriodEnd: null, fastTrackPurchased: false } as const;

/** An Assessment left in_progress - how an interruption is actually recorded. */
function interruptedAssessment(id = "a-interrupted"): SessionRecord {
  return {
    id,
    scenarioId: SCENARIO.scenarioId,
    scenarioVersion: SCENARIO.version,
    scenarioTitle: SCENARIO.title,
    mode: "assessment",
    status: "in_progress",
    startedAt: 1_700_000_000_000,
    activeMs: 30_000,
    pausedMs: 0,
    completedAt: null,
    flags: [],
    draft: { ...createEmptyDraft(), hpi: "written before the interruption" },
    // An active assessment never carries an evaluation (D2).
    evaluation: null
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  (competencyRepository as InMemoryCompetencyRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("D6: an interrupted Assessment may be retaken as a new attempt", () => {
  it("offers the retake, and starts a genuinely fresh Assessment", async () => {
    await sessionRepository.save(interruptedAssessment());
    useEntitlementStore.getState().setSubscription(PRO);
    render(<Dashboard />);

    const button = await screen.findByRole("button", { name: "Start a new attempt" });
    fireEvent.click(button);

    await waitFor(() => expect(useSessionStore.getState().session).not.toBeNull());
    const session = useSessionStore.getState().session!;
    expect(session.mode).toBe("assessment");
    expect(session.status).toBe("in_progress");
    // A new attempt, not the old one carried forward.
    expect(session.id).not.toBe("a-interrupted");
    expect(session.activeMs).toBe(0);
    expect(useSessionStore.getState().draft.hpi).toBe("");
  });

  it("records the interrupted attempt as abandoned rather than deleting it", async () => {
    await sessionRepository.save(interruptedAssessment());
    useEntitlementStore.getState().setSubscription(PRO);
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Start a new attempt" }));

    await waitFor(async () => {
      const old = await sessionRepository.get("a-interrupted");
      expect(old?.status).toBe("abandoned");
    });
    // The learner's work is still there - the audit trail is kept, not erased.
    const old = await sessionRepository.get("a-interrupted");
    expect(old?.draft.hpi).toBe("written before the interruption");
    expect(old?.mode).toBe("assessment");
  });

  it("does not offer an in-place resume, because that would decide D8", async () => {
    await sessionRepository.save(interruptedAssessment());
    useEntitlementStore.getState().setSubscription(PRO);
    render(<Dashboard />);

    await screen.findByRole("button", { name: "Start a new attempt" });
    expect(screen.queryByRole("button", { name: /^Resume/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /continue where/i })).toBeNull();
  });

  it("still honours D1: a tier that may not start an Assessment is refused, and the record survives", async () => {
    // D6 permits a retake; it does not grant entitlement. Free cannot start an
    // assessment at all, so the refusal must leave the interrupted record
    // intact rather than abandoning it for an attempt that never began.
    await sessionRepository.save(interruptedAssessment());
    useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Start a new attempt" }));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(useSessionStore.getState().session).toBeNull();
    expect((await sessionRepository.get("a-interrupted"))?.status).toBe("in_progress");
  });

  it("lets the learner discard it instead, without starting anything", async () => {
    await sessionRepository.save(interruptedAssessment());
    useEntitlementStore.getState().setSubscription(PRO);
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));

    await waitFor(async () => {
      expect((await sessionRepository.get("a-interrupted"))?.status).toBe("abandoned");
    });
    expect(useSessionStore.getState().session).toBeNull();
  });
});

describe("D6 interacts with D5 without redefining it", () => {
  it("an abandoned Assessment counts in neither population", async () => {
    await sessionRepository.save({ ...interruptedAssessment(), status: "abandoned" });

    const sessions = await sessionRepository.list();
    const competencies = await competencyRepository.list();

    // No evaluation, so it is not a scored attempt in either aggregate (D5),
    // and nothing was ever folded into competency.
    expect(computeAnalytics("assessment", sessions, competencies, 2).sessionsEvaluated).toBe(0);
    expect(computeAnalytics("practice", sessions, competencies, 2).sessionsEvaluated).toBe(0);
    expect(competencies).toEqual([]);
  });

  it("a completed retake counts in the assessment population only", async () => {
    await sessionRepository.save({ ...interruptedAssessment(), status: "abandoned" });
    useEntitlementStore.getState().setSubscription(PRO);

    expect(useSessionStore.getState().start(SCENARIO, "assessment")).toBe(true);
    useSessionStore.getState().updateField("chiefComplaint", "Non-productive cough x3 days");
    await useSessionStore.getState().submit();

    const records = await competencyRepository.list();
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.population === "assessment")).toBe(true);
    // The abandoned attempt did not add a second scored session.
    const sessions = await sessionRepository.list();
    expect(computeAnalytics("assessment", sessions, records, 2).sessionsEvaluated).toBe(1);
  });
});
