import { describe, expect, it } from "vitest";
import { CAPABILITY_MATRIX, TIER_ORDER } from "./capability-matrix.js";
import { canStartMode, resolveEntitlements } from "./resolve.js";
import type { SubscriptionState, Tier } from "../types/subscription.js";

/**
 * Decision D1 — Assessment mode access.
 *
 * Owner-selected on 2026-09-19: **Pro is the minimum tier that may start
 * Assessment mode**. Free and Practice are blocked; Pro and Fast-Track are
 * allowed. This file pins that policy in the domain, where the matrix is the
 * single source of truth; the desktop tests pin its enforcement.
 *
 * The four tiers are exercised as *inputs* against that one policy. There is
 * no second tier hierarchy and no "assessment tier" concept.
 */

const ALLOWED_BY_D1: Record<Tier, boolean> = {
  free: false,
  practice: false,
  pro: true,
  fast_track: true
};

const state = (over: Partial<SubscriptionState> = {}): SubscriptionState =>
  ({
    tier: "pro",
    status: "active",
    currentPeriodEnd: null,
    fastTrackPurchased: false,
    ...over
  }) as SubscriptionState;

describe("D1: which tiers may start Assessment mode", () => {
  for (const tier of TIER_ORDER) {
    it(`${tier} ${ALLOWED_BY_D1[tier] ? "may" : "may not"} start Assessment`, () => {
      expect(CAPABILITY_MATRIX[tier].canStartAssessment).toBe(ALLOWED_BY_D1[tier]);
    });
  }

  it("resolves through the subscription state, not a tier string", () => {
    expect(resolveEntitlements(state({ tier: "free" }), 0).canStartAssessment).toBe(false);
    expect(resolveEntitlements(state({ tier: "practice" }), 0).canStartAssessment).toBe(false);
    expect(resolveEntitlements(state({ tier: "pro" }), 0).canStartAssessment).toBe(true);
    expect(
      resolveEntitlements(state({ tier: "fast_track", fastTrackPurchased: true }), 0).canStartAssessment
    ).toBe(true);
  });

  it("a lapsed Pro loses Assessment, because it falls back to Free", () => {
    const lapsed = state({ tier: "pro", status: "expired", currentPeriodEnd: 1000 });
    expect(resolveEntitlements(lapsed, 5000).canStartAssessment).toBe(false);
  });

  it("a bare fast_track claim without the purchase still resolves to Pro, which may start Assessment", () => {
    // Not a new rule: the existing Fast-Track relationship decides the
    // effective tier, and Assessment reads off whatever that resolves to.
    const claimed = state({ tier: "fast_track", fastTrackPurchased: false });
    expect(resolveEntitlements(claimed, 0).canStartAssessment).toBe(true);
  });

  it("a Fast-Track purchase on Free confers nothing, including Assessment", () => {
    expect(resolveEntitlements(state({ tier: "free", fastTrackPurchased: true }), 0).canStartAssessment).toBe(
      false
    );
  });
});

describe("canStartMode: the mode-to-capability mapping", () => {
  const entitled = CAPABILITY_MATRIX.pro;
  const blocked = CAPABILITY_MATRIX.free;

  it("gates assessment on the capability", () => {
    expect(canStartMode(entitled, "assessment")).toBe(true);
    expect(canStartMode(blocked, "assessment")).toBe(false);
  });

  it("leaves practice and simulation ungated, because no source gates them", () => {
    for (const mode of ["practice", "simulation"] as const) {
      expect(canStartMode(entitled, mode), mode).toBe(true);
      expect(canStartMode(blocked, mode), mode).toBe(true);
    }
  });

  it("does not mutate the entitlements it reads", () => {
    const snapshot = JSON.stringify(blocked);
    canStartMode(blocked, "assessment");
    expect(JSON.stringify(blocked)).toBe(snapshot);
  });
});

describe("D1 changes nothing else", () => {
  it("leaves the difficulty ladder exactly as it was", () => {
    expect(TIER_ORDER.map((t) => CAPABILITY_MATRIX[t].maxScenarioDifficulty)).toEqual([2, 3, 4, 6]);
  });

  it("leaves every other capability untouched for each tier", () => {
    // Assessment access is a separate axis: gating a mode must not have moved
    // scoring, competency, analytics or content capabilities.
    expect(TIER_ORDER.map((t) => CAPABILITY_MATRIX[t].canViewDetailedScoreBreakdown)).toEqual([
      false,
      true,
      true,
      true
    ]);
    expect(TIER_ORDER.map((t) => CAPABILITY_MATRIX[t].canTrackCompetency)).toEqual([false, false, true, true]);
    expect(TIER_ORDER.map((t) => CAPABILITY_MATRIX[t].canViewAnalytics)).toEqual([false, false, true, true]);
    expect(TIER_ORDER.map((t) => CAPABILITY_MATRIX[t].canAccessTierExclusiveContent)).toEqual([
      false,
      false,
      false,
      true
    ]);
  });
});
