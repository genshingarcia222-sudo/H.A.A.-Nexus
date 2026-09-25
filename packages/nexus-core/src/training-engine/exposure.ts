/**
 * Who has seen what — held **outside** the corpus (D12-39, D12-41).
 *
 * Exposure history is runtime fact, not content truth. Nothing here can change
 * what a question's correct answer is, and no corpus record may reference any
 * of it. The selector never reads a store: an `ExposureSnapshot` is computed by
 * a caller and handed in, which is what keeps selection a pure function and
 * keeps the selector's boundary test meaningful.
 *
 * An **empty snapshot is valid** and means "no history available". It never
 * means "nobody has seen this" — see `CROSS_USER_NOT_MEASURABLE` below.
 */

/** How recently this learner met a concept (D12-42). */
export const NOVELTY_CLASSES = ["UNSEEN", "STALE", "RECENT", "SAME_SESSION"] as const;
export type NoveltyClass = (typeof NOVELTY_CLASSES)[number];

/** The order the selector prefers them in. Lower is better. */
export const NOVELTY_RANK: Readonly<Record<NoveltyClass, number>> = Object.freeze({
  UNSEEN: 0,
  STALE: 1,
  RECENT: 2,
  SAME_SESSION: 3
});

/**
 * Why an item was chosen, or chosen despite something (D12-47).
 *
 * A closed set, because these end up in a delivery record that someone will
 * later read to answer "why did this learner get this question?".
 */
export const SELECTION_REASONS = [
  "UNSEEN",
  "LEAST_RECENTLY_SEEN",
  "REPEAT_ALLOWED",
  "REMEDIATION_REQUESTED",
  "MANDATORY_COVERAGE",
  "ONLY_VALID_CANDIDATE",
  "DIVERSITY",
  "ADAPTIVE_TARGET",
  "ADAPTIVE_NO_HISTORY",
  "TARGET_INFEASIBLE_POOL_TOO_SMALL",
  "INSUFFICIENT_SAMPLE",
  "CROSS_USER_NOT_MEASURABLE",
  "LEARNER_NOVELTY_PRIORITY"
] as const;
export type SelectionReason = (typeof SELECTION_REASONS)[number];

export interface LearnerExposure {
  /** Sessions ago this concept was last delivered to this learner. */
  sessionsAgo: Record<string, number>;
  /** ISO date this concept was last delivered to this learner. */
  lastSeenOn: Record<string, string>;
  /** Answered deliveries per difficulty band, for adaptive policy. */
  bands?: { difficulty: number; attempts: number; correct: number }[];
}

export interface StratumExposure {
  /** Deliveries in the window. */
  windowSize: number;
  /** Deliveries of each concept within it. */
  conceptCounts: Record<string, number>;
  /** Distinct deliverable concepts in this stratum, for feasibility. */
  eligibleConcepts?: number;
}

export interface ExposureSnapshot {
  /**
   * `LEARNER_ONLY` on a single-device install: there is no shared ledger, so
   * cross-learner distribution **cannot be measured**. Saying so is the
   * honest option; claiming a distribution nobody can see is not.
   */
  scope: "LEARNER_ONLY" | "SHARED";
  learner?: LearnerExposure;
  strata?: Record<string, StratumExposure>;
}

export const EMPTY_EXPOSURE: ExposureSnapshot = Object.freeze({ scope: "LEARNER_ONLY" });

/** Defaults for the repetition policy (D12-42, D12-43). All configurable. */
export interface RepetitionPolicy {
  staleAfterSessions: number;
  staleAfterDays: number;
  /** The cross-user ceiling on one concept's share of recent deliveries. */
  crossUserExposureTarget: number;
  /** Deliveries considered per stratum. */
  windowSize: number;
  /** Below this many deliveries the share is noise. */
  minimumSample: number;
}

export const DEFAULT_REPETITION_POLICY: RepetitionPolicy = Object.freeze({
  staleAfterSessions: 3,
  staleAfterDays: 14,
  crossUserExposureTarget: 1 / 7,
  windowSize: 500,
  minimumSample: 50
});

export interface AdaptivePolicy {
  /** Off by default: turning it on changes what learners see, which is the owner's call. */
  enabled: boolean;
  lookback: number;
  promoteAtAccuracy: number;
  demoteBelowAccuracy: number;
  minimumAttempts: number;
}

export const DEFAULT_ADAPTIVE_POLICY: AdaptivePolicy = Object.freeze({
  enabled: false,
  lookback: 20,
  promoteAtAccuracy: 0.8,
  demoteBelowAccuracy: 0.5,
  minimumAttempts: 10
});

export interface DeliveryPolicy {
  policyVersion: string;
  repetition: RepetitionPolicy;
  adaptive: AdaptivePolicy;
  /** Presentation order of choices. Off: correctness is by id, so this is safe to enable later. */
  shuffleChoices: boolean;
}

export const DEFAULT_DELIVERY_POLICY: DeliveryPolicy = Object.freeze({
  policyVersion: "training.default@1",
  repetition: DEFAULT_REPETITION_POLICY,
  adaptive: DEFAULT_ADAPTIVE_POLICY,
  shuffleChoices: false
});

/**
 * How recently this learner saw a concept.
 *
 * Exposure is counted **per concept**, not per item: meeting one variant is
 * meeting the concept, so a sibling variant is not "new to you" the next day.
 */
export function noveltyClassFor(
  conceptId: string | undefined,
  snapshot: ExposureSnapshot,
  policy: RepetitionPolicy,
  asOf: string
): NoveltyClass {
  if (!conceptId) return "UNSEEN";
  const learner = snapshot.learner;
  if (!learner) return "UNSEEN";

  const sessionsAgo = learner.sessionsAgo[conceptId];
  const lastSeenOn = learner.lastSeenOn[conceptId];
  if (sessionsAgo === undefined && lastSeenOn === undefined) return "UNSEEN";
  if (sessionsAgo === 0) return "SAME_SESSION";

  const recentBySessions = sessionsAgo !== undefined && sessionsAgo <= policy.staleAfterSessions;
  const recentByDays = lastSeenOn !== undefined && daysBetween(lastSeenOn, asOf) <= policy.staleAfterDays;
  // Stale requires *both* bounds to have passed: a concept seen twice last
  // week is not stale merely because four sessions have happened since.
  return recentBySessions || recentByDays ? "RECENT" : "STALE";
}

function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface CrossUserAssessment {
  /** True when this concept is already at or over its share of the window. */
  overExposed: boolean;
  /** Why the target did not apply, when it did not. */
  reason?: SelectionReason;
  share?: number;
}

/**
 * Whether serving this concept again would push it past the cross-user target
 * (D12-43).
 *
 * The target is a **ceiling on a share, not a ban**: an over-exposed concept is
 * ranked after everything else of the same novelty, never removed. And it only
 * applies where it can be measured and where it is achievable — with fewer than
 * `ceil(1/target)` concepts in a stratum, no selection can hold every share
 * below the target, so the engine records that instead of pretending.
 */
export function assessCrossUserExposure(
  conceptId: string | undefined,
  stratumKey: string,
  snapshot: ExposureSnapshot,
  policy: RepetitionPolicy
): CrossUserAssessment {
  if (snapshot.scope !== "SHARED") {
    return { overExposed: false, reason: "CROSS_USER_NOT_MEASURABLE" };
  }
  const stratum = snapshot.strata?.[stratumKey];
  if (!stratum || stratum.windowSize < policy.minimumSample) {
    return { overExposed: false, reason: "INSUFFICIENT_SAMPLE" };
  }
  const needed = Math.ceil(1 / policy.crossUserExposureTarget);
  if ((stratum.eligibleConcepts ?? Number.POSITIVE_INFINITY) < needed) {
    return { overExposed: false, reason: "TARGET_INFEASIBLE_POOL_TOO_SMALL" };
  }
  if (!conceptId) return { overExposed: false };

  const count = stratum.conceptCounts[conceptId] ?? 0;
  const share = (count + 1) / (stratum.windowSize + 1);
  return { overExposed: share > policy.crossUserExposureTarget, share };
}

/** The comparable-conditions key a cross-user share is measured within. */
export function stratumKeyFor(parts: {
  population: string;
  envelopeId: string;
  modality: string;
  difficultyLevel: number;
  jurisdictions: string[];
}): string {
  return [
    parts.population,
    parts.envelopeId,
    parts.modality,
    String(parts.difficultyLevel),
    [...parts.jurisdictions].sort().join("+")
  ].join("|");
}
