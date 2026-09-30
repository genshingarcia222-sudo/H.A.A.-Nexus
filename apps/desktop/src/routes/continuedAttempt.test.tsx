// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createEmptyDraft,
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type SimulationMode,
  type SessionRecord
} from "@haa-nexus/nexus-core";
import { Dashboard } from "./Dashboard.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Decision D8 — what happens to an interrupted practice or simulation attempt.
 *
 * Resolved 2026-10-01 under the owner's standing authorization (not an owner
 * decision): **an interrupted attempt is never resumed in place.** The learner
 * may carry their draft into a *new* attempt, and the time already measured on
 * that draft travels with it. The gap while the application was closed is not
 * counted, because nothing measured it.
 *
 * Two things make that safe, and both are pinned here: the carried clock, and
 * the exclusion of Assessment, which D6 settled the other way.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
/** Difficulty 3 - above the free tier's ceiling of 2, so a free learner is refused. */
const LOCKED = scenarioRepository.get("SCRIBE-IM-032", "1.0")!;
const PRO = { tier: "pro", status: "active", currentPeriodEnd: null, fastTrackPurchased: false } as const;

const DRAFT_TEXT = "45-year-old with two days of productive cough";

function interruptedAttempt(mode: SimulationMode, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `x-${mode}`,
    scenarioId: SCENARIO.scenarioId,
    scenarioVersion: SCENARIO.version,
    scenarioTitle: SCENARIO.title,
    mode,
    status: "in_progress",
    startedAt: 1_700_000_000_000,
    activeMs: 240_000,
    pausedMs: 0,
    completedAt: null,
    flags: [],
    draft: { ...createEmptyDraft(), hpi: DRAFT_TEXT },
    evaluation: null,
    ...overrides
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  (competencyRepository as InMemoryCompetencyRepository).clear();
  useEntitlementStore.getState().setSubscription(PRO);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("D8: continuing from an interrupted draft", () => {
  it("carries the draft and the time measured on it into a new attempt", async () => {
    await sessionRepository.save(interruptedAttempt("practice"));
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue from your draft" }));

    await waitFor(() => expect(useSessionStore.getState().session).not.toBeNull());
    const state = useSessionStore.getState();
    expect(state.draft.hpi).toBe(DRAFT_TEXT);
    // The clock the new attempt starts on. Carrying the work without the time
    // would let a learner finish, restart, and submit in seconds on a zero
    // clock - and timeEfficiency feeds the score.
    expect(state.session!.activeMs).toBe(240_000);
    // Still a new attempt, not the old one restored.
    expect(state.session!.id).not.toBe("x-practice");
    expect(state.session!.status).toBe("in_progress");
    expect(state.session!.pausedMs).toBe(0);
    expect(state.session!.flags).toEqual([]);
  });

  it("leaves the interrupted record abandoned, with the learner's work intact", async () => {
    await sessionRepository.save(interruptedAttempt("practice"));
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue from your draft" }));

    await waitFor(async () => expect((await sessionRepository.get("x-practice"))?.status).toBe("abandoned"));
    const old = await sessionRepository.get("x-practice");
    // Kept, not deleted: the audit trail survives, and an abandoned attempt
    // carries no evaluation, so it folds into no competency record.
    expect(old?.draft.hpi).toBe(DRAFT_TEXT);
    expect(old?.evaluation).toBeNull();
  });

  it("still offers a genuinely empty attempt beside it", async () => {
    await sessionRepository.save(interruptedAttempt("practice"));
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Start a new attempt" }));

    await waitFor(() => expect(useSessionStore.getState().session).not.toBeNull());
    const state = useSessionStore.getState();
    expect(state.draft.hpi).toBe("");
    expect(state.session!.activeMs).toBe(0);
  });

  it("does not hand the new attempt a reference to the old draft object", async () => {
    await sessionRepository.save(interruptedAttempt("practice"));
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue from your draft" }));
    await waitFor(() => expect(useSessionStore.getState().session).not.toBeNull());

    useSessionStore.getState().updateField("hpi", "edited in the new attempt");

    // The abandoned record is history; editing the live draft must not rewrite
    // it. Two independent things guarantee that - the copy taken when the work
    // is carried, and the store's immutable field updates - so removing either
    // one alone leaves this passing. Removing both was verified to fail it.
    const old = await sessionRepository.get("x-practice");
    expect(old?.draft.hpi).toBe(DRAFT_TEXT);
  });

  it("applies to simulation as well as practice", async () => {
    await sessionRepository.save(interruptedAttempt("simulation"));
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue from your draft" }));

    await waitFor(() => expect(useSessionStore.getState().session).not.toBeNull());
    expect(useSessionStore.getState().session!.mode).toBe("simulation");
    expect(useSessionStore.getState().draft.hpi).toBe(DRAFT_TEXT);
  });

  it("refuses an entitlement-locked scenario and leaves the record interrupted", async () => {
    // D8 says what may be carried; it grants no entitlement. A refused start
    // must not abandon the record for an attempt that never began.
    //
    // A real refusal, not a stubbed one: SCRIBE-IM-032 is difficulty 3 and the
    // free tier reaches 2, so `start` genuinely returns false here.
    await sessionRepository.save(
      interruptedAttempt("practice", {
        id: "x-locked",
        scenarioId: LOCKED.scenarioId,
        scenarioVersion: LOCKED.version,
        scenarioTitle: LOCKED.title
      })
    );
    useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue from your draft" }));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect((await sessionRepository.get("x-locked"))?.status).toBe("in_progress");
    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().draft.hpi).toBe("");
  });
});

describe("D8: the attempt you are in is not an interrupted one", () => {
  it("does not offer to continue the session that is live right now", async () => {
    // Found by walking the flow in a browser. `findInterrupted` returns every
    // in_progress record, and a live attempt autosaves into exactly that
    // state - so the card offered to "continue" the session already on screen,
    // which would have abandoned it and started a third.
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);
    await useSessionStore.getState().persistDraft();

    render(<Dashboard />);

    await screen.findByText("Modules");
    expect(screen.queryByText("Interrupted session")).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue from your draft" })).toBeNull();
  });

  it("still surfaces a genuinely interrupted attempt from an earlier run", async () => {
    await sessionRepository.save(interruptedAttempt("practice"));
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);
    await useSessionStore.getState().persistDraft();

    render(<Dashboard />);

    // The older record is offered; the live one is not. One card, one button.
    expect(await screen.findByText("Interrupted session")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Continue from your draft" })).toHaveLength(1);
  });
});

describe("D8 does not reopen D6: an interrupted Assessment is retaken, not continued", () => {
  it("offers no way to carry an Assessment draft forward", async () => {
    await sessionRepository.save(interruptedAttempt("assessment", { id: "x-assessment" }));
    render(<Dashboard />);

    await screen.findByRole("button", { name: "Start a new attempt" });
    expect(screen.queryByRole("button", { name: "Continue from your draft" })).toBeNull();
    expect(screen.getByText(/retaken from the beginning/)).toBeTruthy();
  });

  it("refuses the carry even if one is passed to the store directly", async () => {
    // The Dashboard hides the button; this is the rule underneath it. A second
    // entry point added later cannot smuggle a draft into an Assessment.
    const carried = { draft: { ...createEmptyDraft(), hpi: DRAFT_TEXT }, activeMs: 240_000 };
    expect(useSessionStore.getState().start(SCENARIO, "assessment", carried)).toBe(true);

    const state = useSessionStore.getState();
    expect(state.draft.hpi).toBe("");
    expect(state.session!.activeMs).toBe(0);
  });
});

describe("D8's prerequisite: an autosaved attempt records the time it has really taken", () => {
  it("persists elapsed work time, not the zero it stored before", async () => {
    // Before D8 the record copied session.activeMs, which only advances at a
    // transition. A practice attempt that had never been paused autosaved as
    // "0 ms of work" however long the learner had been writing - invisible,
    // until a continued attempt started reading that figure.
    const start = 1_700_000_000_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);
    useSessionStore.getState().updateField("hpi", DRAFT_TEXT);

    now.mockReturnValue(start + 7 * 60_000);
    expect(await useSessionStore.getState().persistDraft()).toBe(true);

    const id = useSessionStore.getState().session!.id;
    const saved = await sessionRepository.get(id);
    expect(saved?.activeMs).toBe(7 * 60_000);
    expect(saved?.pausedMs).toBe(0);
  });

  it("does not double-count the final interval when the attempt is submitted", async () => {
    const start = 1_700_000_000_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);

    now.mockReturnValue(start + 5 * 60_000);
    await useSessionStore.getState().submit();

    const id = useSessionStore.getState().session!.id;
    const saved = await sessionRepository.get(id);
    expect(saved?.status).toBe("completed");
    expect(saved?.activeMs).toBe(5 * 60_000);
  });
});
