import { z } from "zod";

/**
 * The canonical Training Question Bank.
 *
 * Owner decision (2026-09-19): **Option B — a separate, reusable Training
 * Question Bank** in which each question is its own record, independent of any
 * lesson. `docs/TRAINING_QUESTION_BANK.md` records the architecture;
 * `docs/DECISION_REGISTER.md` D11 records the decision itself.
 *
 * This module defines the *content contract* only. It deliberately contains no
 * selector, no randomisation, no seen-item tracking, no run concept and no
 * entitlement mapping — those are separate, still-unanswered decisions, and a
 * field added here in anticipation of one would encode an answer nobody has
 * given. `difficultyLevel` is an authoring signal about the question; it is
 * **not** a tier, and nothing in this file maps it to one.
 *
 * `TrainingLesson.knowledgeChecks[]` is untouched and keeps working exactly as
 * it does today. The bank exists *alongside* it (see the doc's coexistence
 * section); nothing here migrates, replaces or reads a lesson.
 *
 * Every object below is `.strict()`. The lesson schema's default behaviour —
 * silently stripping unknown keys — is the documented hazard this bank was
 * asked to not reproduce: provenance, rationale and lifecycle are exactly the
 * kind of metadata that would vanish without a word. An unrecognised key is a
 * hard error here, matching `validateScenario`'s "hard failures, not warnings"
 * convention rather than the lesson schema's permissiveness.
 */

// ISO calendar date — the form every date in Nexus content already uses.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO date (YYYY-MM-DD)");

/**
 * The lifecycle a question walks, in order. A question is only as trustworthy
 * as the furthest state it has actually reached.
 */
export const LIFECYCLE_PROGRESSION = [
  "candidate",
  "source-verified",
  "content-reviewed",
  "approved",
  "production-eligible"
] as const;

/**
 * States outside the progression. They are not "further along" than anything —
 * a blocked or retired question has left the ladder, and can never be
 * production-eligible while it carries one of them.
 */
export const LIFECYCLE_HOLD_STATES = ["blocked", "retired"] as const;

export const CONTENT_STATUSES = [...LIFECYCLE_PROGRESSION, ...LIFECYCLE_HOLD_STATES] as const;

export const REVIEW_STATUSES = ["pending", "in-review", "changes-requested", "approved", "rejected"] as const;

/**
 * Question types observed in authored content. Deliberately a closed set: a
 * free string would let a typo create a silent new category that no future
 * consumer knows how to render.
 */
export const QUESTION_TYPES = ["recognition", "recall", "interpretation", "scenario", "workflow-sequencing"] as const;

/**
 * The same 1–6 scale the scenario side uses (`scenario-engine/difficulty.ts`).
 * It is restated rather than imported so the question bank does not depend on
 * the scenario engine for a Training content contract; `schema.test.ts` asserts
 * the two agree, so a drift fails loudly instead of quietly diverging.
 */
export const QUESTION_DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export const QuestionDifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
]);

/**
 * A choice carries its own stable id. Position is not identity: the correct
 * answer is referenced by id, so reordering choices for display can never
 * silently change which answer is correct — the failure mode the existing
 * `correctOptionIndex` shape invites.
 *
 * `why` is the per-choice explanation shown beside a selected distractor. It is
 * optional because not every choice earns one, and inventing filler text for
 * the ones that do not would be worse than its absence.
 */
export const QuestionChoiceSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    why: z.string().min(1).optional()
  })
  .strict();

/** An authoritative document, described once and referenced by many questions. */
export const SourceDefinitionSchema = z
  .object({
    authority: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url().optional(),
    dateOrVersion: z.string().min(1).optional(),
    jurisdiction: z.string().min(1).optional()
  })
  .strict();

/** A question pointing at a shared `sources` entry, plus where in it to look. */
const ReferencedSourceSchema = z
  .object({
    ref: z.string().min(1),
    locator: z.string().min(1)
  })
  .strict();

/** A question carrying its whole source inline, so the record stands alone. */
const InlineSourceSchema = SourceDefinitionSchema.extend({
  locator: z.string().min(1)
}).strict();

/**
 * Both shapes are supported, and a record must be wholly one or the other.
 * Inline keeps a single question self-contained; a ref keeps a batch of
 * questions from repeating the same citation twelve times. A half-and-half
 * object is rejected rather than guessed at.
 */
export const QuestionSourceSchema = z.union([ReferencedSourceSchema, InlineSourceSchema]);

/**
 * Classification metadata, for questions that are about a coding system.
 * Optional by design: forcing these fields onto a privacy question would make
 * every author supply a meaningless jurisdiction and release.
 *
 * This records *which classification and which release a question is written
 * against*. It asserts nothing about whether the question's content is
 * medically or legally correct.
 */
export const CodingReferenceSchema = z
  .object({
    system: z.string().min(1),
    jurisdiction: z.string().min(1),
    release: z.string().min(1),
    effectiveFrom: isoDate.optional(),
    effectiveTo: isoDate.optional(),
    codes: z.array(z.string().min(1)).default([])
  })
  .strict();

/**
 * Who checked this question against its source document, and when.
 *
 * `humanVerifiedBy`/`humanVerifiedOn` are nullable and have no default: a
 * verification record that appears by itself is exactly the thing this field
 * exists to prevent. Only a person who opened the cited document may fill them.
 */
export const VerificationRecordSchema = z
  .object({
    locatorConfidence: z.string().min(1).optional(),
    humanVerificationRequired: z.boolean(),
    humanVerifiedBy: z.string().min(1).nullable(),
    humanVerifiedOn: isoDate.nullable()
  })
  .strict();

export const TrainingQuestionSchema = z
  .object({
    /** Stable across revisions and globally unique within a bank. */
    questionId: z.string().min(1),

    // Training classification.
    domain: z.string().min(1),
    skillArea: z.string().min(1),
    difficultyLevel: QuestionDifficultySchema,
    questionType: z.enum(QUESTION_TYPES),
    learningObjective: z.string().min(1),

    // Content.
    question: z.string().min(1),
    choices: z.array(QuestionChoiceSchema).min(2),
    correctChoiceId: z.string().min(1),

    // Instructional feedback. Required: a question that cannot explain its own
    // answer teaches nothing once the learner has guessed.
    rationale: z.string().min(1),

    // Provenance. Required: an unsourced clinical or regulatory claim is not
    // reviewable, and this bank stores provenance precisely so that a human can
    // check it later.
    source: QuestionSourceSchema,
    codingReference: CodingReferenceSchema.optional(),

    /** Groups near-identical questions so a future selector can avoid serving two at once. */
    variantGroup: z.string().min(1).optional(),

    // Lifecycle.
    contentStatus: z.enum(CONTENT_STATUSES),
    reviewStatus: z.enum(REVIEW_STATUSES),
    /** Date after which the question is known to be stale (e.g. a fiscal-year citation). */
    validUntil: isoDate.optional(),
    flags: z.array(z.string().min(1)).default([]),
    verification: VerificationRecordSchema.optional()
  })
  .strict()
  .superRefine((question, ctx) => {
    // Duplicate choice ids would make `correctChoiceId` ambiguous and would
    // make per-choice feedback attach to the wrong option.
    const seen = new Set<string>();
    for (const choice of question.choices) {
      if (seen.has(choice.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["choices"],
          message: `Duplicate choice id "${choice.id}"`
        });
      }
      seen.add(choice.id);
    }

    // The scenario side already learned this lesson: an unchecked correct-answer
    // reference is a question that can ship with no correct answer at all.
    if (!seen.has(question.correctChoiceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctChoiceId"],
        message: `correctChoiceId "${question.correctChoiceId}" does not match any choice id`
      });
    }

    // A question may only claim to be past `candidate` if a person is recorded
    // as having verified it. This is the integration gate's rule (handoff
    // manifest C5), and it is what stops a candidate quietly becoming
    // production-eligible by being edited.
    if (isAboveCandidate(question.contentStatus)) {
      const v = question.verification;
      if (!v || v.humanVerifiedBy === null || v.humanVerifiedOn === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentStatus"],
          message: `contentStatus "${question.contentStatus}" requires a recorded human verification (verification.humanVerifiedBy and verification.humanVerifiedOn)`
        });
      }
    }
  });

export const QuestionBankSchema = z
  .object({
    bankId: z.string().min(1),
    /** A string, matching the lesson and scenario `version` convention. */
    version: z.string().min(1),
    sources: z.record(z.string().min(1), SourceDefinitionSchema).default({}),
    questions: z.array(TrainingQuestionSchema).min(1)
  })
  .strict()
  .superRefine((bank, ctx) => {
    // The repository already rejects duplicate lesson ids at registration
    // (`InMemoryTrainingLessonRepository`); a bank should not be able to
    // contain the collision in the first place.
    const seen = new Set<string>();
    for (const question of bank.questions) {
      if (seen.has(question.questionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: `Duplicate question id "${question.questionId}"`
        });
      }
      seen.add(question.questionId);
    }

    // A dangling source ref is an unsourced question wearing a citation.
    for (const [index, question] of bank.questions.entries()) {
      const source = question.source;
      if ("ref" in source && !(source.ref in bank.sources)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "source", "ref"],
          message: `source.ref "${source.ref}" is not defined in the bank's sources`
        });
      }
    }
  });

export type QuestionChoice = z.infer<typeof QuestionChoiceSchema>;
export type SourceDefinition = z.infer<typeof SourceDefinitionSchema>;
export type QuestionSource = z.infer<typeof QuestionSourceSchema>;
export type CodingReference = z.infer<typeof CodingReferenceSchema>;
export type VerificationRecord = z.infer<typeof VerificationRecordSchema>;
export type TrainingQuestion = z.infer<typeof TrainingQuestionSchema>;
export type QuestionBank = z.infer<typeof QuestionBankSchema>;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionDifficultyLevel = z.infer<typeof QuestionDifficultySchema>;

/**
 * How far along the progression a status sits, or `-1` for a hold state.
 * A hold state is not "less than candidate" — it is off the ladder entirely,
 * which is why it gets its own value rather than a rank of zero.
 */
export function lifecycleRank(status: ContentStatus): number {
  const index = (LIFECYCLE_PROGRESSION as readonly string[]).indexOf(status);
  return index;
}

export function isAboveCandidate(status: ContentStatus): boolean {
  return lifecycleRank(status) > 0;
}

/**
 * The single predicate a future runtime selector should ask before showing a
 * question to a learner. It is read-only: it reports a state, and promotes
 * nothing. The promotion workflow that would *set* these values is deliberately
 * not implemented here.
 *
 * It is conservative on purpose — all three of the status, the review outcome
 * and a recorded human verification must line up. A question that is merely
 * labelled `production-eligible` does not pass.
 */
export function isProductionEligible(question: TrainingQuestion): boolean {
  return (
    question.contentStatus === "production-eligible" &&
    question.reviewStatus === "approved" &&
    question.verification?.humanVerifiedBy != null &&
    question.verification?.humanVerifiedOn != null
  );
}
