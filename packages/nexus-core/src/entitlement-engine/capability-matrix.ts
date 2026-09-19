import type { Entitlements } from "../types/entitlements.js";
import type { Tier } from "../types/subscription.js";

/**
 * The commercial capability matrix (Business Model Spec Section 4).
 *
 * This is the single source of truth for what each tier grants. It is
 * *data*, not conditionals: adding a tier or moving a capability between
 * tiers is an edit to this table, never a new `if` in a component. The
 * spec requires exactly that ("gated by explicit entitlement capabilities,
 * not scattered UI conditionals").
 *
 * Difficulty bands map onto the scenario schema's existing 1-6 metadata
 * (scenario-engine/difficulty.ts): 1 Foundation, 2 Beginner,
 * 3 Intermediate, 4 Advanced, 5 Expert, 6 Master/Elite. No parallel
 * difficulty system is introduced, per the spec's explicit instruction.
 *
 * Three legacy keys - `canUseAI`, `canUseCloudSync`, and
 * `canAccessPremiumModules` - are `false` for every tier, including
 * Fast-Track. That is not an oversight: the underlying capabilities do not
 * exist yet (AI is Phase 11+, cloud sync is Phase 10, and there is no
 * second module). Granting them here would claim a capability that is not
 * implemented. When they do ship, switching them on is an edit to this
 * table - a data change, exactly as Architecture Package Section 24
 * promises.
 *
 * ---
 * RECORDED INTERPRETATION (Practice tier, competency and analytics).
 *
 * The spec names competency and analytics in exactly two places: Free
 * ("competency tracking and analytics remain locked") and Pro
 * ("Competency tracking to Mastered"). The Practice row names neither -
 * it lists only "Full deterministic scoring breakdown; unlimited attempts
 * within unlocked band".
 *
 * This matrix therefore unlocks competency, analytics and recommendations
 * at Pro, not at Practice. That is the least-assumptive reading of the
 * spec: it follows the explicit text and adds nothing. It is also what
 * makes the deliberately small $15 -> $20 step carry visible value, which
 * the spec asks for directly ("The product should make the incremental
 * value of Pro visible without artificially throttling ordinary
 * practice") - Practice keeps unlimited attempts and the full score
 * breakdown, so ordinary practice is not throttled.
 *
 * This is a default, not a founder decision on record. If Practice is
 * meant to include competency or analytics, this table is the one place
 * to change. See BUSINESS_MODEL_PRODUCT_SPEC.md Section 4.
 */
export const CAPABILITY_MATRIX: Readonly<Record<Tier, Readonly<Entitlements>>> = Object.freeze({
  /** Free - Foundations: $0, permanent. Conversion funnel; pass/fail only. */
  free: Object.freeze({
    canUseSimulation: true,
    canUseAdvancedScenarios: false,
    canUseAI: false,
    canUseCloudSync: false,
    canUseAdvancedAnalytics: false,
    canAccessPremiumModules: false,

    // "Beginner only" - Foundation (1) and Beginner (2).
    maxScenarioDifficulty: 2,
    // "basic pass/fail; full scoring detail ... remain locked"
    canViewDetailedScoreBreakdown: false,
    // D1: Assessment starts at Pro.
    canStartAssessment: false,
    // "competency tracking and analytics remain locked"
    canTrackCompetency: false,
    canUseRecommendations: false,
    canViewAnalytics: false,
    canReceiveMonthlyScenarioDrops: false,
    canAccessTierExclusiveContent: false,
    canRequestTranscriptReview: false,
    canEarnCompletionCertificate: false,
    voiceQuality: "budget"
  }),

  /** Practice Access: $15/month. Beginner-Intermediate, full score detail. */
  practice: Object.freeze({
    canUseSimulation: true,
    canUseAdvancedScenarios: false,
    canUseAI: false,
    canUseCloudSync: false,
    canUseAdvancedAnalytics: false,
    canAccessPremiumModules: false,

    // "Beginner-Intermediate" - adds Intermediate (3).
    maxScenarioDifficulty: 3,
    // "Full deterministic scoring breakdown"
    canViewDetailedScoreBreakdown: true,
    // D1: Assessment starts at Pro.
    canStartAssessment: false,
    // The Practice row of the spec names neither competency nor analytics;
    // both are named as Pro unlocks. See the recorded interpretation above.
    canTrackCompetency: false,
    canUseRecommendations: false,
    canViewAnalytics: false,
    canReceiveMonthlyScenarioDrops: false,
    canAccessTierExclusiveContent: false,
    canRequestTranscriptReview: false,
    canEarnCompletionCertificate: false,
    voiceQuality: "budget"
  }),

  /** Exam-Ready Pro: $20/month. Adds Advanced, Mastered, recommendations. */
  pro: Object.freeze({
    canUseSimulation: true,
    canUseAdvancedScenarios: true,
    canUseAI: false,
    canUseCloudSync: false,
    canUseAdvancedAnalytics: true,
    canAccessPremiumModules: false,

    // "Adds Advanced" (4).
    maxScenarioDifficulty: 4,
    canViewDetailedScoreBreakdown: true,
    // D1 (owner decision, 2026-09-19): Pro is the minimum tier that may start
    // Assessment mode.
    canStartAssessment: true,
    // "Competency tracking to Mastered" - the full feature, uncapped.
    canTrackCompetency: true,
    // "recommendation engine"
    canUseRecommendations: true,
    // Analytics is named only in the Free row, paired with competency, as
    // something that is locked. It unlocks where its pair unlocks.
    canViewAnalytics: true,
    // "monthly scenario drops"
    canReceiveMonthlyScenarioDrops: true,
    canAccessTierExclusiveContent: false,
    canRequestTranscriptReview: false,
    canEarnCompletionCertificate: false,
    voiceQuality: "mid"
  }),

  /** Agency Fast-Track: +$39 one-time on top of an active Pro subscription. */
  fast_track: Object.freeze({
    canUseSimulation: true,
    canUseAdvancedScenarios: true,
    canUseAI: false,
    canUseCloudSync: false,
    canUseAdvancedAnalytics: true,
    canAccessPremiumModules: false,

    // "Adds Expert/Mastery" - Expert (5) and Master/Elite (6).
    maxScenarioDifficulty: 6,
    canViewDetailedScoreBreakdown: true,
    // D1: inherited from Pro, which Fast-Track requires.
    canStartAssessment: true,
    canTrackCompetency: true,
    canUseRecommendations: true,
    canViewAnalytics: true,
    canReceiveMonthlyScenarioDrops: true,
    // "Tier-exclusive content; personal 1:1 transcript review;
    //  completion certificate"
    canAccessTierExclusiveContent: true,
    canRequestTranscriptReview: true,
    canEarnCompletionCertificate: true,
    voiceQuality: "premium"
  })
});

/**
 * Tier ordering, cheapest first. Used for readable assertions and for
 * deriving "which tier would unlock this?" answers. Entitlement decisions
 * themselves are always read from the matrix, never computed from this
 * ordering.
 */
export const TIER_ORDER: readonly Tier[] = ["free", "practice", "pro", "fast_track"];

/**
 * Customer-facing tier names, exactly as Business Model Spec Section 4
 * writes them.
 *
 * These live in the domain rather than in a component because the tier a
 * capability belongs to is commercial policy. A UI that hard-coded
 * "Exam-Ready Pro" next to a difficulty-4 scenario would be restating the
 * matrix in a second place, which is what the spec forbids.
 */
export const TIER_LABELS: Readonly<Record<Tier, string>> = Object.freeze({
  free: "Free · Foundations",
  practice: "Practice Access",
  pro: "Exam-Ready Pro",
  fast_track: "Agency Fast-Track"
});
