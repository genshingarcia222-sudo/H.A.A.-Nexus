// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  evaluateAttempt,
  type SimulationMode
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";
import { SubmissionSummary } from "./SubmissionSummary.js";
import { SimulatorWorkspace } from "./SimulatorWorkspace.js";
import { LiveScribing } from "../routes/LiveScribing.js";

/**
 * Phase 8.3 live-feedback boundary.
 *
 * Authorized by Business Model Spec Section 10 ("hides live feedback that
 * would compromise exam simulation") and the session owner's boundary: no
 * information that reveals, confirms, grades, coaches, or materially signals
 * the correctness or quality of ongoing performance.
 *
 * These tests check that boundary as state, not only as rendering. Several
 * inject a real evaluation into the store while an assessment is still
 * active - a state no current code path produces - to prove the boundary
 * holds even if a future change leaks one.
 *
 * Deliberately NOT tested here: what an assessment learner sees after
 * submitting (undecided, D3) and whether reference material is available
 * during an assessment (undecided, D4).
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

/** A genuine EvaluationResult for this scenario, as a leaked value would look. */
function realResult() {
  return evaluateAttempt({
    scenario: SCENARIO,
    draft: { ...useSessionStore.getState().draft, ros: "No fever. Temperature 37.0°C." },
    activeMs: 60_000
  });
}

/**
 * Assessment requires Pro (decision D1, owner-selected 2026-09-19), so an
 * assessment fixture grants that entitlement first. These tests are about
 * the live-feedback boundary, not about who may start - entitlement itself
 * is covered in `store/entitlementGating.test.ts`.
 */
function startIn(mode: SimulationMode) {
  useEntitlementStore
    .getState()
    .setSubscription({ tier: "pro", status: "active", currentPeriodEnd: null, fastTrackPurchased: false });
  expect(useSessionStore.getState().start(SCENARIO, mode)).toBe(true);
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
});

describe("assessment live-feedback boundary - state", () => {
  it("produces no evaluation through any in-session action", async () => {
    startIn("assessment");
    const store = useSessionStore.getState();
    store.updateField("hpi", "Non-productive cough x3 days.");
    store.updateField("ros", "No fever. Temperature 37.0°C."); // would be a fabrication error
    store.advanceTranscript();
    store.flagCurrentBeat("uncertain");
    store.pause();
    store.resume();
    await store.persistDraft();

    expect(useSessionStore.getState().result).toBeNull();
    expect(useSessionStore.getState().session?.status).toBe("in_progress");
  });

  it("autosaves an active assessment with no evaluation", async () => {
    startIn("assessment");
    await useSessionStore.getState().persistDraft();

    const [record] = await sessionRepository.list();
    expect(record?.mode).toBe("assessment");
    expect(record?.status).toBe("in_progress");
    expect(record?.evaluation).toBeNull();
  });

  it("strips a leaked evaluation from the autosaved record but still saves the draft", async () => {
    startIn("assessment");
    useSessionStore.getState().updateField("hpi", "draft that must not be lost");
    useSessionStore.setState({ result: realResult() }); // simulated leak

    await useSessionStore.getState().persistDraft();

    const [record] = await sessionRepository.list();
    expect(record?.evaluation).toBeNull();
    expect(record?.draft.hpi).toBe("draft that must not be lost");
  });

  it("applies the autosave restriction to assessment only, since none is authorized for other modes", async () => {
    for (const mode of ["practice", "simulation"] as const) {
      (sessionRepository as InMemorySessionRepository).clear();
      useSessionStore.getState().reset();
      startIn(mode);
      useSessionStore.setState({ result: realResult() });
      await useSessionStore.getState().persistDraft();
      const [record] = await sessionRepository.list();
      expect(record?.evaluation, mode).not.toBeNull();
    }
  });

  it("reveals the evaluation once the assessment is submitted", async () => {
    startIn("assessment");
    await useSessionStore.getState().submit();

    expect(useSessionStore.getState().session?.status).toBe("completed");
    expect(useSessionStore.getState().result).not.toBeNull();
    const [record] = await sessionRepository.list();
    expect(record?.evaluation).not.toBeNull();
  });
});

describe("assessment live-feedback boundary - rendering", () => {
  const PERFORMANCE_TEXT = /\/ 100|feedback|recommended|score|fabricat|omission|correct|what:|why:|how:/i;

  it("SubmissionSummary renders nothing for an active assessment, even with a leaked result", () => {
    startIn("assessment");
    useSessionStore.setState({ result: realResult() });

    const { container } = render(
      <MemoryRouter>
        <SubmissionSummary />
      </MemoryRouter>
    );

    expect(container.innerHTML).toBe("");
  });

  it("the note comparison is not reachable during an active assessment either", () => {
    // Section 34(10)'s comparison shows the expected answers, so it must obey
    // the same boundary as the score: it lives inside SubmissionSummary and is
    // therefore unreachable until the assessment is completed.
    startIn("assessment");
    useSessionStore.setState({ result: realResult() });

    const { container } = render(
      <MemoryRouter>
        <SubmissionSummary />
      </MemoryRouter>
    );

    expect(container.textContent).not.toContain("Note comparison");
    expect(container.textContent).not.toContain("Expected");
  });

  it("the Live Scribing route keeps showing the workspace, with no performance text, even with a leaked result", () => {
    startIn("assessment");
    useSessionStore.setState({ result: realResult() });

    render(
      <MemoryRouter>
        <LiveScribing />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Documentation" })).toBeTruthy();
    expect(document.body.textContent ?? "").not.toMatch(PERFORMANCE_TEXT);
  });

  it("the workspace shows no performance text during an assessment in which errors are being made", () => {
    startIn("assessment");
    useSessionStore.getState().updateField("ros", "No fever. Temperature 37.0°C.");

    render(<SimulatorWorkspace />);

    expect(document.body.textContent ?? "").not.toMatch(PERFORMANCE_TEXT);
  });
});
