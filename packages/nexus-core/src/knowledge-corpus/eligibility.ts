import { isProductionEligible } from "../question-bank/schema.js";
import type { KnowledgeCorpus } from "./validate.js";
import type { AssessmentItem } from "./item.js";
import { checkItemQuality, qualityErrors } from "./quality.js";
import { blockedByOpenConflicts } from "./conflict.js";
import { checkReviewChain } from "./review.js";
import { intersectWindows, modeAccepts, temporalState } from "./temporal.js";
import type { EffectiveWindow, TemporalMode, TemporalState } from "./temporal.js";
import { parsePinnedRef } from "./ids.js";
import { isSufficientAuthority } from "./schema.js";

/**
 * Two predicates, deliberately separate (D12-20).
 *
 * `isProductionEligible` — inherited from the bank — is **static**: is this
 * record finished and verified? `isDeliverable` is **relative to a date and a
 * request**: may this learner receive it *today*, given what its sources now
 * say, what it depends on, and whether anyone has flagged a conflict.
 *
 * Keeping them apart matters. A record does not stop being verified because
 * the fiscal year turned over; it stops being *deliverable*. Collapsing the two
 * would make a calendar day look like a content defect.
 *
 * Both report. Neither promotes anything, and there is no bypass flag.
 */

export interface DeliveryRequest {
  /** ISO date the decision is made against. Always supplied; never `new Date()`. */
  asOf: string;
  jurisdictions?: string[];
  temporalMode?: TemporalMode;
}

export interface DeliverabilityResult {
  deliverable: boolean;
  /** Why not, one reason per failed condition. Empty when deliverable. */
  reasons: string[];
  temporalState: TemporalState;
  window: EffectiveWindow;
}

type CorpusRecord = KnowledgeCorpus["knowledge"][number] | KnowledgeCorpus["contexts"][number] | AssessmentItem;

const recordId = (record: CorpusRecord): string => ("questionId" in record ? record.questionId : record.id);

const isItem = (record: CorpusRecord): record is AssessmentItem => "questionId" in record;

/** Every source a record cites, by ref. */
function citedSourceRefs(record: CorpusRecord): string[] {
  if (isItem(record)) {
    return [
      ...("ref" in record.source ? [record.source.ref] : []),
      ...record.additionalEvidence.map((link) => link.ref)
    ];
  }
  return record.evidence.map((link) => link.ref);
}

/**
 * The window a record is actually true in: its own, intersected with its
 * context's and every source's (D12-23).
 */
export function effectiveWindow(record: CorpusRecord, corpus: KnowledgeCorpus): EffectiveWindow {
  const windows: EffectiveWindow[] = [
    { from: record.applicability?.effectiveFrom, to: record.applicability?.effectiveTo }
  ];

  if (isItem(record) && record.contextRef) {
    const pinned = parsePinnedRef(record.contextRef);
    const context = pinned ? corpus.contexts.find((candidate) => candidate.id === pinned.id) : undefined;
    if (context) {
      windows.push({ from: context.applicability?.effectiveFrom, to: context.applicability?.effectiveTo });
    }
  }

  const sourcesById = new Map(corpus.sources.map((source) => [source.id, source]));
  for (const ref of citedSourceRefs(record)) {
    const source = sourcesById.get(ref);
    if (source) windows.push({ from: source.effectiveFrom, to: source.effectiveTo });
  }

  return intersectWindows(windows);
}

/**
 * The static gate: finished, reviewed and verified.
 *
 * For items this delegates to the bank's own `isProductionEligible` so there is
 * one definition, then adds the D12 conditions a bank question has no fields
 * for.
 */
export function isCorpusProductionEligible(record: CorpusRecord, corpus: KnowledgeCorpus): string[] {
  const reasons: string[] = [];
  const where = recordId(record);

  if (record.contentStatus !== "production-eligible") {
    reasons.push(`${where}: contentStatus is "${record.contentStatus}", not "production-eligible"`);
  }
  if (record.reviewStatus !== "approved") {
    reasons.push(`${where}: reviewStatus is "${record.reviewStatus}", not "approved"`);
  }
  if (record.flags.includes("HUMAN-VERIFY-REQUIRED")) {
    reasons.push(`${where}: still carries HUMAN-VERIFY-REQUIRED`);
  }
  if (!record.applicability) {
    reasons.push(`${where}: declares no applicability`);
  }

  // The review chain, on the same function the validator uses.
  const reviewers = new Map(corpus.reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const chain = checkReviewChain(
    {
      where,
      id: where,
      revision: record.revision,
      contentStatus: record.contentStatus,
      reviewStatus: record.reviewStatus,
      verification: record.verification,
      flags: record.flags
    },
    corpus.reviews,
    reviewers
  );
  reasons.push(...chain);

  if (isItem(record)) {
    if (!isProductionEligible(record)) {
      reasons.push(`${where}: fails the question bank's production-eligibility rule`);
    }
    if (record.knowledgeRefs.length === 0) {
      reasons.push(`${where}: cites no knowledge record`);
    }
    if (!record.variantGroup) {
      reasons.push(`${where}: has no concept (variantGroup)`);
    }
    for (const finding of qualityErrors(checkItemQuality(record, { production: true }))) {
      reasons.push(`${where}: ${finding.rule} - ${finding.message}`);
    }
  }

  // At least one sufficiently authoritative source must stand behind it.
  const sourcesById = new Map(corpus.sources.map((source) => [source.id, source]));
  const authoritative = citedSourceRefs(record)
    .map((ref) => sourcesById.get(ref))
    .some((source) => source && isSufficientAuthority(source.authorityClass));
  if (!authoritative) {
    reasons.push(`${where}: no cited source carries an authority class that may stand alone`);
  }

  return reasons;
}

/**
 * The date-and-request gate.
 *
 * Note what is **not** checked here: membership of a release manifest. The
 * deterministic build that produces manifests is work package 5; until it
 * exists, this predicate answers "may this record be delivered", and the
 * release gate is the remaining half of "will it be".
 */
export function isDeliverable(
  record: CorpusRecord,
  corpus: KnowledgeCorpus,
  request: DeliveryRequest
): DeliverabilityResult {
  const where = recordId(record);
  const reasons: string[] = [...isCorpusProductionEligible(record, corpus)];

  const window = effectiveWindow(record, corpus);
  const state = temporalState(window, request.asOf);
  const mode = request.temporalMode ?? "CURRENT_ONLY";
  if (!modeAccepts(mode, state)) {
    reasons.push(`${where}: ${state} on ${request.asOf}, which ${mode} does not accept`);
  }

  // Jurisdiction: the request asks for somewhere, and the record must speak
  // for it. UNIVERSAL material answers any request.
  const wanted = request.jurisdictions ?? ["US"];
  const declared = record.applicability?.jurisdictions ?? [];
  if (declared.length > 0 && !declared.includes("UNIVERSAL")) {
    if (!declared.some((jurisdiction) => wanted.includes(jurisdiction))) {
      reasons.push(`${where}: applies to ${declared.join(", ")}, not to ${wanted.join(", ")}`);
    }
  }

  // Sources must still be active, and must still be the bytes the reviewer saw.
  const sourcesById = new Map(corpus.sources.map((source) => [source.id, source]));
  const reviewed = new Set(record.verification?.reviewedSourceSnapshots ?? []);
  for (const ref of citedSourceRefs(record)) {
    const source = sourcesById.get(ref);
    if (!source) continue;
    if (source.status !== "active") {
      reasons.push(`${where}: cites source "${ref}", which is ${source.status}`);
    }
    if (source.snapshotHash && !reviewed.has(source.snapshotHash)) {
      // The source changed since it was verified, or was never verified
      // against these bytes. Either way nobody has checked what it says now.
      reasons.push(`${where}: source "${ref}" has changed since it was reviewed`);
    }
  }

  // Dependencies: a pinned context and every cited knowledge record must
  // themselves be deliverable, or the item rests on something unverified.
  if (isItem(record)) {
    if (record.contextRef) {
      const pinned = parsePinnedRef(record.contextRef);
      const context = pinned ? corpus.contexts.find((candidate) => candidate.id === pinned.id) : undefined;
      if (!context) {
        reasons.push(`${where}: pinned context ${record.contextRef} is not in the corpus`);
      } else if (isCorpusProductionEligible(context, corpus).length > 0) {
        reasons.push(`${where}: pinned context ${context.id} is not production-eligible`);
      }
    }
    for (const ref of record.knowledgeRefs) {
      const knowledge = corpus.knowledge.find((candidate) => candidate.id === ref);
      if (!knowledge) {
        reasons.push(`${where}: cites knowledge "${ref}", which is not in the corpus`);
        continue;
      }
      if (isCorpusProductionEligible(knowledge, corpus).length > 0) {
        reasons.push(`${where}: cites knowledge "${ref}", which is not production-eligible`);
      }
      const knowledgeState = temporalState(effectiveWindow(knowledge, corpus), request.asOf);
      if (knowledgeState === "EXPIRED") {
        reasons.push(`${where}: cites knowledge "${ref}", which expired before ${request.asOf}`);
      }
    }
  }

  // An open conflict stops every record it names, on both sides.
  if (blockedByOpenConflicts(corpus.conflicts).has(where)) {
    reasons.push(`${where}: named in an open conflict`);
  }

  // Superseded content is history, not inventory.
  const supersededBy = [...corpus.knowledge, ...corpus.contexts, ...corpus.concepts, ...corpus.items].find((other) =>
    other.supersedes.includes(where)
  );
  if (supersededBy) {
    reasons.push(`${where}: superseded by ${"questionId" in supersededBy ? supersededBy.questionId : supersededBy.id}`);
  }

  return { deliverable: reasons.length === 0, reasons, temporalState: state, window };
}

/** Every item a request may receive, in corpus order. */
export function deliverableItems(corpus: KnowledgeCorpus, request: DeliveryRequest): AssessmentItem[] {
  return corpus.items.filter((item) => isDeliverable(item, corpus, request).deliverable);
}
