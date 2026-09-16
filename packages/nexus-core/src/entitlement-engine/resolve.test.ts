import { describe, expect, it } from "vitest";
import {
  canAccessDifficulty,
  isSubscriptionCurrent,
  resolveEffectiveTier,
  resolveEntitlements
} from "./resolve.js";
import { CAPABILITY_MATRIX } from "./capability-matrix.js";
import { EntitlementService } from "./index.js";
import { DEFAULT_ENTITLEMENTS, type Entitlements } from "../types/entitlements.js";
import {
  NO_SUBSCRIPTION,
  type SubscriptionState,
  type SubscriptionStatus,
  type Tier
} from "../types/subscription.js";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "../scenario-engine/difficulty.js";

/**
 * Fixed clock. Every test is deterministic: no Date.now() anywhere, which
 * is the whole point of the resolver taking `now` as an argument.
 */
const NOW = 1_700_000_000_000;
const FUTURE = NOW + 86_400_000; // +1 day
const PAST = NOW - 86_400_000; // -1 day

function subscription(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    tier: "free",
    status: "none",
    currentPeriodEnd: null,
    fastTrackPurchased: false,
    ...overrides
  };
}

/** An active, paid, in-period subscription at the given tier. */
function active(tier: Tier, overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return subscription({ tier, status: "active", currentPeriodEnd: FUTURE, ...overrides });
}

describe("capability matrix", () => {
  it("defines exactly the four commercial tiers", () => {
    expect(Object.keys(CAPABILITY_MATRIX).sort()).toEqual([
      "fast_track",
      "free",
      "practice",
      "pro"
    ]);
  });

  it("is frozen, so no consumer can mutate another user's entitlements", () => {
    expect(Object.isFrozen(CAPABILITY_MATRIX)).toBe(true);
    expect(Object.isFrozen(CAPABILITY_MATRIX.free)).toBe(true);
  });

  it("never grants a capability whose implementation does not exist yet", () => {
    // AI (Phase 11+), cloud sync (Phase 10), and a second module all remain
    // unimplemented. No tier may claim them - see CLAUDE.md, "do not claim a
    // capability is implemented merely because an interface/stub exists".
    for (const [tier, caps] of Object.entries(CAPABILITY_MATRIX)) {
      expect(caps.canUseAI, `${tier} must not grant canUseAI`).toBe(false);
      expect(caps.canUseCloudSync, `${tier} must not grant canUseCloudSync`).toBe(false);
      expect(caps.canAccessPremiumModules, `${tier} must not grant premium modules`).toBe(false);
    }
  });

  it("keeps the legacy canUseAdvancedScenarios key consistent with maxScenarioDifficulty", () => {
    for (const [tier, caps] of Object.entries(CAPABILITY_MATRIX)) {
      expect(caps.canUseAdvancedScenarios, `${tier} advanced-scenarios flag`).toBe(
        caps.maxScenarioDifficulty >= 4
      );
    }
  });

  it("keeps the two analytics keys in step, since the spec draws no basic/advanced split", () => {
    for (const [tier, caps] of Object.entries(CAPABILITY_MATRIX)) {
      expect(caps.canUseAdvancedAnalytics, `${tier} analytics keys must agree`).toBe(
        caps.canViewAnalytics
      );
    }
  });

  it("models no competency ceiling - tracking is all-or-nothing per tier", () => {
    // The spec describes "Competency tracking to Mastered" as Pro's whole
    // feature, never as a ladder cheaper tiers climb partway. Capping a
    // displayed competency level below the learner's real record would
    // show a figure contradicting stored data (Architecture Package
    // Section 18). Guard against the concept being reintroduced.
    for (const caps of Object.values(CAPABILITY_MATRIX)) {
      expect(caps).not.toHaveProperty("maxCompetencyLevel");
    }
  });

  it("unlocks competency, analytics and recommendations at exactly the same tier", () => {
    // Recorded interpretation: the spec names competency and analytics
    // together as locked on Free, and names competency and the
    // recommendation engine together as Pro unlocks. Nothing in the spec
    // splits them across tiers, so nothing here may either.
    for (const [tier, caps] of Object.entries(CAPABILITY_MATRIX)) {
      expect(caps.canViewAnalytics, `${tier}: analytics vs competency`).toBe(
        caps.canTrackCompetency
      );
      expect(caps.canUseRecommendations, `${tier}: recommendations vs competency`).toBe(
        caps.canTrackCompetency
      );
    }
  });
});

// --- 1-4: per-tier capability sets -------------------------------------

describe("resolveEntitlements - active tier capability sets", () => {
  const cases: {
    name: string;
    state: SubscriptionState;
    expectedTier: Tier;
    expected: Partial<Entitlements>;
  }[] = [
    {
      name: "Free - Foundations",
      state: active("free", { currentPeriodEnd: null }),
      expectedTier: "free",
      expected: {
        maxScenarioDifficulty: 2,
        canViewDetailedScoreBreakdown: false,
        canTrackCompetency: false,
        canUseRecommendations: false,
        canViewAnalytics: false,
        canAccessTierExclusiveContent: false,
        voiceQuality: "budget"
      }
    },
    {
      name: "Practice Access",
      state: active("practice"),
      expectedTier: "practice",
      expected: {
        maxScenarioDifficulty: 3,
        // The spec's Practice row names only the score breakdown and
        // unlimited attempts - competency and analytics stay locked.
        canViewDetailedScoreBreakdown: true,
        canTrackCompetency: false,
        canUseRecommendations: false,
        canViewAnalytics: false,
        canReceiveMonthlyScenarioDrops: false,
        voiceQuality: "budget"
      }
    },
    {
      name: "Exam-Ready Pro",
      state: active("pro"),
      expectedTier: "pro",
      expected: {
        maxScenarioDifficulty: 4,
        canViewDetailedScoreBreakdown: true,
        canTrackCompetency: true,
        canUseRecommendations: true,
        canViewAnalytics: true,
        canUseAdvancedAnalytics: true,
        canReceiveMonthlyScenarioDrops: true,
        canAccessTierExclusiveContent: false,
        voiceQuality: "mid"
      }
    },
    {
      name: "Agency Fast-Track (Pro + purchase)",
      state: active("pro", { fastTrackPurchased: true }),
      expectedTier: "fast_track",
      expected: {
        maxScenarioDifficulty: 6,
        canViewDetailedScoreBreakdown: true,
        canTrackCompetency: true,
        canUseRecommendations: true,
        canAccessTierExclusiveContent: true,
        canRequestTranscriptReview: true,
        canEarnCompletionCertificate: true,
        voiceQuality: "premium"
      }
    }
  ];

  for (const { name, state, expectedTier, expected } of cases) {
    it(`resolves ${name} to the ${expectedTier} capability set`, () => {
      expect(resolveEffectiveTier(state, NOW)).toBe(expectedTier);
      expect(resolveEntitlements(state, NOW)).toEqual(CAPABILITY_MATRIX[expectedTier]);
      expect(resolveEntitlements(state, NOW)).toMatchObject(expected);
    });
  }
});

// --- 5-8: non-active subscription statuses ------------------------------

describe("resolveEntitlements - lifecycle statuses", () => {
  const cases: {
    status: SubscriptionStatus;
    currentPeriodEnd: number | null;
    expectedTier: Tier;
    why: string;
  }[] = [
    {
      status: "none",
      currentPeriodEnd: null,
      expectedTier: "free",
      why: "no subscription record exists"
    },
    {
      status: "active",
      currentPeriodEnd: FUTURE,
      expectedTier: "pro",
      why: "paid and in-period"
    },
    {
      status: "past_due",
      currentPeriodEnd: FUTURE,
      expectedTier: "pro",
      why: "dunning retry, but the paid period has not ended"
    },
    {
      status: "past_due",
      currentPeriodEnd: PAST,
      expectedTier: "free",
      why: "dunning failed and the paid period has ended"
    },
    {
      status: "canceled",
      currentPeriodEnd: FUTURE,
      expectedTier: "pro",
      why: "cancellation requested but the paid period still runs"
    },
    {
      status: "canceled",
      currentPeriodEnd: PAST,
      expectedTier: "free",
      why: "cancellation took effect at period end"
    },
    {
      status: "expired",
      currentPeriodEnd: PAST,
      expectedTier: "free",
      why: "period ended with no renewal"
    },
    {
      status: "expired",
      currentPeriodEnd: FUTURE,
      expectedTier: "free",
      why: "an explicit expiry always wins over a stale period end"
    },
    {
      status: "active",
      currentPeriodEnd: PAST,
      expectedTier: "free",
      why: "a stale active record whose period has lapsed grants nothing"
    }
  ];

  for (const { status, currentPeriodEnd, expectedTier, why } of cases) {
    const label = currentPeriodEnd === null ? "no period" : currentPeriodEnd > NOW ? "in period" : "lapsed";
    it(`Pro with status "${status}" (${label}) resolves to ${expectedTier} - ${why}`, () => {
      const state = subscription({ tier: "pro", status, currentPeriodEnd });
      expect(resolveEffectiveTier(state, NOW)).toBe(expectedTier);
      expect(resolveEntitlements(state, NOW)).toEqual(CAPABILITY_MATRIX[expectedTier]);
    });
  }

  it("past_due without any period end cannot grant access indefinitely", () => {
    const state = subscription({ tier: "pro", status: "past_due", currentPeriodEnd: null });
    expect(isSubscriptionCurrent(state, NOW)).toBe(false);
    expect(resolveEffectiveTier(state, NOW)).toBe("free");
  });

  it("treats the exact period-end instant as lapsed, not current", () => {
    const state = subscription({ tier: "pro", status: "active", currentPeriodEnd: NOW });
    expect(isSubscriptionCurrent(state, NOW)).toBe(false);
    expect(resolveEffectiveTier(state, NOW)).toBe("free");
  });
});

// --- 9: Fast-Track without a valid Pro relationship ---------------------

describe("Fast-Track requires an active Pro subscription", () => {
  it("resolves up to fast_track when Pro is active and the add-on is purchased", () => {
    expect(resolveEffectiveTier(active("pro", { fastTrackPurchased: true }), NOW)).toBe(
      "fast_track"
    );
  });

  it("resolves a claimed fast_track tier down to pro when the add-on was never purchased", () => {
    // Guards against obtaining the add-on by asserting a tier string.
    const state = active("fast_track", { fastTrackPurchased: false });
    expect(resolveEffectiveTier(state, NOW)).toBe("pro");
    expect(resolveEntitlements(state, NOW).canEarnCompletionCertificate).toBe(false);
    expect(resolveEntitlements(state, NOW).maxScenarioDifficulty).toBe(4);
  });

  it("grants nothing extra when Fast-Track is purchased on a Practice subscription", () => {
    const state = active("practice", { fastTrackPurchased: true });
    expect(resolveEffectiveTier(state, NOW)).toBe("practice");
    expect(resolveEntitlements(state, NOW)).toEqual(CAPABILITY_MATRIX.practice);
  });

  it("grants nothing extra when Fast-Track is purchased on a Free subscription", () => {
    const state = subscription({ fastTrackPurchased: true });
    expect(resolveEffectiveTier(state, NOW)).toBe("free");
    expect(resolveEntitlements(state, NOW)).toEqual(CAPABILITY_MATRIX.free);
  });

  it("falls back to Free - not Fast-Track - when the underlying Pro subscription lapses", () => {
    const state = subscription({
      tier: "fast_track",
      status: "expired",
      currentPeriodEnd: PAST,
      fastTrackPurchased: true
    });
    expect(resolveEffectiveTier(state, NOW)).toBe("free");
    expect(resolveEntitlements(state, NOW)).toEqual(CAPABILITY_MATRIX.free);
  });

  it("restores Fast-Track when a lapsed Pro subscription becomes active again", () => {
    // The one-time purchase lies dormant rather than being lost, so
    // re-subscribing must not require paying the $39 a second time.
    const lapsed = subscription({
      tier: "pro",
      status: "expired",
      currentPeriodEnd: PAST,
      fastTrackPurchased: true
    });
    expect(resolveEffectiveTier(lapsed, NOW)).toBe("free");

    const renewed = { ...lapsed, status: "active" as const, currentPeriodEnd: FUTURE };
    expect(resolveEffectiveTier(renewed, NOW)).toBe("fast_track");
  });
});

// --- 10: scenario-difficulty boundary for every tier --------------------

describe("scenario difficulty gating", () => {
  const ALL_LEVELS = DIFFICULTY_LEVELS.map((d) => d.level);

  const expectedMax: Record<Tier, DifficultyLevel> = {
    free: 2,
    practice: 3,
    pro: 4,
    fast_track: 6
  };

  for (const tier of Object.keys(expectedMax) as Tier[]) {
    const max = expectedMax[tier];
    const caps = CAPABILITY_MATRIX[tier];

    it(`${tier} unlocks difficulty 1..${max} and locks everything above`, () => {
      for (const level of ALL_LEVELS) {
        expect(canAccessDifficulty(caps, level), `${tier} @ difficulty ${level}`).toBe(
          level <= max
        );
      }
    });

    it(`${tier} boundary: ${max} is allowed and ${max + 1} is not`, () => {
      expect(canAccessDifficulty(caps, max)).toBe(true);
      if (max < 6) {
        expect(canAccessDifficulty(caps, (max + 1) as DifficultyLevel)).toBe(false);
      }
    });
  }

  it("covers every difficulty level the scenario schema defines", () => {
    expect(ALL_LEVELS).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// --- 11: DEFAULT_ENTITLEMENTS equivalence -------------------------------

describe("backward compatibility", () => {
  it("DEFAULT_ENTITLEMENTS is exactly the resolved no-subscription state", () => {
    // Pins the pre-commercialization constant to the capability matrix so
    // the two cannot silently drift apart.
    expect(resolveEntitlements(NO_SUBSCRIPTION, NOW)).toEqual(DEFAULT_ENTITLEMENTS);
  });

  it("DEFAULT_ENTITLEMENTS is exactly the Free row of the capability matrix", () => {
    expect(DEFAULT_ENTITLEMENTS).toEqual(CAPABILITY_MATRIX.free);
  });

  it("the no-argument EntitlementService still behaves as a Free local user", () => {
    const service = new EntitlementService();
    expect(service.can("canUseSimulation")).toBe(true);
    expect(service.can("canUseAI")).toBe(false);
    expect(service.all()).toEqual(DEFAULT_ENTITLEMENTS);
  });

  it("fromSubscription produces a service backed by the resolved entitlements", () => {
    const service = EntitlementService.fromSubscription(active("pro"), NOW);
    expect(service.can("canUseRecommendations")).toBe(true);
    expect(service.can("canViewDetailedScoreBreakdown")).toBe(true);
    expect(service.canAccessDifficulty(4)).toBe(true);
    expect(service.canAccessDifficulty(5)).toBe(false);
    expect(service.all()).toEqual(CAPABILITY_MATRIX.pro);
  });

  it("fromSubscription on a lapsed subscription is indistinguishable from Free", () => {
    const lapsed = subscription({ tier: "pro", status: "expired", currentPeriodEnd: PAST });
    expect(EntitlementService.fromSubscription(lapsed, NOW).all()).toEqual(DEFAULT_ENTITLEMENTS);
  });
});

// --- purity -------------------------------------------------------------

describe("resolver purity", () => {
  it("is deterministic across repeated calls with the same inputs", () => {
    const state = active("pro", { fastTrackPurchased: true });
    const first = resolveEntitlements(state, NOW);
    const second = resolveEntitlements(state, NOW);
    expect(first).toEqual(second);
  });

  it("does not mutate the subscription state it is given", () => {
    const state = active("pro", { fastTrackPurchased: true });
    const snapshot = JSON.parse(JSON.stringify(state));
    resolveEntitlements(state, NOW);
    expect(state).toEqual(snapshot);
  });

  it("depends on `now` only through the period-end comparison", () => {
    const state = subscription({ tier: "pro", status: "active", currentPeriodEnd: NOW + 1000 });
    expect(resolveEffectiveTier(state, NOW)).toBe("pro");
    expect(resolveEffectiveTier(state, NOW + 2000)).toBe("free");
  });
});
