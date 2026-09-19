import type { Entitlements } from "../types/entitlements.js";
import type { SubscriptionState, Tier } from "../types/subscription.js";
import type { DifficultyLevel } from "../scenario-engine/difficulty.js";
import type { SimulationMode } from "../simulation-engine/types.js";
import { CAPABILITY_MATRIX, TIER_ORDER } from "./capability-matrix.js";

/**
 * Entitlement resolution. Every function here is pure: no I/O, no clock
 * read, no vendor SDK, no React/Tauri/SQLite. `now` is passed in rather
 * than read from `Date.now()`, matching the convention the rest of
 * nexus-core already uses (`startSession(params, now)`,
 * `updateCompetencyRecord(..., now)`, `generateRecommendations(..., now)`).
 *
 * That purity is the point, not a stylistic preference. The business spec
 * requires that protected capabilities be enforceable at a real backend
 * boundary and never trusted from the frontend alone. Because this resolver
 * depends on nothing but its arguments, the identical function can later be
 * executed server-side as the authority over the same `SubscriptionState`,
 * with the client running it only for UX. Writing it any other way would
 * make that impossible without a rewrite.
 */

/**
 * Whether the subscription currently entitles the learner to their tier.
 *
 * - `active`   - current, unless a bounded period has already ended.
 * - `past_due` - the provider is still retrying payment. Access continues
 *                through the period the learner already paid for, then
 *                stops. This is standard dunning behaviour and avoids
 *                revoking access over a transient card failure.
 * - `canceled` - cancellation requested; the paid period still runs out.
 * - `none` / `expired` - never entitled.
 */
export function isSubscriptionCurrent(state: SubscriptionState, now: number): boolean {
  switch (state.status) {
    case "active":
      // A null period end means "unbounded" (Free is permanent), not "expired".
      return state.currentPeriodEnd === null || state.currentPeriodEnd > now;
    case "past_due":
    case "canceled":
      // Both retain access only for the remainder of an already-paid
      // period, so an unbounded record cannot keep them alive forever.
      return state.currentPeriodEnd !== null && state.currentPeriodEnd > now;
    case "none":
    case "expired":
      return false;
  }
}

/**
 * The tier whose capabilities actually apply, after lapse and after the
 * Fast-Track relationship is enforced.
 *
 * This is the only place the rule "Agency Fast-Track requires an active
 * Pro subscription" lives. It cuts both ways:
 *
 *  - Pro + purchased Fast-Track resolves *up* to `fast_track`.
 *  - A record claiming `tier: "fast_track"` without the purchase resolves
 *    *down* to `pro`, so the add-on can never be obtained by asserting a
 *    tier string.
 *  - A purchased Fast-Track sitting on Free or Practice confers nothing.
 *    It is not lost either - the flag persists, so restoring Pro restores
 *    Fast-Track without a second $39 payment.
 *  - Any lapsed subscription falls back to Free first, which means an
 *    expired Pro + Fast-Track resolves to Free, not to Fast-Track.
 */
export function resolveEffectiveTier(state: SubscriptionState, now: number): Tier {
  const base: Tier = isSubscriptionCurrent(state, now) ? state.tier : "free";

  if (base === "fast_track") {
    return state.fastTrackPurchased ? "fast_track" : "pro";
  }
  if (base === "pro" && state.fastTrackPurchased) {
    return "fast_track";
  }
  return base;
}

/**
 * Resolves a subscription state to the capability set it grants.
 * Pure: the same `(state, now)` always yields the same entitlements.
 */
export function resolveEntitlements(state: SubscriptionState, now: number): Entitlements {
  return CAPABILITY_MATRIX[resolveEffectiveTier(state, now)];
}

/**
 * Whether a scenario of the given difficulty is unlocked.
 *
 * Reads the scenario schema's existing 1-6 difficulty metadata as the
 * canonical gating axis (Business Model Spec Section 4: "Do not create a
 * parallel difficulty-gating system if the existing metadata can serve as
 * the canonical source").
 */
export function canAccessDifficulty(
  entitlements: Entitlements,
  difficulty: DifficultyLevel
): boolean {
  return difficulty <= entitlements.maxScenarioDifficulty;
}

/**
 * Whether the learner may start a session in this mode.
 *
 * Decision D1 (owner-selected 2026-09-19): Assessment requires the
 * `canStartAssessment` capability, whose per-tier values live in
 * `CAPABILITY_MATRIX` - minimum tier Pro. Practice and simulation are
 * ungated, because no source gates them.
 *
 * The mapping from mode to capability belongs here, with the matrix, rather
 * than in a UI or a store: a `mode === "assessment"` test written in the
 * desktop app would be a second place where commercial policy lives, and an
 * invariant test forbids exactly that.
 */
export function canStartMode(entitlements: Entitlements, mode: SimulationMode): boolean {
  return mode === "assessment" ? entitlements.canStartAssessment : true;
}

/**
 * The cheapest tier whose capabilities unlock a scenario of this
 * difficulty, or `null` if no tier does.
 *
 * Derived from `CAPABILITY_MATRIX` at call time rather than kept as a
 * second difficulty-to-tier table, so it can never disagree with the
 * matrix. This is what lets a locked scenario say which access level it
 * needs without the UI restating the commercial policy itself.
 */
export function minimumTierForDifficulty(difficulty: DifficultyLevel): Tier | null {
  for (const tier of TIER_ORDER) {
    if (canAccessDifficulty(CAPABILITY_MATRIX[tier], difficulty)) return tier;
  }
  return null;
}
