import { z } from "zod";
import { parsePinnedRef } from "./ids.js";

/**
 * Conflicts between records (D12-28).
 *
 * When two records disagree, the corpus **records the disagreement and stops
 * delivering both**. It never picks a winner: choosing between two
 * authoritative-looking claims about HIPAA or coding is a judgement about
 * truth, and no validator is entitled to make it.
 *
 * Structural kinds can be spotted mechanically. A contradiction cannot — it
 * takes a person to notice that two well-formed records cannot both be right —
 * so `CONTRADICTION` and `SOURCE_DISAGREEMENT` are declared, not detected.
 */

export const CONFLICT_KINDS = [
  "CONTRADICTION",
  "OVERLAPPING_PERIOD",
  "DUPLICATE_CONCEPT",
  "SOURCE_DISAGREEMENT"
] as const;

export type ConflictKind = (typeof CONFLICT_KINDS)[number];

export const ConflictRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(CONFLICT_KINDS),
    /** At least two records, each pinned as `id@revision`. */
    records: z.array(z.string().min(1)).min(2),
    /** A Reviewer id, or `validator:<rule>` for a mechanically detected one. */
    detectedBy: z.string().min(1),
    status: z.enum(["open", "resolved"]).default("open"),
    resolution: z.string().min(1).optional(),
    resolvedBy: z.string().min(1).optional(),
    notes: z.string().min(1).optional()
  })
  .strict()
  .superRefine((conflict, ctx) => {
    for (const [index, ref] of conflict.records.entries()) {
      if (!parsePinnedRef(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["records", index],
          message: `"${ref}" must be pinned as "<recordId>@<revision>"`
        });
      }
    }
    if (conflict.status === "resolved") {
      // A resolution with no account of itself is indistinguishable from
      // someone quietly closing an inconvenient conflict.
      if (!conflict.resolution) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resolution"],
          message: "a resolved conflict must say how it was resolved"
        });
      }
      if (!conflict.resolvedBy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resolvedBy"],
          message: "a resolved conflict must name who resolved it"
        });
      }
    }
  });

export type ConflictRecord = z.infer<typeof ConflictRecordSchema>;

/** The record ids an open conflict currently blocks, ignoring revisions. */
export function blockedByOpenConflicts(conflicts: ConflictRecord[]): Set<string> {
  const blocked = new Set<string>();
  for (const conflict of conflicts) {
    if (conflict.status !== "open") continue;
    for (const ref of conflict.records) {
      const pinned = parsePinnedRef(ref);
      if (pinned) blocked.add(pinned.id);
    }
  }
  return blocked;
}

export interface OverlapCandidate {
  kind: Extract<ConflictKind, "OVERLAPPING_PERIOD">;
  records: [string, string];
  jurisdiction: string;
  concept: string;
}

/**
 * Pairs that look like an overlapping-period conflict: same concept, same
 * jurisdiction, overlapping effective windows.
 *
 * This **suggests**; it does not create a ConflictRecord and does not block
 * anything. Two variants of one concept legitimately overlap — that is what a
 * variant is — so only a person can say whether an overlap is a contradiction.
 */
export function detectOverlappingPeriods(
  records: {
    id: string;
    concept?: string | undefined;
    jurisdictions: string[];
    from?: string | undefined;
    to?: string | undefined;
  }[]
): OverlapCandidate[] {
  const candidates: OverlapCandidate[] = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      if (!a || !b) continue;
      if (!a.concept || a.concept !== b.concept) continue;
      const shared = a.jurisdictions.find((jurisdiction) => b.jurisdictions.includes(jurisdiction));
      if (!shared) continue;
      const startsAfterOtherEnds = (left: typeof a, right: typeof b) =>
        Boolean(left.from && right.to && left.from > right.to);
      if (startsAfterOtherEnds(a, b) || startsAfterOtherEnds(b, a)) continue;
      candidates.push({ kind: "OVERLAPPING_PERIOD", records: [a.id, b.id], jurisdiction: shared, concept: a.concept });
    }
  }
  return candidates;
}
