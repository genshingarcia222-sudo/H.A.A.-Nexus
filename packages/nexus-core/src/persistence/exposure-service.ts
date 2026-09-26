import type { DeliveryEventRepository } from "./delivery-event-repository.js";
import type { ExposureSnapshot, StratumExposure } from "../training-engine/exposure.js";

/**
 * Turns ledger rows into the snapshot the selector reads (D12-41).
 *
 * This is the seam that keeps selection pure. The selector never touches a
 * store; a caller builds a snapshot here and hands it over. That is also why
 * this lives in `persistence` rather than `training-engine`: the module that
 * reads storage should not be the module that chooses questions.
 */

export interface SnapshotOptions {
  learnerRef: string;
  /** The date novelty is measured against. Supplied, never read from a clock. */
  asOf: string;
  /**
   * Whether this ledger sees more than one learner. Default false: a
   * single-device install cannot measure cross-learner exposure, and saying so
   * is better than implying a distribution nobody can see.
   */
  shared?: boolean;
  /** Deliverable concepts per stratum, for the feasibility check. */
  eligibleConceptsByStratum?: Record<string, number>;
  /** Deliveries considered per stratum, newest first. */
  windowSize?: number;
}

export function buildExposureSnapshot(
  ledger: DeliveryEventRepository,
  options: SnapshotOptions
): ExposureSnapshot {
  const mine = ledger.find({ learnerRef: options.learnerRef });

  // Sessions ago is counted in this learner's own sessions, not in wall-clock
  // time: "three sessions ago" means the same whether they were yesterday or
  // last month.
  const sessionOrder = [...new Set(mine.map((event) => event.sessionId))];
  const sessionsFromNewest = new Map(
    [...sessionOrder].reverse().map((sessionId, index) => [sessionId, index + 1] as const)
  );

  const sessionsAgo: Record<string, number> = {};
  const lastSeenOn: Record<string, string> = {};
  const bandTotals = new Map<number, { attempts: number; correct: number }>();

  for (const event of mine) {
    const concept = event.conceptId;
    if (concept) {
      const ago = sessionsFromNewest.get(event.sessionId) ?? 1;
      const known = sessionsAgo[concept];
      if (known === undefined || ago < known) sessionsAgo[concept] = ago;
      const seen = lastSeenOn[concept];
      if (seen === undefined || event.deliveredOn > seen) lastSeenOn[concept] = event.deliveredOn;
    }
    if (event.correct !== undefined) {
      const band = bandTotals.get(event.difficultyLevel) ?? { attempts: 0, correct: 0 };
      band.attempts += 1;
      if (event.correct) band.correct += 1;
      bandTotals.set(event.difficultyLevel, band);
    }
  }

  const learner = {
    sessionsAgo,
    lastSeenOn,
    ...(bandTotals.size > 0
      ? { bands: [...bandTotals.entries()].map(([difficulty, totals]) => ({ difficulty, ...totals })) }
      : {})
  };

  if (!options.shared) {
    return { scope: "LEARNER_ONLY", learner };
  }

  // Shared: counts only. No learner reference crosses into the snapshot.
  const windowSize = options.windowSize ?? 500;
  const strata: Record<string, StratumExposure> = {};
  const all = ledger.find();

  for (const event of all.slice(-windowSize * 4)) {
    const key = event.trace.stratumKey;
    const stratum = strata[key] ?? { windowSize: 0, conceptCounts: {} };
    stratum.windowSize += 1;
    if (event.conceptId) {
      stratum.conceptCounts[event.conceptId] = (stratum.conceptCounts[event.conceptId] ?? 0) + 1;
    }
    strata[key] = stratum;
  }

  for (const [key, eligible] of Object.entries(options.eligibleConceptsByStratum ?? {})) {
    const stratum = strata[key];
    if (stratum) stratum.eligibleConcepts = eligible;
  }

  return { scope: "SHARED", learner, strata };
}
