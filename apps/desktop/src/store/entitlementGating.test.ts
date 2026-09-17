import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type DifficultyLevel,
  type Scenario,
  type SubscriptionState,
  type Tier
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "./sessionStore.js";
import { currentEntitlements, useEntitlementStore } from "./entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Phase 8.2 enforcement tests for `sessionStore.start` - the single
 * boundary every scenario entry point passes through.
 *
 * These deliberately do not render any UI. A disabled or missing button
 * proves nothing about whether a scenario can be started some other way;
 * these tests call the boundary directly, which is exactly what a bypass
 * would do.
 */

const BASE = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

/**
 * Test-only scenarios at each difficulty, cloned from real shipped content
 * with only identity and difficulty changed. Nothing is added to /content.
 */
function scenarioAt(difficulty: DifficultyLevel): Scenario {
  return {
    ...BASE,
    scenarioId: `TEST-GATING-D${difficulty}`,
    title: `Gating fixture, difficulty ${difficulty}`,
    difficulty
  };
}

/**
 * `currentPeriodEnd: null` with `active` is unbounded, so these fixtures
 * resolve identically whatever the wall clock says - the tests have no
 * ambient-time dependence even though the app boundary reads the clock.
 */
function activeSubscription(tier: Tier, fastTrackPurchased = false): SubscriptionState {
  return { tier, status: "active", currentPeriodEnd: null, fastTrackPurchased };
}

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5, 6];

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

describe("sessionStore.start - access matrix", () => {
  const cases: { label: string; subscription: SubscriptionState; maxAllowed: DifficultyLevel }[] = [
    { label: "Free", subscription: NO_SUBSCRIPTION, maxAllowed: 2 },
    { label: "Practice", subscription: activeSubscription("practice"), maxAllowed: 3 },
    { label: "Pro", subscription: activeSubscription("pro"), maxAllowed: 4 },
    { label: "Fast-Track", subscription: activeSubscription("pro", true), maxAllowed: 6 }
  ];

  for (const { label, subscription, maxAllowed } of cases) {
    for (const difficulty of LEVELS) {
      const allowed = difficulty <= maxAllowed;
      it(`${label} ${allowed ? "may start" : "is refused"} difficulty ${difficulty}`, () => {
        useEntitlementStore.getState().setSubscription(subscription);

        const started = useSessionStore.getState().start(scenarioAt(difficulty), "practice");

        expect(started).toBe(allowed);
        const { session } = useSessionStore.getState();
        if (allowed) {
          expect(session?.scenarioId).toBe(`TEST-GATING-D${difficulty}`);
          expect(session?.status).toBe("in_progress");
        } else {
          expect(session).toBeNull();
        }
      });
    }
  }
});

describe("sessionStore.start - bypass protection", () => {
  it("refuses a locked scenario called directly, with no UI involved at all", () => {
    // The learner is Free; difficulty 3 is Practice-only. Nothing renders
    // here - this is the call a bypass would make.
    const started = useSessionStore.getState().start(scenarioAt(3), "simulation");
    expect(started).toBe(false);
    expect(useSessionStore.getState().session).toBeNull();
  });

  it("creates no session, draft, transcript, result or persisted record when it refuses", async () => {
    useSessionStore.getState().start(scenarioAt(5), "simulation");

    const state = useSessionStore.getState();
    expect(state.scenario).toBeNull();
    expect(state.session).toBeNull();
    expect(state.beats).toEqual([]);
    expect(state.revealedCount).toBe(0);
    expect(state.result).toBeNull();
    expect(Object.values(state.draft).every((v) => v === "")).toBe(true);
    expect(await sessionRepository.list()).toEqual([]);
  });

  it("leaves a session already in progress completely untouched when it refuses another", () => {
    useSessionStore.getState().start(scenarioAt(1), "practice");
    useSessionStore.getState().updateField("hpi", "work in progress");
    const before = useSessionStore.getState();

    const started = useSessionStore.getState().start(scenarioAt(4), "simulation");

    const after = useSessionStore.getState();
    expect(started).toBe(false);
    expect(after.session).toBe(before.session);
    expect(after.scenario).toBe(before.scenario);
    expect(after.draft.hpi).toBe("work in progress");
  });

  it("refuses the real shipped difficulty-3 scenario for a Free learner", () => {
    const im032 = scenarioRepository.get("SCRIBE-IM-032", "1.0")!;
    expect(im032.difficulty).toBe(3);
    expect(useSessionStore.getState().start(im032, "practice")).toBe(false);
  });
});

describe("sessionStore.start - Fast-Track uses resolved entitlements, not the tier string", () => {
  it("unlocks difficulty 6 for active Pro plus a Fast-Track purchase", () => {
    useEntitlementStore.getState().setSubscription(activeSubscription("pro", true));
    expect(useSessionStore.getState().start(scenarioAt(6), "practice")).toBe(true);
  });

  it("does not unlock difficulty 5 for a bare fast_track tier claim without the purchase", () => {
    useEntitlementStore.getState().setSubscription(activeSubscription("fast_track", false));
    expect(useSessionStore.getState().start(scenarioAt(5), "practice")).toBe(false);
    // ...but it still resolves down to Pro, so Pro content remains available.
    expect(useSessionStore.getState().start(scenarioAt(4), "practice")).toBe(true);
  });

  it("does not elevate Practice or Free that carry a Fast-Track purchase", () => {
    useEntitlementStore.getState().setSubscription(activeSubscription("practice", true));
    expect(useSessionStore.getState().start(scenarioAt(4), "practice")).toBe(false);

    useEntitlementStore.getState().setSubscription({ ...NO_SUBSCRIPTION, fastTrackPurchased: true });
    expect(useSessionStore.getState().start(scenarioAt(3), "practice")).toBe(false);
  });

  it("retains no Fast-Track authority once the Pro subscription has expired", () => {
    useEntitlementStore
      .getState()
      .setSubscription({ tier: "pro", status: "expired", currentPeriodEnd: 0, fastTrackPurchased: true });
    expect(useSessionStore.getState().start(scenarioAt(6), "practice")).toBe(false);
    expect(useSessionStore.getState().start(scenarioAt(3), "practice")).toBe(false);
    expect(useSessionStore.getState().start(scenarioAt(2), "practice")).toBe(true);
  });
});

describe("entitlement source - safe default", () => {
  it("starts every learner at no subscription, which resolves to Free and never more", () => {
    // Reset the store module's state to its genuine initial value rather
    // than trusting beforeEach, then check what it resolves to.
    expect(useEntitlementStore.getInitialState().subscription).toEqual(NO_SUBSCRIPTION);
    expect(currentEntitlements().maxScenarioDifficulty).toBe(2);
    expect(currentEntitlements().canTrackCompetency).toBe(false);
  });

  it("keeps Practice's audited Phase 8.1 capabilities locked", () => {
    useEntitlementStore.getState().setSubscription(activeSubscription("practice"));
    const entitlements = currentEntitlements();
    expect(entitlements.maxScenarioDifficulty).toBe(3);
    expect(entitlements.canTrackCompetency).toBe(false);
    expect(entitlements.canViewAnalytics).toBe(false);
    expect(entitlements.canUseRecommendations).toBe(false);
  });

  it("does not mutate the subscription state it resolves", () => {
    const subscription = activeSubscription("pro", true);
    const snapshot = structuredClone(subscription);
    useEntitlementStore.getState().setSubscription(subscription);
    currentEntitlements();
    useSessionStore.getState().start(scenarioAt(6), "practice");
    expect(subscription).toEqual(snapshot);
  });
});
