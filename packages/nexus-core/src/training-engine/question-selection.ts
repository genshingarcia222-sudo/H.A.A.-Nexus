import type { QuestionBankRepository } from "../question-bank/repository.js";
import type { QuestionDifficultyLevel, TrainingQuestion } from "../question-bank/schema.js";

/**
 * Training question selection — which questions *this run* receives.
 *
 * This lives in `training-engine`, not in `question-bank`, on purpose. The bank
 * answers *what valid questions exist*; the selector answers *what this
 * Training run should get*. Collapsing the two would make the content model
 * responsible for runtime policy, and a later Learning Assessment — which will
 * want different rules — would then inherit Training's.
 *
 * The boundaries this module deliberately does not cross:
 *
 * - **Entitlement.** It never asks who the learner is or what tier they hold.
 *   `difficultyLevel` is content metadata and is not mapped to a tier here or
 *   anywhere else.
 * - **Persistence.** It stores nothing and remembers nothing between calls.
 *   `excludeQuestionIds` is a caller-supplied list, not a history: where seen
 *   items live, how long they last and whether they sync are separate,
 *   unanswered decisions.
 * - **Scoring.** It reads questions and returns questions. It records no
 *   answer and computes no result.
 *
 * `question-selection.boundary.test.ts` enforces all three by scanning this
 * file's imports, so the separation cannot erode by accident.
 */

/** The default Training run length. */
export const DEFAULT_TRAINING_RUN_SIZE = 10;

/**
 * A source of randomness in `[0, 1)`.
 *
 * Injected rather than reached for, so a selection is reproducible: the same
 * request against the same pool with the same source produces the same run,
 * every time. Uncontrolled `Math.random()` scattered through a selector makes
 * "why did the learner get these ten?" unanswerable.
 */
export type RandomSource = () => number;

/**
 * A deterministic `RandomSource` (mulberry32).
 *
 * Small, dependency-free and well-distributed enough for shuffling a question
 * pool. It is for reproducibility, not for cryptography, and nothing security-
 * related should use it.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TrainingSelectionRequest {
  /** How many questions this run wants. Defaults to `DEFAULT_TRAINING_RUN_SIZE`. */
  count?: number;
  /** Restrict to these difficulty levels. Omitted means any. */
  difficultyLevels?: QuestionDifficultyLevel[];
  /** Restrict to these domains. Omitted means any. */
  domains?: string[];
  /** Restrict to these skill areas. Omitted means any. */
  skillAreas?: string[];
  /**
   * Question ids this run must not include.
   *
   * A product-neutral seam for a future replay/anti-memorisation feature. The
   * caller supplies the list; this module neither produces nor stores it, and
   * takes no position on where such a history should live.
   */
  excludeQuestionIds?: string[];
}

export type TrainingSelectionResult =
  | { status: "success"; questions: TrainingQuestion[] }
  | {
      /** The eligible pool, after filtering, was smaller than the run needs. */
      status: "insufficient-eligible-content";
      requested: number;
      available: number;
    }
  | { status: "invalid-request"; errors: string[] };

export interface TrainingQuestionSelector {
  select(request?: TrainingSelectionRequest): TrainingSelectionResult;
}

const VALID_DIFFICULTIES: readonly number[] = [1, 2, 3, 4, 5, 6];

function validate(request: TrainingSelectionRequest, count: number): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(count) || count < 1) {
    errors.push(`count must be a positive integer, got ${JSON.stringify(request.count)}`);
  }

  if (request.difficultyLevels !== undefined) {
    if (request.difficultyLevels.length === 0) {
      errors.push("difficultyLevels, when given, must list at least one level");
    }
    for (const level of request.difficultyLevels) {
      if (!VALID_DIFFICULTIES.includes(level)) {
        // An unavailable difficulty is refused rather than quietly swapped for
        // a neighbouring one: a learner who asked for level 3 and silently got
        // level 2 has been told something untrue about their practice.
        errors.push(`difficultyLevel ${JSON.stringify(level)} is outside the 1-6 scale`);
      }
    }
  }

  for (const [field, values] of [
    ["domains", request.domains],
    ["skillAreas", request.skillAreas],
    ["excludeQuestionIds", request.excludeQuestionIds]
  ] as const) {
    if (values === undefined) continue;
    if (field !== "excludeQuestionIds" && values.length === 0) {
      errors.push(`${field}, when given, must list at least one value`);
    }
    for (const value of values) {
      if (typeof value !== "string" || value.length === 0) {
        errors.push(`${field} must contain only non-empty strings`);
      }
    }
  }

  return errors;
}

/** Fisher-Yates, driven entirely by the injected source. */
function shuffle<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * How much a question would concentrate the run on what is already in it.
 *
 * Weighted so that the most redundant repetition costs most. `variantGroup`
 * exists precisely to mark near-identical questions, so two from one group is
 * the worst outcome; a shared domain is barely a problem at all.
 *
 * Undefined metadata contributes nothing — questions with no variant group are
 * not treated as all belonging to one.
 */
const DIVERSITY_WEIGHTS: readonly [keyof TrainingQuestion, number][] = [
  ["variantGroup", 8],
  ["learningObjective", 4],
  ["skillArea", 2],
  ["questionType", 1],
  ["domain", 1]
];

function concentrationCost(question: TrainingQuestion, chosen: TrainingQuestion[]): number {
  let cost = 0;
  for (const [field, weight] of DIVERSITY_WEIGHTS) {
    const value = question[field];
    if (value === undefined) continue;
    for (const already of chosen) {
      if (already[field] === value) cost += weight;
    }
  }
  return cost;
}

/**
 * Picks `count` questions, preferring the least concentrated at each step.
 *
 * Greedy and deterministic: the shuffled order decides ties, so the same
 * shuffle always yields the same run. Diversity is a **strong preference, not a
 * hard constraint** — with a narrow pool the run is still filled rather than
 * failed. Making `variantGroup` a hard constraint would turn a content-shape
 * problem into an insufficiency error, and where that line sits is a product
 * question, not one to settle here.
 */
function pickDiverse(pool: TrainingQuestion[], count: number): TrainingQuestion[] {
  const remaining = [...pool];
  const chosen: TrainingQuestion[] = [];

  while (chosen.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (candidate === undefined) continue;
      const cost = concentrationCost(candidate, chosen);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
        if (cost === 0) break; // nothing can beat an uncontested pick
      }
    }

    const [picked] = remaining.splice(bestIndex, 1);
    if (picked !== undefined) chosen.push(picked);
  }

  return chosen;
}

/**
 * Selects the questions for one Training run.
 *
 * The pool comes from `repository.getProductionEligible()` — the bank's own
 * gate — so candidate and unverified content can never reach a learner through
 * here. This module does not re-derive eligibility; there is one definition of
 * it and it lives with the content.
 *
 * A pool too small for the run is reported as such. It is never padded by
 * repeating a question, and the requested difficulty is never quietly widened
 * to find more: a short run the learner can see is honest, a silently altered
 * one is not.
 */
export function selectTrainingQuestions(
  repository: QuestionBankRepository,
  request: TrainingSelectionRequest = {},
  random: RandomSource = Math.random
): TrainingSelectionResult {
  const count = request.count ?? DEFAULT_TRAINING_RUN_SIZE;

  const errors = validate(request, count);
  if (errors.length > 0) return { status: "invalid-request", errors };

  const excluded = new Set(request.excludeQuestionIds ?? []);
  const difficulties = request.difficultyLevels ? new Set<number>(request.difficultyLevels) : undefined;
  const domains = request.domains ? new Set(request.domains) : undefined;
  const skillAreas = request.skillAreas ? new Set(request.skillAreas) : undefined;

  const pool = repository.getProductionEligible().filter((question) => {
    if (excluded.has(question.questionId)) return false;
    if (difficulties && !difficulties.has(question.difficultyLevel)) return false;
    if (domains && !domains.has(question.domain)) return false;
    if (skillAreas && !skillAreas.has(question.skillArea)) return false;
    return true;
  });

  if (pool.length < count) {
    return { status: "insufficient-eligible-content", requested: count, available: pool.length };
  }

  return { status: "success", questions: pickDiverse(shuffle(pool, random), count) };
}

/** Binds a repository and a randomness source to the selector. */
export function createTrainingQuestionSelector(
  repository: QuestionBankRepository,
  random: RandomSource = Math.random
): TrainingQuestionSelector {
  return {
    select: (request: TrainingSelectionRequest = {}) => selectTrainingQuestions(repository, request, random)
  };
}
