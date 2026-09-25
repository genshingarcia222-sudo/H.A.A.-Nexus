import { describe, expect, it } from "vitest";
import type { TrainingQuestion } from "../question-bank/schema.js";
import { createSeededRandom } from "./question-selection.js";
import { selectDelivery } from "./delivery.js";
import { DEFAULT_DELIVERY_POLICY, stratumKeyFor } from "./exposure.js";
import type { ExposureSnapshot } from "./exposure.js";
import { resolveTrainingEnvelope } from "../entitlement-engine/training-envelopes.js";

/**
 * D12-43, measured rather than asserted.
 *
 * The unit tests in `delivery.test.ts` check that `assessCrossUserExposure`
 * classifies a share correctly. This file checks the thing that classification
 * exists for: that the **engine**, run over many deliveries, actually keeps
 * any one concept's share of recent deliveries near the target — and that it
 * pulls an already-skewed stratum back toward it rather than merely declining
 * to make it worse.
 *
 * The simulation is deterministic: one seeded source per session, no clock, no
 * `Math.random`. A failure here is a real regression in selection, not flake.
 *
 * **What the simulation showed, and why the second test looks the way it does.**
 * A session never serves one concept twice, so with K eligible concepts a
 * concept's share is already bounded at about 1/K. Once K >= 7 - which is also
 * the point at which a 1/7 ceiling becomes reachable at all - the bound is
 * tighter than the target, and the ceiling has nothing left to do. Written the
 * obvious way, a 20,000-delivery run therefore passes whether or not the
 * cross-user key is wired in: verified by deleting the key and watching the
 * test stay green.
 *
 * So the discriminating case is the one below: everything else about the
 * candidates is equal, and the over-exposed concept is the only thing the
 * engine can be choosing on. That test fails when the key is removed, which is
 * what makes it worth having.
 */

const ASOF = "2026-09-25";
const ENVELOPE = resolveTrainingEnvelope("free");
const POLICY = DEFAULT_DELIVERY_POLICY;
const TARGET = POLICY.repetition.crossUserExposureTarget; // 1/7
const WINDOW = POLICY.repetition.windowSize; // 500

/** All one difficulty, so every delivery lands in a single stratum. */
function question(index: number): TrainingQuestion {
  return {
    questionId: `Q${String(index).padStart(3, "0")}`,
    domain: "Medical Scribing",
    skillArea: "Privacy & Confidentiality",
    difficultyLevel: 1,
    questionType: "recognition",
    learningObjective: `Objective ${index}`,
    question: `Question ${index}?`,
    choices: [
      { id: "a", text: "one" },
      { id: "b", text: "two" },
      { id: "c", text: "three" }
    ],
    correctChoiceId: "a",
    rationale: "Because.",
    source: { ref: "SRC", locator: "Heading" },
    variantGroup: `CONCEPT-${index}`,
    contentStatus: "production-eligible",
    reviewStatus: "approved",
    flags: [],
    verification: { humanVerificationRequired: true, humanVerifiedBy: "REV-ANA", humanVerifiedOn: "2026-09-22" }
  } as TrainingQuestion;
}

const STRATUM = stratumKeyFor({
  population: "practice",
  envelopeId: ENVELOPE.envelopeId,
  modality: "DIRECT_KNOWLEDGE",
  difficultyLevel: 1,
  jurisdictions: ["US"]
});

/** A rolling window of delivered concepts, exactly as the ledger would fold it. */
class Window {
  private readonly delivered: string[] = [];

  constructor(private readonly size: number) {}

  push(conceptId: string): void {
    this.delivered.push(conceptId);
    if (this.delivered.length > this.size) this.delivered.shift();
  }

  seed(conceptId: string, times: number): void {
    for (let i = 0; i < times; i++) this.push(conceptId);
  }

  counts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const conceptId of this.delivered) counts[conceptId] = (counts[conceptId] ?? 0) + 1;
    return counts;
  }

  get length(): number {
    return this.delivered.length;
  }

  maxShare(): number {
    if (this.delivered.length === 0) return 0;
    return Math.max(...Object.values(this.counts())) / this.delivered.length;
  }

  snapshot(eligibleConcepts: number): ExposureSnapshot {
    return {
      scope: "SHARED",
      strata: { [STRATUM]: { windowSize: this.length, conceptCounts: this.counts(), eligibleConcepts } }
    };
  }
}

/**
 * Runs `sessions` sessions of ten, each for a different learner (so no learner
 * history applies and the cross-user key is the only thing steering), folding
 * every delivery back into the window the next session reads.
 */
function simulate(options: { pool: TrainingQuestion[]; sessions: number; window: Window; seedFrom?: number }) {
  const { pool, sessions, window } = options;
  const seedFrom = options.seedFrom ?? 1;
  const shares: number[] = [];
  const reasons = new Set<string>();

  for (let session = 0; session < sessions; session++) {
    const result = selectDelivery({
      pool,
      request: { count: 10, asOf: ASOF },
      envelope: ENVELOPE,
      exposure: window.snapshot(new Set(pool.map((entry) => entry.variantGroup)).size),
      policy: POLICY,
      random: createSeededRandom(seedFrom + session)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") break;

    for (const trace of result.traces) {
      for (const reason of trace.reasons) reasons.add(reason);
      if (trace.conceptId) window.push(trace.conceptId);
    }
    if (window.length >= WINDOW) shares.push(window.maxShare());
  }

  return { shares, reasons };
}

describe("the 1-in-7 target holds across many deliveries", () => {
  it("keeps every concept's share at or under the target over 20,000 deliveries", () => {
    // 2,000 sessions of ten, 20 concepts, one stratum.
    const pool = Array.from({ length: 20 }, (_, index) => question(index + 1));
    const window = new Window(WINDOW);
    const { shares } = simulate({ pool, sessions: 2000, window });

    expect(shares.length).toBeGreaterThan(1000);
    const compliant = shares.filter((share) => share <= TARGET + 0.02).length / shares.length;
    expect(compliant).toBeGreaterThanOrEqual(0.95);
    expect(Math.max(...shares)).toBeLessThanOrEqual(TARGET + 0.02);
  });

  it("declines an over-exposed concept when nothing else separates the candidates", () => {
    // One pick per session, eight concepts, no learner history: novelty ties,
    // diversity cost is zero for every candidate because nothing has been
    // chosen yet, so the cross-user ceiling is the only thing that can decide.
    // CONCEPT-1 starts at half the window, far above 1/7.
    const pool = Array.from({ length: 8 }, (_, index) => question(index + 1));
    const window = new Window(WINDOW);
    window.seed("CONCEPT-1", Math.floor(WINDOW / 2));
    for (let i = 0; i < Math.floor(WINDOW / 2); i++) window.push(`CONCEPT-${(i % 7) + 2}`);

    let servedOverExposed = 0;
    for (let session = 0; session < 200; session++) {
      const result = selectDelivery({
        pool,
        request: { count: 1, asOf: ASOF },
        envelope: ENVELOPE,
        exposure: window.snapshot(8),
        policy: POLICY,
        random: createSeededRandom(9000 + session)
      });
      expect(result.status).toBe("success");
      if (result.status !== "success") break;
      const conceptId = result.traces[0]?.conceptId;
      if (conceptId === "CONCEPT-1") servedOverExposed += 1;
    }

    // Left to chance it would be served about one time in eight; the ceiling
    // holds it out entirely while its share stays above the target.
    expect(servedOverExposed).toBe(0);
  });

  it("records why the target did not apply when the pool is too small for it", () => {
    // Seven concepts are needed for a 1/7 ceiling to be reachable at all.
    const pool = Array.from({ length: 5 }, (_, index) => question(index + 1));
    const window = new Window(WINDOW);
    window.seed("CONCEPT-1", 400);

    const result = selectDelivery({
      pool,
      request: { count: 5, asOf: ASOF },
      envelope: ENVELOPE,
      exposure: window.snapshot(5),
      policy: POLICY,
      random: createSeededRandom(11)
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    for (const trace of result.traces) {
      expect(trace.reasons).toContain("TARGET_INFEASIBLE_POOL_TOO_SMALL");
      expect(trace.crossUserOverExposed).toBe(false);
    }
  });

  it("never claims a distribution it cannot see", () => {
    // A single-device install has no shared ledger: every delivery says so.
    const pool = Array.from({ length: 20 }, (_, index) => question(index + 1));
    const result = selectDelivery({
      pool,
      request: { count: 10, asOf: ASOF },
      envelope: ENVELOPE,
      exposure: { scope: "LEARNER_ONLY" },
      policy: POLICY,
      random: createSeededRandom(3)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    for (const trace of result.traces) {
      expect(trace.reasons).toContain("CROSS_USER_NOT_MEASURABLE");
      expect(trace.crossUserShare).toBeUndefined();
    }
  });
});
