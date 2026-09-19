// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type SimulationMode
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";
import { SubmissionSummary } from "./SubmissionSummary.js";

/**
 * CHARACTERIZATION ONLY - this file records what the application does today
 * after an Assessment is submitted. It is evidence gathered for decision D3,
 * **not** a decision.
 *
 * D3 (what an Assessment learner receives after submitting) is unresolved.
 * Nothing here should be read as an owner-approved policy, and nothing here
 * was designed: every assertion describes behaviour that already existed
 * before Assessment became reachable under D1.
 *
 * The single fact worth pinning is that the post-submission surface is
 * currently **mode-agnostic**: `routes/LiveScribing.tsx` renders
 * `SubmissionSummary` for any completed session, and `SubmissionSummary`
 * branches on nothing but the data. An Assessment learner therefore receives
 * exactly what a Practice learner receives.
 *
 * When D3 is decided, these tests are *expected to fail* and to be rewritten
 * against the chosen policy. That is their purpose: to make a change to the
 * Assessment post-submission experience visible and deliberate rather than
 * incidental.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

const PRO = { tier: "pro", status: "active", currentPeriodEnd: null, fastTrackPurchased: false } as const;

/** Every category the evaluator scores, as the summary labels them. */
const CATEGORY_LABELS = [
  "Accuracy",
  "Completeness",
  "Terminology",
  "Relevance",
  "Structure",
  "Pertinent Pos/Neg",
  "Time Efficiency"
];

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  (competencyRepository as InMemoryCompetencyRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
});

/**
 * Assessment requires Pro (D1), so the entitlement is granted before starting.
 * That is D1 working, not a D3 statement.
 */
async function submitIn(mode: SimulationMode) {
  useEntitlementStore.getState().setSubscription(PRO);
  expect(useSessionStore.getState().start(SCENARIO, mode)).toBe(true);
  // Partial documentation, so the summary has both a credited section and a
  // missed requirement to report.
  useSessionStore.getState().updateField("chiefComplaint", "Dry cough for three days");
  await useSessionStore.getState().submit();
}

function renderSummary() {
  render(
    <MemoryRouter>
      <SubmissionSummary />
    </MemoryRouter>
  );
}

describe("D3 evidence: what an Assessment learner currently receives after submitting", () => {
  it("shows the full results surface - score, every category, feedback, comparison and draft", async () => {
    await submitIn("assessment");
    renderSummary();

    // A numeric overall score out of 100.
    expect(screen.getByText("/ 100", { exact: false })).toBeTruthy();
    // The complete per-category breakdown, unfiltered by tier.
    for (const label of CATEGORY_LABELS) {
      expect(screen.getAllByText(label).length, label).toBeGreaterThan(0);
    }
    // Per-error coaching in the WHAT / WHY / HOW form.
    expect(screen.getByText(/^Feedback \(\d+\)$/)).toBeTruthy();
    expect(screen.getAllByText("What:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Why:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("How:").length).toBeGreaterThan(0);
    // The expected-answer comparison. NOTE: this is also the surface D4
    // (closed-book behaviour) would have an opinion about; observing it here
    // resolves neither D3 nor D4.
    expect(screen.getByText("Note comparison")).toBeTruthy();
    expect(screen.getByText("Expected")).toBeTruthy();
    // The learner's own submitted note, played back.
    expect(screen.getByText("Your documentation")).toBeTruthy();
    // Appears twice: in the note comparison and in the played-back draft.
    expect(screen.getAllByText("Dry cough for three days").length).toBeGreaterThan(0);
  });

  it("offers exactly two ways forward: back to the library, or retry the same scenario", async () => {
    await submitIn("assessment");
    renderSummary();

    expect(screen.getByRole("button", { name: "Back to library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry this scenario" })).toBeTruthy();
    // No Assessment-specific control exists: no review lock, no cooldown, no
    // "results pending" state, no attempt limit.
    expect(screen.queryByRole("button", { name: /pending|locked|release|review later/i })).toBeNull();
  });

  it("renders the same surfaces for Practice as for Assessment, because nothing branches on mode", async () => {
    // This is the observable fact D3 must decide about: today the mode makes
    // no difference at all once the session is completed.
    const landmarks = ["Results", "Note comparison", "Your documentation"];

    await submitIn("assessment");
    renderSummary();
    const assessmentSurfaces = landmarks.filter((text) => screen.queryByText(text) !== null);
    cleanup();
    useSessionStore.getState().reset();

    await submitIn("practice");
    renderSummary();
    const practiceSurfaces = landmarks.filter((text) => screen.queryByText(text) !== null);

    expect(assessmentSurfaces).toEqual(landmarks);
    expect(practiceSurfaces).toEqual(assessmentSurfaces);
  });

  it("records a submitted Assessment in history carrying its evaluation, exactly as Practice does", async () => {
    await submitIn("assessment");
    const [record] = await sessionRepository.list();

    expect(record?.mode).toBe("assessment");
    expect(record?.status).toBe("completed");
    expect(record?.evaluation).not.toBeNull();
  });

  it("folds a submitted Assessment into competency, exactly as Practice does", async () => {
    // D5 (analytics/competency treatment of Assessment attempts) is
    // unresolved. This records that no distinction currently exists; it does
    // not propose one.
    await submitIn("assessment");
    const records = await competencyRepository.list();

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.attemptCount === 1)).toBe(true);
  });
});
