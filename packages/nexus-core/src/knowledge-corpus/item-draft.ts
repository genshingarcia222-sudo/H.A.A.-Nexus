import { z } from "zod";
import {
  CorpusPolicyShape,
  CorpusSourceMetadataShape,
  EvidenceLinkSchema,
  recordHeaderShape
} from "./schema.js";
import { QuestionChoiceSchema } from "../question-bank/schema.js";

/**
 * The draft/production boundary for the ITEM family.
 *
 * **Why a new representation rather than a status.** The repository's lifecycle
 * — `candidate → source-verified → content-reviewed → approved →
 * production-eligible` — expresses how far *review* has got. It does not
 * express structural incompleteness, and the two are not the same thing: the
 * 318 choice-based authored records are missing `skillArea`,
 * `learningObjective`, `questionType` and `source`, which
 * `AssessmentItemObjectSchema` **requires**. Such a record does not parse as an
 * ITEM at any `contentStatus`. Setting it to `candidate` would not make it
 * representable; it would only make the failure quieter.
 *
 * So the alternatives were: relax the ITEM schema (rejected — it would weaken
 * D11/D12 for every multiple-choice consumer, which the migration invariants
 * forbid outright), invent the four fields (rejected — fabrication), or give
 * the incomplete records their own representation. This is the third.
 *
 * **What makes it safe.** An `ITEM_DRAFT` is a different family from `ITEM`, so
 * nothing that consumes items can receive one by accident; it is `.strict()`;
 * and `unresolved` is **non-empty by construction**, so a draft always carries
 * the list of production requirements it has not met. A draft with nothing
 * unresolved is not a draft — it is an item, and the schema says so by
 * rejecting it.
 */

/**
 * The production requirements an ITEM draft can be missing.
 *
 * Deliberately a closed enum rather than free text: an unresolved field has to
 * be nameable against the ITEM contract, so a typo or an invented requirement
 * is a validation error instead of a silent entry in a list nobody checks.
 */
export const ITEM_PRODUCTION_REQUIREMENTS = [
  "skillArea",
  "learningObjective",
  "questionType",
  "source",
  "difficultyLevel",
  "modality"
] as const;

export type ItemProductionRequirement = (typeof ITEM_PRODUCTION_REQUIREMENTS)[number];

/**
 * A choice as the authored corpus writes one.
 *
 * `QuestionChoiceSchema` is `.strict()` with `id`, `text` and `why`, and the
 * authored choices carry one more field: `trapType`, naming which trap a
 * distractor implements — present on 954 of the 1,287 choice objects, absent on
 * the correct answers.
 *
 * Extended **here only**, not in the question bank. Dropping it would discard
 * real pedagogical data from every distractor, which the migration rules
 * forbid; extending the shared `QuestionChoiceSchema` would change a D11/D12
 * contract for every multiple-choice consumer in order to serve a staging
 * representation. So the extension is contained to the draft family, and the
 * production item contract is untouched.
 */
export const DraftChoiceSchema = QuestionChoiceSchema.extend({
  trapType: z.string().min(1).optional()
}).strict();

export const ItemDraftSchema = z
  .object({
    ...recordHeaderShape,
    // O6: the seventeen carried policy and safety fields, all optional.
    ...CorpusPolicyShape,
    // O4: the archive's own difficulty band, preserved beside the level.
    ...CorpusSourceMetadataShape,
    family: z.literal("ITEM_DRAFT"),
    domain: z.string().min(1),
    /** The stem as authored, carried verbatim. */
    question: z.string().min(1),
    /** Real authored choices. A draft never invents or pads them. */
    choices: z.array(DraftChoiceSchema).min(2),
    correctChoiceId: z.string().min(1),
    /** O5: the full set, for a genuinely multi-select draft. */
    correctChoiceIds: z.array(z.string().min(1)).min(2).optional(),
    rationale: z.string().min(1),
    evidence: z.array(EvidenceLinkSchema).default([]),
    /**
     * O4's numeric level, when the registry justified one.
     *
     * Optional because the two cases are genuinely different and must stay
     * distinguishable: 276 of the 318 drafts have an evidence-backed level and
     * carry it here, while the 42 EASY-band records have none and declare
     * `difficultyLevel` in `unresolved` instead. Dropping the verified level
     * would discard real evidence; defaulting the missing one would invent it.
     */
    difficultyLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(),
    /**
     * Which ITEM production requirements this record has not met.
     *
     * **Non-empty by construction.** This is the field that keeps the boundary
     * honest: a draft states what is missing rather than leaving a reader to
     * discover it, and nothing can become an item while this list has entries.
     */
    unresolved: z.array(z.enum(ITEM_PRODUCTION_REQUIREMENTS)).min(1)
  })
  .strict()
  .superRefine((draft, ctx) => {
    // The same answer-integrity rules the item contract applies, because a
    // draft's answer is real data and a broken one is a defect now, not later.
    const ids = new Set(draft.choices.map((c) => c.id));
    if (ids.size !== draft.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["choices"],
        message: "duplicate choice ids would make the answer ambiguous"
      });
    }
    if (!ids.has(draft.correctChoiceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctChoiceId"],
        message: `correctChoiceId "${draft.correctChoiceId}" does not match any choice id`
      });
    }
    if (draft.correctChoiceIds) {
      for (const id of draft.correctChoiceIds) {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["correctChoiceIds"],
            message: `correctChoiceIds contains "${id}", which is not a choice id`
          });
        }
      }
      if (!draft.correctChoiceIds.includes(draft.correctChoiceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["correctChoiceId"],
          message: "correctChoiceId must be one of correctChoiceIds"
        });
      }
    }
    if (new Set(draft.unresolved).size !== draft.unresolved.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unresolved"],
        message: "unresolved repeats a requirement"
      });
    }
  });

export type ItemDraft = z.infer<typeof ItemDraftSchema>;

/** True for a draft-shaped record, for a runtime consumer guard. */
export function isItemDraft(record: unknown): record is ItemDraft {
  return (
    typeof record === "object" &&
    record !== null &&
    (record as { family?: unknown }).family === "ITEM_DRAFT"
  );
}

/**
 * Why a draft cannot be promoted to a production ITEM, or `[]`.
 *
 * Promotion is **not** a transformation this module performs. It reports what
 * stands in the way, and every unresolved requirement is one of them — so a
 * draft can only become an item once the authoring work that supplies those
 * fields has actually happened, and then by passing the ITEM schema itself
 * rather than by a flag being flipped here.
 *
 * Review state is included because structural completeness is not approval:
 * resolving all four fields makes a record *representable*, not *reviewed*.
 */
export function itemDraftPromotionBlockers(draft: ItemDraft): string[] {
  const reasons: string[] = [];
  const where = draft.id;

  for (const requirement of draft.unresolved) {
    reasons.push(`${where}: ${requirement} is unresolved and the ITEM contract requires it`);
  }
  if (draft.reviewStatus !== "approved") {
    reasons.push(`${where}: reviewStatus is "${draft.reviewStatus}", not "approved"`);
  }
  if (draft.flags.includes("HUMAN-VERIFY-REQUIRED")) {
    reasons.push(`${where}: still carries HUMAN-VERIFY-REQUIRED`);
  }

  return reasons;
}

/** A draft is never production-eligible while anything is unresolved. */
export function mayPromoteItemDraft(draft: ItemDraft): boolean {
  return itemDraftPromotionBlockers(draft).length === 0;
}
