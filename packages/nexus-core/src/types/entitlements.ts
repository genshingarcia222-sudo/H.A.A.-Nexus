import type { DifficultyLevel } from "../scenario-engine/difficulty.js";

/**
 * Entitlement keys gate features. UI code must only ever call
 * EntitlementService.can(key) - or read a limit off a resolved
 * Entitlements object - and must never branch on subscription tier
 * directly (see Architecture Package, Section 25).
 *
 * The per-tier values live in `entitlement-engine/capability-matrix.ts`,
 * which is the single source of truth for what each tier grants. This file
 * only defines the *shape* of a capability set.
 */
export interface Entitlements {
  // --- Phase 1 keys. Preserved verbatim so existing consumers keep working.
  canUseSimulation: boolean;
  /** Retained for compatibility; now derived from `maxScenarioDifficulty >= 4` (Advanced). */
  canUseAdvancedScenarios: boolean;
  canUseAI: boolean;
  canUseCloudSync: boolean;
  canUseAdvancedAnalytics: boolean;
  canAccessPremiumModules: boolean;

  // --- Commercial capabilities (Business Model Spec Section 4).
  /**
   * Highest scenario `difficulty` the learner may start. The scenario
   * schema's existing 1-6 difficulty metadata is the canonical gating
   * axis - the spec explicitly forbids building a parallel one.
   */
  maxScenarioDifficulty: DifficultyLevel;
  /** Free sees pass/fail only; the full deterministic breakdown is paid. */
  canViewDetailedScoreBreakdown: boolean;
  /**
   * Whether competency records are surfaced to the learner.
   *
   * There is deliberately no "maximum competency level" companion to this
   * flag. The spec describes Pro as "Competency tracking to Mastered" -
   * that is a description of the whole feature, not a ladder that cheaper
   * tiers climb partway. Capping a *displayed* competency level below the
   * learner's real persisted record would mean showing a figure that
   * contradicts the stored data, which the no-fabricated-results rule
   * (Architecture Package Section 18) forbids.
   */
  canTrackCompetency: boolean;
  /** The deterministic recommendation engine (spec lists it under Pro). */
  canUseRecommendations: boolean;
  /**
   * Analytics. Free gets a clearly-labelled locked preview instead.
   *
   * The spec draws no basic/advanced analytics distinction, so this and
   * the legacy `canUseAdvancedAnalytics` key currently always move
   * together; a matrix test pins that invariant.
   */
  canViewAnalytics: boolean;
  /** Pro-and-above monthly scenario drops. */
  canReceiveMonthlyScenarioDrops: boolean;
  /** Fast-Track tier-exclusive content. */
  canAccessTierExclusiveContent: boolean;
  /** Fast-Track personal 1:1 transcript review. */
  canRequestTranscriptReview: boolean;
  /** Fast-Track completion certificate. */
  canEarnCompletionCertificate: boolean;
  /** Voice asset quality band. Voice itself is a later phase; this is the entitlement only. */
  voiceQuality: VoiceQuality;
}

export type VoiceQuality = "budget" | "mid" | "premium";

/**
 * The subset of `Entitlements` whose values are booleans - i.e. the keys
 * `EntitlementService.can()` can answer. Limits like
 * `maxScenarioDifficulty` are read directly off the resolved object
 * instead, since "can(maxScenarioDifficulty)" is not a yes/no question.
 */
export type BooleanEntitlementKey = {
  [K in keyof Entitlements]-?: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/**
 * FREE-tier capabilities, and the entitlement set every local user gets
 * when no subscription record exists.
 *
 * This is deliberately written out rather than aliased to
 * `CAPABILITY_MATRIX.free`: it is the compatibility anchor that predates
 * the tier model, and a test pins it to `resolveEntitlements(NO_SUBSCRIPTION)`
 * so the two can never silently drift apart. If that test fails, the
 * capability matrix changed and this constant did not.
 */
export const DEFAULT_ENTITLEMENTS: Entitlements = {
  canUseSimulation: true,
  canUseAdvancedScenarios: false,
  canUseAI: false,
  canUseCloudSync: false,
  canUseAdvancedAnalytics: false,
  canAccessPremiumModules: false,

  maxScenarioDifficulty: 2,
  canViewDetailedScoreBreakdown: false,
  canTrackCompetency: false,
  canUseRecommendations: false,
  canViewAnalytics: false,
  canReceiveMonthlyScenarioDrops: false,
  canAccessTierExclusiveContent: false,
  canRequestTranscriptReview: false,
  canEarnCompletionCertificate: false,
  voiceQuality: "budget"
};
