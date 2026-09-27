import { z } from "zod";
import { LIFECYCLE_PROGRESSION, isAboveCandidate } from "../question-bank/schema.js";
import type { ContentStatus } from "../question-bank/schema.js";
import type { CorpusVerification } from "./schema.js";
import { formatPinnedRef, parsePinnedRef } from "./ids.js";

/**
 * The human review log — the half of the verification gate that makes a
 * fabricated reviewer *detectable* rather than merely forbidden (D12-19).
 *
 * The bank already forbids claiming a status above `candidate` without a
 * recorded human verifier. That rule is honest but unenforceable on its own: a
 * name and a date typed into a record look exactly like a name and a date
 * earned by reading the source. WP3 closes that by requiring the claim to be
 * backed by a separate, append-only **ReviewRecord** naming a registered
 * **Reviewer**, targeting the exact `id@revision` being claimed, at the stage
 * the claimed status needs.
 *
 * Nothing here invents review policy. How many reviewers a record needs, who is
 * qualified to review what, and what a reviewer must check are not decided
 * here — the stages and their order come from the D12 lifecycle, which is the
 * bank's existing ladder.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO date (YYYY-MM-DD)");

/**
 * The three review stages, in the order the lifecycle walks them.
 *
 * SOURCE is the one the pilot's gate is about: a person opened the cited
 * document. CONTENT is instructional and clinical review. FINAL is sign-off.
 */
export const REVIEW_STAGES = ["SOURCE", "CONTENT", "FINAL"] as const;

export const REVIEW_DECISIONS = ["APPROVE", "REQUEST_CHANGES", "REJECT"] as const;

export type ReviewStage = (typeof REVIEW_STAGES)[number];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/**
 * A person entitled to record a review.
 *
 * `id` is what `humanVerifiedBy` holds, so a verification names a registered
 * person rather than free text. A machine may never appear here: the whole
 * point of the gate is that a human opened the document, and an agent that
 * could register itself as a reviewer would be able to approve its own work.
 */
export const ReviewerSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    qualification: z.string().min(1).optional(),
    status: z.enum(["active", "inactive"]).default("active")
  })
  .strict()
  .superRefine((reviewer, ctx) => {
    if (reviewer.id.startsWith("machine:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id"],
        message: "a reviewer is a person; a machine identity cannot be registered as one"
      });
    }
  });

/**
 * One review event, against one revision of one record.
 *
 * The log is **append-only**: a changed mind is a new record, never an edited
 * one, so the history of what was approved and when stays readable. `target`
 * is pinned (`id@revision`) because a review is of specific words — a review of
 * revision 1 says nothing about revision 2.
 */
export const ReviewRecordSchema = z
  .object({
    id: z.string().min(1),
    reviewerId: z.string().min(1),
    reviewedOn: isoDate,
    /** `<recordId>@<revision>`; the exact text reviewed. */
    target: z.string().min(1),
    stage: z.enum(REVIEW_STAGES),
    decision: z.enum(REVIEW_DECISIONS),
    /** Snapshot hashes of the sources the reviewer actually opened. */
    sourceSnapshots: z.array(z.string().min(1)).default([]),
    notes: z.string().min(1).optional()
  })
  .strict()
  .superRefine((review, ctx) => {
    if (!parsePinnedRef(review.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target"],
        message: `target "${review.target}" must be pinned as "<recordId>@<revision>"`
      });
    }
    if (review.reviewerId.startsWith("machine:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewerId"],
        message: "a review must be recorded by a person, not a machine identity"
      });
    }
  });

export type Reviewer = z.infer<typeof ReviewerSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

/**
 * Which stages a status requires, from the D12 lifecycle ladder.
 *
 * Each rung adds one stage and keeps the ones below it. `production-eligible`
 * needs the same three as `approved`: the extra step to production is the
 * release build's, not a fourth review.
 */
export function requiredStagesFor(status: ContentStatus): ReviewStage[] {
  switch (status) {
    case "source-verified":
      return ["SOURCE"];
    case "content-reviewed":
      return ["SOURCE", "CONTENT"];
    case "approved":
    case "production-eligible":
      return ["SOURCE", "CONTENT", "FINAL"];
    default:
      // `candidate` needs none; `blocked` and `retired` are off the ladder and
      // a review cannot move them back onto it.
      return [];
  }
}

/** Reviews of one exact revision of one record, in the order given. */
export function reviewsFor(reviews: ReviewRecord[], id: string, revision: number): ReviewRecord[] {
  const target = formatPinnedRef(id, revision);
  return reviews.filter((review) => review.target === target);
}

/**
 * The review that decides a stage: the latest by date, ties broken by log
 * order.
 *
 * Multiple reviews per stage are allowed — a REQUEST_CHANGES followed by a
 * later APPROVE is the normal path — and the most recent one is what counts.
 * This deliberately does not count approvals or require a quorum; how many
 * reviewers a record needs is a policy nobody has decided.
 */
export function decidingReview(reviews: ReviewRecord[], stage: ReviewStage): ReviewRecord | undefined {
  let latest: ReviewRecord | undefined;
  for (const review of reviews) {
    if (review.stage !== stage) continue;
    if (!latest || review.reviewedOn >= latest.reviewedOn) latest = review;
  }
  return latest;
}

export interface ReviewChainSubject {
  /** Where the errors are reported, e.g. `items.0`. */
  where: string;
  id: string;
  revision: number;
  contentStatus: ContentStatus;
  reviewStatus: string;
  verification?: CorpusVerification | undefined;
  flags: string[];
}

/**
 * The cross-check: does this record's claimed verification actually exist?
 *
 * Returns error strings rather than throwing, so a corpus reports every problem
 * at once instead of the first one.
 */
export function checkReviewChain(
  subject: ReviewChainSubject,
  reviews: ReviewRecord[],
  reviewers: Map<string, Reviewer>
): string[] {
  const errors: string[] = [];
  const { where } = subject;
  const mine = reviewsFor(reviews, subject.id, subject.revision);
  const sourceApproval = (() => {
    const deciding = decidingReview(mine, "SOURCE");
    return deciding?.decision === "APPROVE" ? deciding : undefined;
  })();

  // 1. Every stage the claimed status needs must be approved, for this exact
  //    revision. A review of an earlier revision does not carry forward: the
  //    reviewer verified words that have since changed.
  for (const stage of requiredStagesFor(subject.contentStatus)) {
    const deciding = decidingReview(mine, stage);
    if (!deciding) {
      errors.push(
        `${where}: contentStatus "${subject.contentStatus}" requires a ${stage} review of ${formatPinnedRef(subject.id, subject.revision)}, and none is recorded`
      );
      continue;
    }
    if (deciding.decision !== "APPROVE") {
      errors.push(
        `${where}: the latest ${stage} review of ${formatPinnedRef(subject.id, subject.revision)} is ${deciding.decision}, which does not support contentStatus "${subject.contentStatus}"`
      );
    }
  }

  // 2. A claimed human verifier must be a registered, active person, and must
  //    be the person whose SOURCE approval it claims to be. This is the rule a
  //    fabricated reviewer breaks.
  const verification = subject.verification;
  const claimedBy = verification?.humanVerifiedBy ?? null;
  const claimedOn = verification?.humanVerifiedOn ?? null;

  if (claimedBy !== null || claimedOn !== null) {
    if (claimedBy === null || claimedOn === null) {
      errors.push(`${where}: a human verification needs both humanVerifiedBy and humanVerifiedOn, or neither`);
    }
    if (claimedBy !== null) {
      const reviewer = reviewers.get(claimedBy);
      if (!reviewer) {
        errors.push(`${where}: humanVerifiedBy "${claimedBy}" is not a registered reviewer`);
      } else if (reviewer.status !== "active") {
        errors.push(`${where}: humanVerifiedBy "${claimedBy}" is an inactive reviewer`);
      }
    }
    if (!sourceApproval) {
      errors.push(
        `${where}: claims a human verification, but no approved SOURCE review of ${formatPinnedRef(subject.id, subject.revision)} exists`
      );
    } else {
      if (claimedBy !== null && claimedBy !== sourceApproval.reviewerId) {
        errors.push(
          `${where}: humanVerifiedBy "${claimedBy}" does not match the reviewer who approved the SOURCE review ("${sourceApproval.reviewerId}")`
        );
      }
      if (claimedOn !== null && claimedOn !== sourceApproval.reviewedOn) {
        errors.push(
          `${where}: humanVerifiedOn "${claimedOn}" does not match the SOURCE review date "${sourceApproval.reviewedOn}"`
        );
      }
      // A record may not claim to have been checked against a source snapshot
      // the reviewer never reported seeing.
      for (const snapshot of verification?.reviewedSourceSnapshots ?? []) {
        if (!sourceApproval.sourceSnapshots.includes(snapshot)) {
          errors.push(
            `${where}: reviewedSourceSnapshots contains "${snapshot}", which the SOURCE review does not record`
          );
        }
      }
    }
  }

  // 3. The flag and the claim must not contradict each other.
  //
  //    Whether a flag was *removed* cannot be seen from one snapshot — that
  //    needs history, and Git holds it. What is checkable here is the stronger
  //    thing: a record still marked as needing human verification cannot also
  //    claim to have had it, or to have climbed past `candidate` on it.
  if (subject.flags.includes("HUMAN-VERIFY-REQUIRED")) {
    if (isAboveCandidate(subject.contentStatus)) {
      errors.push(
        `${where}: carries HUMAN-VERIFY-REQUIRED while claiming contentStatus "${subject.contentStatus}"`
      );
    }
    if (claimedBy !== null || claimedOn !== null) {
      errors.push(`${where}: carries HUMAN-VERIFY-REQUIRED while claiming a human verification`);
    }
  }

  // 4. Production eligibility cannot outrun the review status it claims.
  if (subject.contentStatus === "production-eligible" && subject.reviewStatus !== "approved") {
    errors.push(
      `${where}: contentStatus "production-eligible" requires reviewStatus "approved", got "${subject.reviewStatus}"`
    );
  }

  // 5. Belt and braces with the bank's own rule: above candidate needs a
  //    recorded human verification at all.
  if (isAboveCandidate(subject.contentStatus) && (claimedBy === null || claimedOn === null)) {
    errors.push(
      `${where}: contentStatus "${subject.contentStatus}" requires a recorded human verification (verification.humanVerifiedBy and verification.humanVerifiedOn)`
    );
  }

  return errors;
}

/** The lifecycle ladder, re-exported so callers need not reach into the bank. */
export const REVIEWABLE_STATUSES = LIFECYCLE_PROGRESSION;
