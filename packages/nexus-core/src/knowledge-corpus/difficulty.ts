/**
 * O4 — the archive's five difficulty bands against contract B's six levels.
 *
 * **Decided 2026-10-15, OWNER-DECIDED:** the original band stays authoritative
 * source metadata, and no unsupported equivalence between five bands and six
 * numeric levels may be invented. This module is that decision in code.
 *
 * **Where the evidence comes from.** `knowledge-corpus/registries/difficulty.json`
 * is owner-supplied (charter §X) and gives each band a `repositoryLevelHint`. Its
 * own note is the reason this module exists rather than a one-line lookup:
 *
 * > The repository Question Bank carries a separate 6-level authoring difficulty
 * > (1 Foundation .. 6 Master). These five bands are the archive's model and are
 * > NOT that scale.
 *
 * So the hint is evidence about a band, not a definition of it. A band whose hint
 * names **exactly one** level is taken as evidence-backed: the owner-supplied
 * registry points at one target and nothing else competes. A band whose hint
 * names **more than one** is `AMBIGUOUS` and is left unresolved, because
 * choosing between two hinted levels would be the invention O4 forbids. `EASY`
 * is that case, and it is 63 of the 432 authored records.
 *
 * **The band is never replaced by the level.** Both travel together; a consumer
 * that wants the archive's model reads the band, and one that needs the numeric
 * scale reads the level and must handle its absence.
 */

/** The archive's five bands, in the registry's ordinal order. */
export const CORPUS_DIFFICULTY_BANDS = [
  "EASY",
  "MODERATE",
  "HARD",
  "VERY_HARD",
  "REALISTIC_PREMIUM"
] as const;

export type CorpusDifficultyBand = (typeof CORPUS_DIFFICULTY_BANDS)[number];

// Contract B's authoring scale, 1 Foundation .. 6 Master. Imported rather than
// redeclared: the question bank already owns this type, and a second
// declaration is how two scales start drifting apart.
import type { QuestionDifficultyLevel } from "../question-bank/schema.js";

/**
 * Why a band does or does not yield a numeric level.
 *
 * The four outcomes are kept distinct because O4 requires migration and
 * validation to tell them apart, and because collapsing them is how an absent
 * value starts looking like a decided one:
 *
 * - `VERIFIED`     the registry hints exactly one level.
 * - `AMBIGUOUS`    the registry hints more than one; the choice is not ours.
 * - `ABSENT`       the record carries no band at all.
 * - `INVALID_BAND` the record carries a band the registry does not define.
 */
export type DifficultyCrosswalkStatus = "VERIFIED" | "AMBIGUOUS" | "ABSENT" | "INVALID_BAND";

export interface DifficultyCrosswalkResult {
  status: DifficultyCrosswalkStatus;
  band: string | null;
  /** Only ever set when `status` is `VERIFIED`. Null otherwise, never guessed. */
  level: QuestionDifficultyLevel | null;
  /** The registry's hint, carried so a reviewer can see what was weighed. */
  hint: readonly number[] | null;
  reason: string;
}

/**
 * The registry's hints, transcribed from `registries/difficulty.json` v1.0.0.
 *
 * Transcribed rather than imported because `nexus-core` declares no build and
 * must not read repository files at runtime. `difficulty.test.ts` asserts this
 * table against the registry on disk, so a registry change fails the suite
 * instead of silently disagreeing with it.
 */
export const BAND_LEVEL_HINTS: Readonly<Record<CorpusDifficultyBand, readonly number[]>> = {
  EASY: [1, 2],
  MODERATE: [3],
  HARD: [4],
  VERY_HARD: [5],
  REALISTIC_PREMIUM: [6]
};

function isBand(value: unknown): value is CorpusDifficultyBand {
  return typeof value === "string" && (CORPUS_DIFFICULTY_BANDS as readonly string[]).includes(value);
}

/**
 * Resolve a source band to a numeric level, or say why it cannot be.
 *
 * This is the only place a band becomes a number. A second one would be a
 * second policy.
 */
export function crosswalkDifficulty(band: unknown): DifficultyCrosswalkResult {
  if (band === undefined || band === null || band === "") {
    return {
      status: "ABSENT",
      band: null,
      level: null,
      hint: null,
      reason: "the record carries no difficulty band"
    };
  }

  if (!isBand(band)) {
    return {
      status: "INVALID_BAND",
      band: String(band),
      level: null,
      hint: null,
      reason: `"${String(band)}" is not one of the five bands the registry defines`
    };
  }

  const hint = BAND_LEVEL_HINTS[band];

  if (hint.length === 1) {
    return {
      status: "VERIFIED",
      band,
      level: hint[0] as QuestionDifficultyLevel,
      hint,
      reason: `the registry hints exactly one level (${hint[0]}) for ${band}`
    };
  }

  return {
    status: "AMBIGUOUS",
    band,
    level: null,
    hint,
    reason:
      `the registry hints ${hint.length} levels (${hint.join(", ")}) for ${band}, ` +
      "so the evidence does not single one out and O4 forbids choosing"
  };
}

/** True when a record may enter a path that requires a numeric level. */
export function hasVerifiedDifficultyLevel(band: unknown): boolean {
  return crosswalkDifficulty(band).status === "VERIFIED";
}

/** The bands that cannot currently be given a level, for an authoring queue. */
export function unresolvableBands(): CorpusDifficultyBand[] {
  return CORPUS_DIFFICULTY_BANDS.filter((b) => crosswalkDifficulty(b).status !== "VERIFIED");
}
