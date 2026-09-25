import type { Tier } from "../types/subscription.js";

/**
 * What a tier may draw from — **not** what it owns (D12-36).
 *
 * The distinction is the point. A tier does not hold an inventory of
 * questions; it holds an *envelope*: the difficulties, modalities, domains and
 * collections a session may select within, and how large a session may be. The
 * pool is shared, selection is dynamic, and content never names a tier.
 *
 * These live beside `CAPABILITY_MATRIX` and are frozen data for the same
 * reason it is: a capability expressed as data can be read, tested and changed
 * without hunting for conditionals.
 *
 * **The initial values reproduce today's behaviour exactly** (D12-37). Training
 * has no tier gating right now — D11 left `difficultyLevel` deliberately
 * unmapped to any tier — so every envelope is open, and runs are ten questions
 * as `DEFAULT_TRAINING_RUN_SIZE` says. Which tier should receive which
 * difficulties or modalities is a commercial decision nobody has taken, and
 * inventing one here would answer it by implementation.
 */

export interface TierEnvelope {
  /** Identifies the envelope in a delivery record, so a trace can be read later. */
  envelopeId: string;
  difficultyLevels: readonly (1 | 2 | 3 | 4 | 5 | 6)[];
  /** `"ALL"` rather than a list: an empty list would read as "none". */
  modalities: readonly string[] | "ALL";
  domains: readonly string[] | "ALL";
  /** Editorial groupings this tier may draw from (D12-57). */
  collections: readonly string[] | "ALL";
  sessionSize: { min: number; max: number; default: number };
  adaptiveAllowed: boolean;
  temporalModes: readonly ("CURRENT_ONLY" | "INCLUDE_FUTURE")[];
}

const OPEN_ENVELOPE = (tier: Tier): TierEnvelope => ({
  envelopeId: `training.${tier}@1`,
  difficultyLevels: [1, 2, 3, 4, 5, 6],
  modalities: "ALL",
  domains: "ALL",
  collections: "ALL",
  sessionSize: { min: 10, max: 10, default: 10 },
  adaptiveAllowed: false,
  temporalModes: ["CURRENT_ONLY"]
});

export const TRAINING_DELIVERY_ENVELOPES: Readonly<Record<Tier, TierEnvelope>> = Object.freeze({
  free: Object.freeze(OPEN_ENVELOPE("free")),
  practice: Object.freeze(OPEN_ENVELOPE("practice")),
  pro: Object.freeze(OPEN_ENVELOPE("pro")),
  fast_track: Object.freeze(OPEN_ENVELOPE("fast_track"))
});

/** The envelope a tier delivers within. Pure, like `resolveEntitlements`. */
export function resolveTrainingEnvelope(tier: Tier): TierEnvelope {
  return TRAINING_DELIVERY_ENVELOPES[tier];
}

/** Whether a value is inside an envelope dimension that may be `"ALL"`. */
export function envelopeAllows(dimension: readonly string[] | "ALL", value: string): boolean {
  return dimension === "ALL" || dimension.includes(value);
}
