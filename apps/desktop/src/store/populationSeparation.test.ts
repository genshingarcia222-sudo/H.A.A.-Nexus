import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  computeAnalytics,
  type SimulationMode,
  type Tier
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "./sessionStore.js";
import { useEntitlementStore } from "./entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Decision D5 — Practice and Assessment are separate populations, proved
 * through the real submission path.
 *
 * The domain tests prove the rule; these prove the *wiring*: that a real
 * `sessionStore.submit` folds into its own population and leaves the other
 * one alone. A correct rule wired to the wrong repository call would pass the
 * domain tests and still lose a learner's practice history.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

function subscriptionFor(tier: Tier) {
  return { tier, status: "active", currentPeriodEnd: null, fastTrackPurchased: tier === "fast_track" } as const;
}

/** Assessment requires Pro (D1); granting it is D1 working, not a D5 statement. */
async function submitIn(mode: SimulationMode, chiefComplaint: string) {
  useEntitlementStore.getState().setSubscription(subscriptionFor("pro"));
  expect(useSessionStore.getState().start(SCENARIO, mode)).toBe(true);
  useSessionStore.getState().updateField("chiefComplaint", chiefComplaint);
  await useSessionStore.getState().submit();
  useSessionStore.getState().reset();
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  (competencyRepository as InMemoryCompetencyRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("D5: submitting folds into one population only", () => {
  it("a practice submission writes practice competency and no assessment competency", async () => {
    await submitIn("practice", "Dry cough for three days");
    const records = await competencyRepository.list();

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.population === "practice")).toBe(true);
    expect(records.some((r) => r.population === "assessment")).toBe(false);
  });

  it("an assessment submission writes assessment competency and no practice competency", async () => {
    await submitIn("assessment", "Dry cough for three days");
    const records = await competencyRepository.list();

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.population === "assessment")).toBe(true);
    expect(records.some((r) => r.population === "practice")).toBe(false);
  });

  it("a simulation submission counts as practice, where it always counted", async () => {
    await submitIn("simulation", "Dry cough for three days");
    const records = await competencyRepository.list();

    expect(records.every((r) => r.population === "practice")).toBe(true);
  });

  it("an assessment cannot overwrite competency a practice attempt built", async () => {
    await submitIn("practice", "Dry cough for three days, non-productive, denies fever");
    const practiceBefore = (await competencyRepository.list()).filter((r) => r.population === "practice");

    await submitIn("assessment", "");
    const practiceAfter = (await competencyRepository.list()).filter((r) => r.population === "practice");

    expect(practiceAfter).toEqual(practiceBefore);
    expect(practiceAfter.every((r) => r.attemptCount === 1)).toBe(true);
  });

  it("a practice attempt cannot overwrite competency an assessment built", async () => {
    await submitIn("assessment", "Dry cough for three days, non-productive, denies fever");
    const assessmentBefore = (await competencyRepository.list()).filter((r) => r.population === "assessment");

    await submitIn("practice", "");
    const assessmentAfter = (await competencyRepository.list()).filter((r) => r.population === "assessment");

    expect(assessmentAfter).toEqual(assessmentBefore);
  });

  it("both populations coexist, one record per domain per population", async () => {
    await submitIn("practice", "Dry cough for three days");
    await submitIn("assessment", "Dry cough for three days");

    const records = await competencyRepository.list();
    const practice = records.filter((r) => r.population === "practice");
    const assessment = records.filter((r) => r.population === "assessment");

    expect(practice.length).toBe(assessment.length);
    expect(practice.length).toBeGreaterThan(0);
    // No domain appears twice within a population.
    for (const group of [practice, assessment]) {
      expect(new Set(group.map((r) => r.domain)).size).toBe(group.length);
    }
  });

  it("repeated attempts accumulate within their own population only", async () => {
    await submitIn("assessment", "Dry cough for three days");
    await submitIn("assessment", "Dry cough for three days");
    await submitIn("practice", "Dry cough for three days");

    const records = await competencyRepository.list();
    expect(records.filter((r) => r.population === "assessment").every((r) => r.attemptCount === 2)).toBe(true);
    expect(records.filter((r) => r.population === "practice").every((r) => r.attemptCount === 1)).toBe(true);
  });
});

describe("D5: analytics over the real submitted data stay separate", () => {
  it("each population's aggregate counts only its own attempts", async () => {
    await submitIn("practice", "Dry cough for three days, non-productive cough, denies fever");
    await submitIn("assessment", "");

    const sessions = await sessionRepository.list();
    const competencies = await competencyRepository.list();
    const total = scenarioRepository.list().length;

    const practice = computeAnalytics("practice", sessions, competencies, total);
    const assessment = computeAnalytics("assessment", sessions, competencies, total);

    expect(practice.sessionsEvaluated).toBe(1);
    expect(assessment.sessionsEvaluated).toBe(1);
    // A blank assessment note must not drag the practice average down.
    expect(practice.averageScore).toBeGreaterThan(assessment.averageScore!);
  });

  it("an empty assessment population reports nothing rather than borrowing practice figures", async () => {
    await submitIn("practice", "Dry cough for three days");

    const sessions = await sessionRepository.list();
    const competencies = await competencyRepository.list();
    const assessment = computeAnalytics("assessment", sessions, competencies, 2);

    expect(assessment.sessionsEvaluated).toBe(0);
    expect(assessment.averageScore).toBeNull();
    expect(assessment.strongestAreas).toEqual([]);
  });
});
