// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createEmptyDraft,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type SessionRecord
} from "@haa-nexus/nexus-core";
import { Dashboard } from "./Dashboard.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";

/**
 * Phase 8.2: resuming an interrupted session must not destroy it when the
 * scenario is locked.
 *
 * Before 8.2 the Dashboard abandoned the interrupted record *first* and
 * started the new attempt second. Once `start` can refuse, that order
 * would abandon a learner's interrupted session for an attempt that never
 * began. A learner can genuinely hold such a record: before 8.2 anyone
 * could start the difficulty-3 scenario.
 */

function interruptedRecord(id: string, scenarioId: string, scenarioTitle: string): SessionRecord {
  return {
    id,
    scenarioId,
    scenarioVersion: "1.0",
    scenarioTitle,
    mode: "practice",
    status: "in_progress",
    startedAt: 1_700_000_000_000,
    activeMs: 30_000,
    pausedMs: 0,
    completedAt: null,
    flags: [],
    draft: { ...createEmptyDraft(), hpi: "draft written before the interruption" },
    evaluation: null
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Dashboard - resuming an interrupted session under entitlement gating", () => {
  it("keeps a locked interrupted session intact and explains why it cannot start", async () => {
    await sessionRepository.save(
      interruptedRecord("locked-1", "SCRIBE-IM-032", "Fatigue and Palpitations, Internal Medicine")
    );
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Start a new attempt" }));

    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    expect(alert.mock.calls[0]![0]).toMatch(/locked.*included with Practice Access/i);

    // No session started...
    expect(useSessionStore.getState().session).toBeNull();
    // ...and the interrupted record was NOT abandoned.
    const stored = await sessionRepository.get("locked-1");
    expect(stored?.status).toBe("in_progress");
    expect(stored?.draft.hpi).toBe("draft written before the interruption");
  });

  it("still resumes an unlocked interrupted session and abandons the old record", async () => {
    await sessionRepository.save(
      interruptedRecord("open-1", "SCRIBE-FM-014", "Three-Day Cough, Family Medicine")
    );
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Start a new attempt" }));

    await waitFor(async () => expect((await sessionRepository.get("open-1"))?.status).toBe("abandoned"));
    expect(useSessionStore.getState().session?.scenarioId).toBe("SCRIBE-FM-014");
    expect(alert).not.toHaveBeenCalled();
  });
});
