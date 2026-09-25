import { describe, expect, it } from "vitest";
import { createSeededRandom, selectTrainingQuestions } from "./question-selection.js";
import type { TrainingQuestion } from "../question-bank/schema.js";
import type { QuestionBankRepository } from "../question-bank/repository.js";
import { selectDelivery } from "./delivery.js";
import {
  DEFAULT_DELIVERY_POLICY,
  EMPTY_EXPOSURE,
  assessCrossUserExposure,
  noveltyClassFor,
  stratumKeyFor
} from "./exposure.js";
import type { ExposureSnapshot } from "./exposure.js";
import { TRAINING_DELIVERY_ENVELOPES, resolveTrainingEnvelope } from "../entitlement-engine/training-envelopes.js";

/**
 * D12 work package 7 — dynamic delivery.
 *
 * The load-bearing claim is the compatibility one: with no history and an open
 * envelope, delivery must reproduce the existing selector exactly. Everything
 * else is only safe because that holds.
 */

const ASOF = "2026-09-25";
const OPEN = resolveTrainingEnvelope("free");

function question(index: number, overrides: Partial<TrainingQuestion> = {}): TrainingQuestion {
  return {
    questionId: `Q${String(index).padStart(3, "0")}`,
    domain: "Medical Scribing",
    skillArea: index % 2 === 0 ? "Privacy & Confidentiality" : "Lookup Literacy",
    difficultyLevel: ((index % 6) + 1) as TrainingQuestion["difficultyLevel"],
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
    verification: { humanVerificationRequired: true, humanVerifiedBy: "REV-ANA", humanVerifiedOn: "2026-09-22" },
    ...overrides
  } as TrainingQuestion;
}

const pool = (size: number) => Array.from({ length: size }, (_, index) => question(index + 1));

/** The bank's repository interface, backed by a fixed pool. */
function repositoryOf(questions: TrainingQuestion[]): QuestionBankRepository {
  return {
    size: questions.length,
    getAll: () => [...questions],
    getById: (id: string) => questions.find((entry) => entry.questionId === id),
    getProductionEligible: () => [...questions]
  } as unknown as QuestionBankRepository;
}

describe("compatibility with the existing selector", () => {
  it("reproduces the selector's run exactly, for many seeds", () => {
    const questions = pool(30);
    const repository = repositoryOf(questions);

    for (let seed = 1; seed <= 200; seed++) {
      const legacy = selectTrainingQuestions(repository, { count: 10 }, createSeededRandom(seed));
      const delivered = selectDelivery({
        pool: questions,
        request: { count: 10, asOf: ASOF },
        envelope: OPEN,
        random: createSeededRandom(seed)
      });
      expect(legacy.status).toBe("success");
      expect(delivered.status).toBe("success");
      if (legacy.status !== "success" || delivered.status !== "success") return;
      expect(delivered.questions.map((entry) => entry.questionId)).toEqual(
        legacy.questions.map((entry) => entry.questionId)
      );
    }
  });

  it("keeps the inherited insufficiency behaviour rather than padding", () => {
    const result = selectDelivery({ pool: pool(9), request: { count: 10, asOf: ASOF }, envelope: OPEN });
    expect(result).toEqual({ status: "insufficient-eligible-content", requested: 10, available: 9 });
  });

  it("does not create insufficiency out of repetition", () => {
    // Everything has been seen; a short pool still fills the run.
    const questions = pool(10);
    const exposure: ExposureSnapshot = {
      scope: "LEARNER_ONLY",
      learner: {
        sessionsAgo: Object.fromEntries(questions.map((entry) => [entry.variantGroup!, 1])),
        lastSeenOn: Object.fromEntries(questions.map((entry) => [entry.variantGroup!, "2026-09-24"]))
      }
    };
    const result = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      exposure,
      random: createSeededRandom(7)
    });
    expect(result.status).toBe("success");
  });
});

describe("the envelope constrains, and refuses rather than narrows", () => {
  it("ships every tier open, exactly as Training behaves today", () => {
    for (const envelope of Object.values(TRAINING_DELIVERY_ENVELOPES)) {
      expect(envelope.difficultyLevels).toEqual([1, 2, 3, 4, 5, 6]);
      expect(envelope.modalities).toBe("ALL");
      expect(envelope.sessionSize).toEqual({ min: 1, max: 10, default: 10 });
      expect(envelope.adaptiveAllowed).toBe(false);
    }
  });

  it("refuses a request outside the envelope instead of quietly changing it", () => {
    const narrow = { ...OPEN, difficultyLevels: [1, 2] as const };
    const result = selectDelivery({
      pool: pool(30),
      request: { count: 10, difficultyLevels: [5], asOf: ASOF },
      envelope: narrow
    });
    expect(result.status).toBe("invalid-request");
    if (result.status !== "invalid-request") return;
    expect(result.errors.join("\n")).toContain("outside this tier's envelope");
  });

  it("refuses a session size the tier does not allow", () => {
    // Above the ceiling, not merely different: a smaller run is something the
    // Training surface has always been able to ask for.
    const tooLarge = selectDelivery({ pool: pool(30), request: { count: 25, asOf: ASOF }, envelope: OPEN });
    expect(tooLarge.status).toBe("invalid-request");

    const smaller = selectDelivery({ pool: pool(30), request: { count: 5, asOf: ASOF }, envelope: OPEN });
    expect(smaller.status).toBe("success");
  });

  it("filters the pool by the envelope's difficulties", () => {
    const narrow = { ...OPEN, difficultyLevels: [1] as const, sessionSize: { min: 1, max: 10, default: 5 } };
    const result = selectDelivery({ pool: pool(30), request: { count: 5, asOf: ASOF }, envelope: narrow });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.questions.every((entry) => entry.difficultyLevel === 1)).toBe(true);
  });

  it("requires an ISO date rather than reading a clock", () => {
    const result = selectDelivery({ pool: pool(30), request: { count: 10, asOf: "today" }, envelope: OPEN });
    expect(result.status).toBe("invalid-request");
  });
});

describe("a learner's own history comes first", () => {
  const questions = pool(20);
  const seenRecently = questions.slice(0, 10).map((entry) => entry.variantGroup!);

  const exposure: ExposureSnapshot = {
    scope: "LEARNER_ONLY",
    learner: {
      sessionsAgo: Object.fromEntries(seenRecently.map((concept) => [concept, 1])),
      lastSeenOn: Object.fromEntries(seenRecently.map((concept) => [concept, "2026-09-24"]))
    }
  };

  it("prefers unseen concepts when enough exist", () => {
    const result = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      exposure,
      random: createSeededRandom(3)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    for (const trace of result.traces) {
      expect(trace.novelty).toBe("UNSEEN");
    }
  });

  it("never repeats a concept inside one session", () => {
    const twins = [question(1), { ...question(2), variantGroup: "CONCEPT-1" }, ...pool(20).slice(2)];
    const result = selectDelivery({
      pool: twins,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      random: createSeededRandom(11)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const concepts = result.questions.map((entry) => entry.variantGroup);
    expect(new Set(concepts).size).toBe(concepts.length);
  });

  it("classifies novelty by both bounds, per concept", () => {
    const policy = DEFAULT_DELIVERY_POLICY.repetition;
    const snapshot: ExposureSnapshot = {
      scope: "LEARNER_ONLY",
      learner: { sessionsAgo: { A: 0, B: 1, C: 9 }, lastSeenOn: { A: ASOF, B: "2026-09-24", C: "2026-06-01" } }
    };
    expect(noveltyClassFor("A", snapshot, policy, ASOF)).toBe("SAME_SESSION");
    expect(noveltyClassFor("B", snapshot, policy, ASOF)).toBe("RECENT");
    expect(noveltyClassFor("C", snapshot, policy, ASOF)).toBe("STALE");
    expect(noveltyClassFor("D", snapshot, policy, ASOF)).toBe("UNSEEN");
    expect(noveltyClassFor("A", EMPTY_EXPOSURE, policy, ASOF)).toBe("UNSEEN");
  });

  it("treats a requested repeat as wanted, and says so in the trace", () => {
    const result = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF, intentionalRepeats: [seenRecently[0]!] },
      envelope: OPEN,
      exposure,
      random: createSeededRandom(5)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const repeated = result.traces.find((trace) => trace.conceptId === seenRecently[0]);
    expect(repeated?.reasons).toContain("REMEDIATION_REQUESTED");
  });
});

describe("cross-user exposure is a target, and only where it can be measured", () => {
  const policy = DEFAULT_DELIVERY_POLICY.repetition;
  const key = stratumKeyFor({
    population: "practice",
    envelopeId: "training.free@1",
    modality: "DIRECT_KNOWLEDGE",
    difficultyLevel: 1,
    jurisdictions: ["US"]
  });

  it("cannot be measured without a shared ledger, and says so", () => {
    const assessment = assessCrossUserExposure("C1", key, { scope: "LEARNER_ONLY" }, policy);
    expect(assessment.overExposed).toBe(false);
    expect(assessment.reason).toBe("CROSS_USER_NOT_MEASURABLE");
  });

  it("ignores a sample too small to mean anything", () => {
    const snapshot: ExposureSnapshot = {
      scope: "SHARED",
      strata: { [key]: { windowSize: 10, conceptCounts: { C1: 9 }, eligibleConcepts: 20 } }
    };
    expect(assessCrossUserExposure("C1", key, snapshot, policy).reason).toBe("INSUFFICIENT_SAMPLE");
  });

  it("reports an infeasible target rather than forcing it", () => {
    // Fewer than seven concepts: no selection can hold every share at 1/7.
    const snapshot: ExposureSnapshot = {
      scope: "SHARED",
      strata: { [key]: { windowSize: 500, conceptCounts: { C1: 300 }, eligibleConcepts: 5 } }
    };
    const assessment = assessCrossUserExposure("C1", key, snapshot, policy);
    expect(assessment.overExposed).toBe(false);
    expect(assessment.reason).toBe("TARGET_INFEASIBLE_POOL_TOO_SMALL");
  });

  it("flags a concept already over its share", () => {
    const snapshot: ExposureSnapshot = {
      scope: "SHARED",
      strata: { [key]: { windowSize: 500, conceptCounts: { C1: 100, C2: 10 }, eligibleConcepts: 20 } }
    };
    expect(assessCrossUserExposure("C1", key, snapshot, policy).overExposed).toBe(true);
    expect(assessCrossUserExposure("C2", key, snapshot, policy).overExposed).toBe(false);
  });

  it("ranks an over-exposed concept after others, but never removes it", () => {
    const questions = pool(12).map((entry) => ({ ...entry, difficultyLevel: 1 as const }));
    const strata: Record<string, { windowSize: number; conceptCounts: Record<string, number>; eligibleConcepts: number }> = {};
    const stratum = stratumKeyFor({
      population: "practice",
      envelopeId: OPEN.envelopeId,
      modality: "DIRECT_KNOWLEDGE",
      difficultyLevel: 1,
      jurisdictions: ["US"]
    });
    strata[stratum] = { windowSize: 500, conceptCounts: { "CONCEPT-1": 400 }, eligibleConcepts: 12 };

    const result = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      exposure: { scope: "SHARED", strata },
      random: createSeededRandom(2)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    // Still deliverable — 10 of 12 must be chosen — but ranked last of its class.
    const position = result.questions.findIndex((entry) => entry.variantGroup === "CONCEPT-1");
    expect(position === -1 || position >= 9).toBe(true);
  });
});

describe("the trace explains every choice", () => {
  it("records a reason for each delivered question", () => {
    const result = selectDelivery({
      pool: pool(20),
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      random: createSeededRandom(4)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.traces).toHaveLength(10);
    for (const trace of result.traces) {
      expect(trace.reasons.length).toBeGreaterThan(0);
      expect(trace.poolSize).toBe(20);
      expect(trace.stratumKey).toContain("training.free@1");
    }
  });

  it("justifies any pick that was not the freshest available", () => {
    // Invariant 10: taking a more-exposed item when a less-exposed one existed
    // must carry a reason.
    const questions = pool(12);
    const exposure: ExposureSnapshot = {
      scope: "LEARNER_ONLY",
      learner: {
        sessionsAgo: Object.fromEntries(questions.slice(0, 11).map((entry) => [entry.variantGroup!, 1])),
        lastSeenOn: Object.fromEntries(questions.slice(0, 11).map((entry) => [entry.variantGroup!, "2026-09-24"]))
      }
    };
    const result = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      exposure,
      random: createSeededRandom(9)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    for (const trace of result.traces) {
      if (trace.novelty === trace.bestNoveltyAvailable) continue;
      expect(trace.reasons.some((reason) => ["DIVERSITY", "ONLY_VALID_CANDIDATE", "REMEDIATION_REQUESTED"].includes(reason))).toBe(
        true
      );
    }
  });

  it("never claims global uniqueness, only that something is new to this learner", () => {
    const result = selectDelivery({
      pool: pool(20),
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      random: createSeededRandom(6)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    const serialised = JSON.stringify(result.traces).toLowerCase();
    for (const forbidden of ["unique", "never seen", "globally"]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

describe("adaptive difficulty", () => {
  it("is off by default and changes nothing", () => {
    expect(DEFAULT_DELIVERY_POLICY.adaptive.enabled).toBe(false);
    const questions = pool(30);
    const withHistory: ExposureSnapshot = {
      scope: "LEARNER_ONLY",
      learner: { sessionsAgo: {}, lastSeenOn: {}, bands: [{ difficulty: 1, attempts: 20, correct: 20 }] }
    };
    const off = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      exposure: withHistory,
      random: createSeededRandom(8)
    });
    const none = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope: OPEN,
      random: createSeededRandom(8)
    });
    expect(off.status).toBe("success");
    if (off.status !== "success" || none.status !== "success") return;
    expect(off.questions.map((entry) => entry.questionId)).toEqual(none.questions.map((entry) => entry.questionId));
  });

  it("stays inside the envelope when switched on", () => {
    const envelope = { ...OPEN, difficultyLevels: [1, 2] as const, adaptiveAllowed: true };
    const questions = pool(30).filter((entry) => entry.difficultyLevel <= 2);
    const result = selectDelivery({
      pool: questions,
      request: { count: 10, asOf: ASOF },
      envelope,
      exposure: {
        scope: "LEARNER_ONLY",
        learner: { sessionsAgo: {}, lastSeenOn: {}, bands: [{ difficulty: 2, attempts: 20, correct: 20 }] }
      },
      policy: { ...DEFAULT_DELIVERY_POLICY, adaptive: { ...DEFAULT_DELIVERY_POLICY.adaptive, enabled: true } },
      random: createSeededRandom(10)
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.questions.every((entry) => entry.difficultyLevel <= 2)).toBe(true);
  });
});

describe("determinism", () => {
  it("is reproducible for a seed and varies across seeds", () => {
    const questions = pool(30);
    const run = (seed: number) =>
      selectDelivery({ pool: questions, request: { count: 10, asOf: ASOF }, envelope: OPEN, random: createSeededRandom(seed) });
    const a = run(42);
    const b = run(42);
    const c = run(43);
    expect(a.status === "success" && b.status === "success" && c.status === "success").toBe(true);
    if (a.status !== "success" || b.status !== "success" || c.status !== "success") return;
    expect(b.questions.map((q) => q.questionId)).toEqual(a.questions.map((q) => q.questionId));
    expect(c.questions.map((q) => q.questionId)).not.toEqual(a.questions.map((q) => q.questionId));
  });
});
