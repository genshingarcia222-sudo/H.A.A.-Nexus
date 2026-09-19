// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  createEmptyDraft,
  type ErrorType,
  type EvaluationResult,
  type SessionRecord,
  type SimulationMode
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository, lessonRepository } from "../content/scenarios.js";
import { SubmissionSummary } from "./SubmissionSummary.js";

/**
 * Decision D3 — the Assessment post-submission experience.
 *
 * Owner-authorized: all six surfaces ON.
 *
 *     score                       ON
 *     category_breakdown          ON
 *     what_why_how                ON
 *     expected_answer_comparison  ON
 *     recommendations             ON
 *     immediate_retry             ON
 *
 * The decision is satisfied by the existing mode-agnostic summary rather than
 * by anything Assessment-specific: `routes/LiveScribing.tsx` renders
 * `SubmissionSummary` for any completed session, and that component branches
 * on no mode. These tests exist because "already true" is not the same as
 * "protected" - before this file, nothing failed if an Assessment stopped
 * showing its score, its feedback or its recommendations.
 *
 * `recommendations = ON` means the summary exposes whatever the authoritative
 * engine (`generateRecommendations`) legitimately produces for the completed
 * attempt - every rule it supports, in its order, including producing none.
 * No rule, threshold or recommendation type is defined here; the engine's own
 * tests own that. These check only that the Assessment results surface does
 * not filter, reorder or drop what the engine returns.
 *
 * This file replaces the 2026-09-20 characterization test, which said it
 * expected to be rewritten once D3 was answered.
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
  vi.restoreAllMocks();
});

/**
 * A completed attempt in history carrying the given errors.
 *
 * Only the fields the recommendation engine reads are meaningful; the rest
 * satisfy the record shape. Seeding history directly keeps these tests
 * independent of how any particular draft happens to score.
 */
function priorAttempt(id: string, startedAt: number, errors: { errorType: ErrorType; section: string }[]): SessionRecord {
  return {
    id,
    scenarioId: SCENARIO.scenarioId,
    scenarioVersion: SCENARIO.version,
    scenarioTitle: SCENARIO.title,
    mode: "practice",
    status: "completed",
    startedAt,
    activeMs: 120_000,
    pausedMs: 0,
    completedAt: startedAt + 120_000,
    flags: [],
    draft: createEmptyDraft(),
    evaluation: {
      errors: errors.map((e, i) => ({
        id: `${id}-e${i}`,
        errorType: e.errorType,
        severity: "major",
        section: e.section,
        what: "seeded",
        why: "seeded",
        how: "seeded"
      }))
    } as unknown as EvaluationResult
  };
}

async function seed(...records: SessionRecord[]) {
  for (const record of records) await sessionRepository.save(record);
}

/** Assessment requires Pro (D1). Granting it is D1 working, not a D3 statement. */
async function submitAssessment(draft: Partial<Record<string, string>> = {}) {
  useEntitlementStore.getState().setSubscription(PRO);
  expect(useSessionStore.getState().start(SCENARIO, "assessment")).toBe(true);
  const fields = { chiefComplaint: "Dry cough for three days", ...draft };
  for (const [section, value] of Object.entries(fields)) {
    useSessionStore.getState().updateField(section as never, value);
  }
  await useSessionStore.getState().submit();
}

function renderSummary() {
  render(
    <MemoryRouter>
      <SubmissionSummary />
    </MemoryRouter>
  );
}

/** The recommendation card, once the summary's async history read has settled. */
async function recommendationTitles(): Promise<string[]> {
  await waitFor(() => {
    // Either the card has appeared, or the read has completed with nothing to
    // show. Both are settled states; this waits for the effect either way.
    expect(screen.queryByText("Your documentation")).not.toBeNull();
  });
  if (screen.queryByText("Recommended for you") === null) return [];
  return screen
    .getAllByRole("button", { name: /Open lesson|Retry now/ })
    .map((button) => button.parentElement?.querySelector("p")?.textContent ?? "");
}

describe("D3: an Assessment learner's post-submission experience", () => {
  it("score = ON: shows the overall score out of 100 with active time", async () => {
    await submitAssessment();
    renderSummary();

    expect(screen.getByText("/ 100", { exact: false })).toBeTruthy();
    expect(screen.getByText(/active time/)).toBeTruthy();
  });

  it("category_breakdown = ON: shows every category the evaluator scores", async () => {
    await submitAssessment();
    renderSummary();

    for (const label of CATEGORY_LABELS) {
      expect(screen.getAllByText(label).length, label).toBeGreaterThan(0);
    }
  });

  it("what_why_how = ON: shows every error with all three explanations", async () => {
    // A blank ROS guarantees omissions, so there is something to explain.
    await submitAssessment();
    renderSummary();

    const heading = screen.getByText(/^Feedback \((\d+)\)$/);
    const count = Number(/\((\d+)\)/.exec(heading.textContent ?? "")![1]);
    expect(count).toBeGreaterThan(0);
    // One of each label per error - no error may be shown partially explained.
    expect(screen.getAllByText("What:").length).toBe(count);
    expect(screen.getAllByText("Why:").length).toBe(count);
    expect(screen.getAllByText("How:").length).toBe(count);
  });

  it("expected_answer_comparison = ON: shows the expected column with real requirements", async () => {
    await submitAssessment();
    renderSummary();

    expect(screen.getByText("Note comparison")).toBeTruthy();
    expect(screen.getByText("Expected")).toBeTruthy();
    // Not merely the header: an actual requirement, traced to its source fact.
    expect(screen.getAllByText(/^from: /).length).toBeGreaterThan(0);
  });

  it("immediate_retry = ON: offers a retry that starts a fresh Assessment", async () => {
    await submitAssessment();
    renderSummary();

    const retry = screen.getByRole("button", { name: "Retry this scenario" });
    retry.click();

    const session = useSessionStore.getState().session;
    expect(session?.mode).toBe("assessment");
    expect(session?.status).toBe("in_progress");
    expect(useSessionStore.getState().result).toBeNull();
  });

  it("immediate_retry does not bypass D1: a lapsed entitlement refuses the retry", async () => {
    // D3 grants an immediate retry; it does not grant entitlement. The retry
    // goes through `sessionStore.start` like every other entry point.
    await submitAssessment();
    const completedId = useSessionStore.getState().session!.id;
    renderSummary();

    useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    screen.getByRole("button", { name: "Retry this scenario" }).click();

    expect(alert).toHaveBeenCalled();
    // No new session started, and the completed one is untouched.
    expect(useSessionStore.getState().session?.id).toBe(completedId);
    expect(useSessionStore.getState().session?.status).toBe("completed");
  });
});

describe("D3 recommendations = ON: the summary exposes what the engine produces", () => {
  it("produces none, and shows no card, when history gives the engine nothing", async () => {
    // A single attempt cannot satisfy any repeated-error rule.
    await submitAssessment({ ros: "Denies fever, denies chest pain, denies shortness of breath." });
    renderSummary();

    expect(await recommendationTitles()).toEqual([]);
    expect(screen.queryByText("Recommended for you")).toBeNull();
  });

  it("surfaces a lesson recommendation, with its real title and an Open lesson action", async () => {
    await seed(
      priorAttempt("p1", 1000, [{ errorType: "omission", section: "hpi" }]),
      priorAttempt("p2", 2000, [{ errorType: "omission", section: "hpi" }])
    );
    await submitAssessment();
    renderSummary();

    await waitFor(() => expect(screen.queryByText("Recommended for you")).not.toBeNull());
    expect(screen.getByText(lessonRepository.get("hpi-fundamentals")!.title)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open lesson" })).toBeTruthy();
  });

  it("surfaces a terminology lesson when the engine's terminology rule fires", async () => {
    await seed(
      priorAttempt("p1", 1000, [{ errorType: "incorrect_terminology", section: "ros" }]),
      priorAttempt("p2", 2000, [{ errorType: "incorrect_terminology", section: "hpi" }])
    );
    await submitAssessment();
    renderSummary();

    await waitFor(() => expect(screen.queryByText("Recommended for you")).not.toBeNull());
    expect(screen.getByText(lessonRepository.get("medical-terminology")!.title)).toBeTruthy();
  });

  it("surfaces a scenario recommendation, labelled as a retry, with a Retry now action", async () => {
    await seed(
      priorAttempt("p1", 1000, [{ errorType: "time_management", section: "hpi" }]),
      priorAttempt("p2", 2000, [{ errorType: "time_management", section: "hpi" }])
    );
    await submitAssessment();
    renderSummary();

    await waitFor(() => expect(screen.queryByText("Recommended for you")).not.toBeNull());
    expect(screen.getByText(`Retry: ${SCENARIO.title}`)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry now" })).toBeTruthy();
  });

  it("counts the attempt just submitted, so a single-occurrence rule can fire from it", async () => {
    // The engine's fabrication rule needs no repetition. It can only fire here
    // if the Assessment that was *just* submitted is part of the history the
    // summary reads - which is what "recommendations for the completed
    // attempt" means.
    await submitAssessment({ physicalExam: "Temperature 38.5°C, blood pressure 140/90." });

    const record = (await sessionRepository.list())[0]!;
    expect(record.evaluation!.errors.some((e) => e.errorType === "fabrication")).toBe(true);

    renderSummary();
    await waitFor(() => expect(screen.queryByText("Recommended for you")).not.toBeNull());
    expect(screen.getByText(lessonRepository.get("accuracy-and-unsupported-inference")!.title)).toBeTruthy();
  });

  it("shows several recommendations at once, in the engine's order, dropping none", async () => {
    const { generateRecommendations } = await import("@haa-nexus/nexus-core");
    await seed(
      priorAttempt("p1", 1000, [
        { errorType: "omission", section: "hpi" },
        { errorType: "incorrect_terminology", section: "ros" },
        { errorType: "time_management", section: "hpi" }
      ]),
      priorAttempt("p2", 2000, [
        { errorType: "omission", section: "hpi" },
        { errorType: "incorrect_terminology", section: "ros" },
        { errorType: "time_management", section: "hpi" }
      ])
    );
    await submitAssessment();
    renderSummary();

    await waitFor(() => expect(screen.queryByText("Recommended for you")).not.toBeNull());
    const rendered = await recommendationTitles();

    // The expected list is asked of the engine rather than written out here,
    // so this test can never disagree with the engine about what a history
    // produces - it checks only that the surface renders all of it, in order.
    const expected = generateRecommendations(await sessionRepository.list(), SCENARIO.scenarioId, Date.now()).map(
      (rec) =>
        rec.recommendedType === "lesson"
          ? lessonRepository.get(rec.recommendedId)!.title
          : `Retry: ${scenarioRepository.getLatest(rec.recommendedId)!.title}`
    );

    expect(expected.length).toBeGreaterThan(1);
    expect(rendered).toEqual(expected);
  });
});

describe("D3 changes nothing outside the Assessment results surface", () => {
  for (const mode of ["practice", "simulation"] as const) {
    it(`${mode} still receives the same post-submission surface`, async () => {
      useEntitlementStore.getState().setSubscription(PRO);
      expect(useSessionStore.getState().start(SCENARIO, mode as SimulationMode)).toBe(true);
      useSessionStore.getState().updateField("chiefComplaint", "Dry cough for three days");
      await useSessionStore.getState().submit();
      renderSummary();

      expect(screen.getByText("Results")).toBeTruthy();
      expect(screen.getByText("Note comparison")).toBeTruthy();
      expect(screen.getByText("Your documentation")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry this scenario" })).toBeTruthy();
    });
  }

  it("still records and folds an Assessment attempt exactly as before (D5 untouched)", async () => {
    // D5 - whether Assessment attempts should count in competency/analytics -
    // is unresolved. D3 did not change it in either direction.
    await submitAssessment();

    const record = (await sessionRepository.list())[0]!;
    expect(record.mode).toBe("assessment");
    expect(record.evaluation).not.toBeNull();

    const competency = await competencyRepository.list();
    expect(competency.length).toBeGreaterThan(0);
    expect(competency.every((r) => r.attemptCount === 1)).toBe(true);
  });
});
