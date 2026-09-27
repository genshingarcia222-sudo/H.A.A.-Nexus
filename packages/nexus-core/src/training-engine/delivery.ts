import type { QuestionDifficultyLevel, TrainingQuestion } from "../question-bank/schema.js";
import { DEFAULT_TRAINING_RUN_SIZE, concentrationCost, shuffle } from "./question-selection.js";
import type { RandomSource } from "./question-selection.js";
import { envelopeAllows } from "../entitlement-engine/training-envelopes.js";
import type { TierEnvelope } from "../entitlement-engine/training-envelopes.js";
import {
  DEFAULT_DELIVERY_POLICY,
  EMPTY_EXPOSURE,
  NOVELTY_RANK,
  assessCrossUserExposure,
  noveltyClassFor,
  stratumKeyFor
} from "./exposure.js";
import type { DeliveryPolicy, ExposureSnapshot, NoveltyClass, SelectionReason } from "./exposure.js";

/**
 * The delivery layer: which questions *this* session receives (D12-35).
 *
 * It **composes** the existing selector rather than replacing it. The proven
 * pieces — the injected `RandomSource`, Fisher-Yates, and the diversity cost
 * with its weights — are imported and used unchanged, and the module lives
 * beside `question-selection.ts` rather than inside it so that file keeps its
 * boundary test: the selector still imports nothing but the question bank.
 *
 * The rule that makes this safe to adopt: **with an empty exposure snapshot,
 * adaptive off and an open envelope, delivery produces exactly what the
 * existing selector produces for the same seed.** Every new key component is
 * constant in that case, so the ordering collapses to today's. It is asserted
 * over many seeds rather than assumed.
 *
 * Boundaries this module keeps:
 *
 * - it never reads a store — exposure arrives as a snapshot;
 * - it never resolves a tier — the caller hands in the envelope;
 * - it records nothing — a `DeliveryTrace` is returned, and storing it is the
 *   ledger's job;
 * - it decides nothing about who may buy what. An envelope is data.
 */

export interface DeliveryRequestOptions {
  count?: number;
  difficultyLevels?: QuestionDifficultyLevel[];
  domains?: string[];
  skillAreas?: string[];
  modalities?: string[];
  collections?: string[];
  /** Questions this run must not include — the caller's list, not a history. */
  excludeQuestionIds?: string[];
  /** Concepts a caller deliberately wants repeated, e.g. remediation. */
  intentionalRepeats?: string[];
  /** The date the decision is made against; never read from a clock here. */
  asOf: string;
  population?: string;
  jurisdictions?: string[];
}

export interface DeliveryTrace {
  questionId: string;
  conceptId?: string | undefined;
  novelty: NoveltyClass;
  /** The best novelty available at this slot, for invariant 10. */
  bestNoveltyAvailable: NoveltyClass;
  crossUserOverExposed: boolean;
  crossUserShare?: number | undefined;
  diversityCost: number;
  poolSize: number;
  stratumKey: string;
  reasons: SelectionReason[];
}

export type DeliveryResult =
  | { status: "success"; questions: TrainingQuestion[]; traces: DeliveryTrace[] }
  | { status: "insufficient-eligible-content"; requested: number; available: number }
  | { status: "invalid-request"; errors: string[] };

export interface DeliveryInputs {
  /** Deliverable questions. Eligibility was decided before this point. */
  pool: TrainingQuestion[];
  request: DeliveryRequestOptions;
  envelope: TierEnvelope;
  exposure?: ExposureSnapshot;
  policy?: DeliveryPolicy;
  random?: RandomSource;
  /** How a question's modality is read, so this module needs no corpus import. */
  modalityOf?: (question: TrainingQuestion) => string;
}

const conceptOf = (question: TrainingQuestion): string | undefined => question.variantGroup;

/**
 * Selects one session's questions.
 *
 * Hard filters never relax. A request outside its envelope is refused rather
 * than quietly narrowed, and a pool too small is reported rather than padded —
 * both inherited from the selector, where a silently altered run was judged
 * worse than a visibly short one.
 */
export function selectDelivery(inputs: DeliveryInputs): DeliveryResult {
  const { pool, request, envelope } = inputs;
  const exposure = inputs.exposure ?? EMPTY_EXPOSURE;
  const policy = inputs.policy ?? DEFAULT_DELIVERY_POLICY;
  const random = inputs.random ?? Math.random;
  const modalityOf = inputs.modalityOf ?? (() => "DIRECT_KNOWLEDGE");
  const count = request.count ?? envelope.sessionSize.default ?? DEFAULT_TRAINING_RUN_SIZE;

  const errors = validate(request, envelope, count);
  if (errors.length > 0) return { status: "invalid-request", errors };

  const excluded = new Set(request.excludeQuestionIds ?? []);
  const difficulties = request.difficultyLevels ? new Set<number>(request.difficultyLevels) : undefined;
  const domains = request.domains ? new Set(request.domains) : undefined;
  const skillAreas = request.skillAreas ? new Set(request.skillAreas) : undefined;
  const modalities = request.modalities ? new Set(request.modalities) : undefined;

  const filtered = pool.filter((question) => {
    if (excluded.has(question.questionId)) return false;
    if (difficulties && !difficulties.has(question.difficultyLevel)) return false;
    if (domains && !domains.has(question.domain)) return false;
    if (skillAreas && !skillAreas.has(question.skillArea)) return false;
    if (modalities && !modalities.has(modalityOf(question))) return false;
    if (!envelope.difficultyLevels.includes(question.difficultyLevel)) return false;
    if (!envelopeAllows(envelope.modalities, modalityOf(question))) return false;
    if (!envelopeAllows(envelope.domains, question.domain)) return false;
    return true;
  });

  if (filtered.length < count) {
    return { status: "insufficient-eligible-content", requested: count, available: filtered.length };
  }

  const shuffled = shuffle(filtered, random);
  const chosen: TrainingQuestion[] = [];
  const traces: DeliveryTrace[] = [];
  const remaining = [...shuffled];
  const intentional = new Set(request.intentionalRepeats ?? []);
  const adaptiveTarget = targetDifficulty(exposure, policy, envelope);

  while (chosen.length < count && remaining.length > 0) {
    const scored = remaining.map((question, index) => {
      const conceptId = conceptOf(question);
      const novelty = chosen.some((already) => conceptOf(already) && conceptOf(already) === conceptId)
        ? "SAME_SESSION"
        : noveltyClassFor(conceptId, exposure, policy.repetition, request.asOf);
      const stratumKey = stratumKeyFor({
        population: request.population ?? "practice",
        envelopeId: envelope.envelopeId,
        modality: modalityOf(question),
        difficultyLevel: question.difficultyLevel,
        jurisdictions: request.jurisdictions ?? ["US"]
      });
      const crossUser = assessCrossUserExposure(conceptId, stratumKey, exposure, policy.repetition);
      const diversityCost = concentrationCost(question, chosen);
      const adaptiveDistance =
        policy.adaptive.enabled && envelope.adaptiveAllowed && adaptiveTarget !== undefined
          ? Math.abs(question.difficultyLevel - adaptiveTarget)
          : 0;

      return { question, index, conceptId, novelty, crossUser, diversityCost, adaptiveDistance, stratumKey };
    });

    // A concept the caller asked to repeat is treated as unseen for ranking:
    // it was requested, so ranking it last would defeat the request.
    const keyed = scored.map((candidate) => ({
      ...candidate,
      noveltyRank:
        candidate.conceptId && intentional.has(candidate.conceptId)
          ? NOVELTY_RANK.UNSEEN
          : NOVELTY_RANK[candidate.novelty]
    }));

    let best = keyed[0]!;
    for (const candidate of keyed) {
      if (compareKeys(candidate, best) < 0) best = candidate;
    }

    const bestNoveltyAvailable = keyed.reduce<NoveltyClass>(
      (lowest, candidate) => (NOVELTY_RANK[candidate.novelty] < NOVELTY_RANK[lowest] ? candidate.novelty : lowest),
      "SAME_SESSION"
    );

    remaining.splice(best.index, 1);
    chosen.push(best.question);
    traces.push({
      questionId: best.question.questionId,
      conceptId: best.conceptId,
      novelty: best.novelty,
      bestNoveltyAvailable,
      crossUserOverExposed: best.crossUser.overExposed,
      crossUserShare: best.crossUser.share,
      diversityCost: best.diversityCost,
      poolSize: filtered.length,
      stratumKey: best.stratumKey,
      reasons: reasonsFor(best, bestNoveltyAvailable, intentional, policy)
    });
  }

  return { status: "success", questions: chosen, traces };
}

interface Keyed {
  noveltyRank: number;
  crossUser: { overExposed: boolean };
  adaptiveDistance: number;
  diversityCost: number;
  index: number;
}

/**
 * The lexicographic preference order.
 *
 * A learner's own novelty outranks cross-learner balance: being asked
 * something you just answered is a worse experience than a concept being
 * slightly over-represented across a cohort. Diversity and the shuffle sit
 * last, which is exactly where the existing selector has them.
 */
function compareKeys(a: Keyed, b: Keyed): number {
  if (a.noveltyRank !== b.noveltyRank) return a.noveltyRank - b.noveltyRank;
  const overA = a.crossUser.overExposed ? 1 : 0;
  const overB = b.crossUser.overExposed ? 1 : 0;
  if (overA !== overB) return overA - overB;
  if (a.adaptiveDistance !== b.adaptiveDistance) return a.adaptiveDistance - b.adaptiveDistance;
  if (a.diversityCost !== b.diversityCost) return a.diversityCost - b.diversityCost;
  return a.index - b.index;
}

function reasonsFor(
  best: {
    novelty: NoveltyClass;
    conceptId?: string | undefined;
    crossUser: { overExposed: boolean; reason?: SelectionReason };
    diversityCost: number;
  },
  bestNoveltyAvailable: NoveltyClass,
  intentional: Set<string>,
  policy: DeliveryPolicy
): SelectionReason[] {
  const reasons: SelectionReason[] = [];

  if (best.conceptId && intentional.has(best.conceptId)) reasons.push("REMEDIATION_REQUESTED");
  if (best.novelty === "UNSEEN") reasons.push("UNSEEN");
  else if (best.novelty === "STALE") reasons.push("LEAST_RECENTLY_SEEN");
  else reasons.push("REPEAT_ALLOWED");

  // Invariant 10: if something less-exposed was available and was not taken,
  // the trace must say why.
  if (NOVELTY_RANK[best.novelty] > NOVELTY_RANK[bestNoveltyAvailable] && !reasons.includes("REMEDIATION_REQUESTED")) {
    reasons.push(best.diversityCost > 0 ? "DIVERSITY" : "ONLY_VALID_CANDIDATE");
  }

  if (best.crossUser.reason) reasons.push(best.crossUser.reason);
  if (policy.adaptive.enabled) reasons.push("ADAPTIVE_TARGET");

  return reasons;
}

/** The difficulty adaptive delivery is aiming at, or undefined when it cannot tell. */
function targetDifficulty(
  exposure: ExposureSnapshot,
  policy: DeliveryPolicy,
  envelope: TierEnvelope
): number | undefined {
  if (!policy.adaptive.enabled) return undefined;
  const bands = exposure.learner?.bands ?? [];
  if (bands.length === 0) return undefined;

  const attempted = bands.filter((band) => band.attempts >= policy.adaptive.minimumAttempts);
  if (attempted.length === 0) return undefined;

  const highest = attempted.reduce((best, band) => (band.difficulty > best.difficulty ? band : best), attempted[0]!);
  const accuracy = highest.correct / highest.attempts;
  const levels = [...envelope.difficultyLevels].sort((a, b) => a - b);
  const index = levels.indexOf(highest.difficulty as (typeof levels)[number]);
  if (index === -1) return highest.difficulty;

  if (accuracy >= policy.adaptive.promoteAtAccuracy) return levels[Math.min(index + 1, levels.length - 1)];
  if (accuracy < policy.adaptive.demoteBelowAccuracy) return levels[Math.max(index - 1, 0)];
  return highest.difficulty;
}

function validate(request: DeliveryRequestOptions, envelope: TierEnvelope, count: number): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(count) || count < 1) {
    errors.push(`count must be a positive integer, got ${JSON.stringify(request.count)}`);
  }
  if (count < envelope.sessionSize.min || count > envelope.sessionSize.max) {
    errors.push(
      `count ${count} is outside this tier's session size (${envelope.sessionSize.min}-${envelope.sessionSize.max})`
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.asOf)) {
    errors.push(`asOf must be an ISO date, got ${JSON.stringify(request.asOf)}`);
  }
  for (const level of request.difficultyLevels ?? []) {
    // Refused, never silently swapped for a neighbouring level: a learner who
    // asked for level 3 and got level 2 has been told something untrue.
    if (!envelope.difficultyLevels.includes(level)) {
      errors.push(`difficultyLevel ${level} is outside this tier's envelope`);
    }
  }
  for (const modality of request.modalities ?? []) {
    if (!envelopeAllows(envelope.modalities, modality)) {
      errors.push(`modality ${modality} is outside this tier's envelope`);
    }
  }
  for (const domain of request.domains ?? []) {
    if (!envelopeAllows(envelope.domains, domain)) {
      errors.push(`domain ${domain} is outside this tier's envelope`);
    }
  }
  for (const collection of request.collections ?? []) {
    if (!envelopeAllows(envelope.collections, collection)) {
      errors.push(`collection ${collection} is outside this tier's envelope`);
    }
  }

  return errors;
}
