import { z } from "zod";
import {
  CorpusPolicyShape,
  CorpusSourceMetadataShape,
  EvidenceLinkSchema,
  recordHeaderShape
} from "./schema.js";

/**
 * O9 — the first-class open-response task.
 *
 * **OWNER-DECIDED 2026-10-15:** contract B must support open-response items as a
 * distinct, first-class response type, and the free-text records must not be
 * forced into the multiple-choice family.
 *
 * **Why this is a separate schema rather than a flag on the item.** Contract B's
 * `AssessmentItemObjectSchema` extends the Training question bank, which
 * requires `choices` (min 2) and a `correctChoiceId`. A free-text task has
 * neither, and inventing them is exactly what O9 forbids. Relaxing those
 * requirements instead would weaken **D11/D12** for every multiple-choice
 * consumer in order to accommodate a type that is not one — so the open response
 * gets its own family, `TASK`, built on the same governance spine
 * (`recordHeaderShape`: identity, revision, lifecycle, review, verification,
 * provenance, applicability, competency refs, flags) and the same O6 policy and
 * O4 source-metadata shapes.
 *
 * It is `.strict()`, and that is the enforcement rather than a style choice: a
 * record carrying `choices`, `correctChoiceId`, `correctChoiceIds` or
 * `responseFormat` is **rejected**, so a choice-based record cannot masquerade
 * as a task and a task cannot quietly acquire choices later.
 */

/**
 * What kind of free-text work the task asks for.
 *
 * Taken from the `recordType` values the 114 authored free-text records actually
 * carry — 59 `DOCUMENTATION_TASK`, 24 `QUESTION`, 16 `WORKFLOW`, 15 `SCENARIO` —
 * rather than invented. A kind outside this set is a record this contract has
 * not been shown to represent.
 */
export const OPEN_RESPONSE_KINDS = [
  "DOCUMENTATION_TASK",
  "WORKFLOW",
  "SCENARIO",
  "QUESTION"
] as const;

export type OpenResponseKind = (typeof OPEN_RESPONSE_KINDS)[number];

/**
 * How an open response may be scored.
 *
 * **One value, deliberately.** O9 keeps automated scoring disabled unless a
 * validated rubric exists, and none does: the corpus carries
 * `acceptanceCriteria` with per-criterion `credit` weights, which is a rubric
 * *shape* that has never been validated as a scorer. Adding an `AUTOMATED`
 * member here before that validation would make the prohibition unenforceable,
 * so the enum has exactly one member and a second one has to be a deliberate,
 * reviewable change rather than an oversight.
 */
export const OPEN_RESPONSE_SCORING_MODES = ["HUMAN_REVIEW_REQUIRED"] as const;

export type OpenResponseScoringMode = (typeof OPEN_RESPONSE_SCORING_MODES)[number];

export const OpenResponseTaskSchema = z
  .object({
    ...recordHeaderShape,
    // O6: the seventeen carried policy and safety fields, all optional.
    ...CorpusPolicyShape,
    // O4: the archive's own difficulty band, preserved beside the level.
    ...CorpusSourceMetadataShape,
    family: z.literal("TASK"),
    kind: z.enum(OPEN_RESPONSE_KINDS),
    domain: z.string().min(1),
    /** The task as authored, carried verbatim. Never reworded by a migration. */
    prompt: z.string().min(1),
    /**
     * What the learner is expected to produce. **Required**, and it is what
     * makes this a task rather than a question with its choices missing.
     */
    expectedOutput: z.string().min(1),
    rationale: z.string().min(1).optional(),
    /**
     * Source citations, as every other family carries them.
     *
     * `.default([])` rather than `.min(1)`: the KNOWLEDGE family requires at
     * least one link, but demanding that here would force a citation to be
     * invented for a free-text record that genuinely has none, which O9
     * forbids. The CONCEPT family already takes this treatment, so this
     * follows an existing precedent rather than inventing a laxer rule — and
     * an unsourced task still cannot ship, because production eligibility
     * gates on review regardless.
     */
    evidence: z.array(EvidenceLinkSchema).default([]),
    /**
     * Always `HUMAN_REVIEW_REQUIRED`. Declared on the record rather than
     * inferred, so a consumer reading one record knows it cannot score it
     * without consulting a policy kept somewhere else.
     */
    scoringMode: z.literal("HUMAN_REVIEW_REQUIRED").default("HUMAN_REVIEW_REQUIRED")
  })
  .strict();

export type OpenResponseTask = z.infer<typeof OpenResponseTaskSchema>;

/** The keys a choice-based record carries and a task must never have. */
export const CHOICE_ONLY_KEYS = [
  "choices",
  "correctChoiceId",
  "correctChoiceIds",
  "responseFormat"
] as const;

/** True for a task-shaped record. Used by the scoring guard at runtime. */
export function isOpenResponseTask(record: unknown): record is OpenResponseTask {
  return (
    typeof record === "object" &&
    record !== null &&
    (record as { family?: unknown }).family === "TASK"
  );
}

/**
 * Why an open-response task may not be delivered to production, or `[]`.
 *
 * The first four predicates are the **same** ones `isCorpusProductionEligible`
 * applies to every other family — lifecycle, review, the human-verify flag,
 * applicability — reused deliberately rather than restated, so a task cannot
 * reach production through a laxer gate than a question does. O9's requirement
 * that an unreviewed open response is not production-eligible is therefore
 * enforced by the repository's existing policy, not by a new one beside it.
 *
 * The fifth is specific to this family: a task whose scoring mode is not
 * `HUMAN_REVIEW_REQUIRED` is malformed, and shipping it would imply a scorer
 * exists.
 */
export function openResponseProductionBlockers(task: OpenResponseTask): string[] {
  const reasons: string[] = [];
  const where = task.id;

  if (task.contentStatus !== "production-eligible") {
    reasons.push(`${where}: contentStatus is "${task.contentStatus}", not "production-eligible"`);
  }
  if (task.reviewStatus !== "approved") {
    reasons.push(`${where}: reviewStatus is "${task.reviewStatus}", not "approved"`);
  }
  if (task.flags.includes("HUMAN-VERIFY-REQUIRED")) {
    reasons.push(`${where}: still carries HUMAN-VERIFY-REQUIRED`);
  }
  if (!task.applicability) {
    reasons.push(`${where}: declares no applicability`);
  }
  if (task.scoringMode !== "HUMAN_REVIEW_REQUIRED") {
    reasons.push(`${where}: scoringMode is "${task.scoringMode}", and no validated rubric exists`);
  }

  return reasons;
}

/** Convenience: a task is deliverable only when nothing blocks it. */
export function mayDeliverOpenResponseTask(task: OpenResponseTask): boolean {
  return openResponseProductionBlockers(task).length === 0;
}
