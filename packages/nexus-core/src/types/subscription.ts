/**
 * Provider-neutral subscription domain model (Architecture Package Section
 * 24; Business Model Spec Section 4).
 *
 * Nothing in this file knows that PayMongo exists, or that a payment
 * provider exists at all. A provider adapter's job, when one arrives in a
 * later increment, is to normalize its own webhook/state vocabulary *into*
 * these types - never to leak its own shape outward. That keeps the
 * entitlement domain testable with plain fixtures and no live provider,
 * which the business spec requires explicitly.
 */

/**
 * The commercial ladder from Business Model Spec Section 4.
 *
 * `fast_track` is the Agency Fast-Track add-on. It is a one-time purchase
 * that *requires an active Pro subscription*, so it is not a freestanding
 * recurring tier - see `fastTrackPurchased` below and the resolver's
 * `resolveEffectiveTier`, which is the only place that relationship is
 * enforced.
 */
export type Tier = "free" | "practice" | "pro" | "fast_track";

/**
 * Subscription lifecycle. Deliberately the minimum set needed to resolve
 * entitlements correctly - no extra states are invented here, because every
 * additional state is a branch the resolver and its tests must carry.
 *
 * - `none`      no subscription record exists (the local/MVP default)
 * - `active`    paid and current
 * - `past_due`  payment failed; the provider is retrying (dunning)
 * - `canceled`  cancellation requested; the already-paid period still runs
 * - `expired`   the period has ended with no renewal
 */
export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled" | "expired";

export interface SubscriptionState {
  tier: Tier;
  status: SubscriptionStatus;
  /**
   * Epoch milliseconds at which the currently-paid period ends.
   *
   * `null` means "no bounded paid period" - which is the normal case for
   * Free (permanent, per the spec) and for `status: "none"`. A paid tier
   * with a null period end is treated as unbounded rather than expired, so
   * a malformed record fails toward the learner keeping access they paid
   * for rather than silently losing it.
   */
  currentPeriodEnd: number | null;
  /**
   * Whether the $39 one-time Agency Fast-Track add-on has been purchased.
   *
   * Tracked separately from `tier` because it is a one-time purchase layered
   * on a recurring subscription, not a rung on the ladder. It only takes
   * effect while the underlying Pro subscription is current; otherwise it
   * lies dormant rather than being lost, so re-subscribing to Pro restores
   * Fast-Track without a second purchase.
   */
  fastTrackPurchased: boolean;
}

/**
 * The state every local/MVP user is in today: no subscription record at all.
 * This is the input that must resolve to exactly `DEFAULT_ENTITLEMENTS`
 * (pinned by a test), which is what keeps the pre-commercialization app
 * behaving identically now that a tier model exists.
 */
export const NO_SUBSCRIPTION: SubscriptionState = {
  tier: "free",
  status: "none",
  currentPeriodEnd: null,
  fastTrackPurchased: false
};
