import { z } from "zod";
import { RESULT_POPULATIONS } from "../types/result-population.js";
import type { ResultPopulation } from "../types/result-population.js";

/**
 * The exposure ledger: who received what, when (D12-39, D12-40).
 *
 * It is **append-only and outside the corpus**. A delivery event may name a
 * record; no record may name a delivery. That one-way rule is what keeps
 * canonical truth independent of history — nothing a learner does can change
 * what a question's correct answer is (invariant 3).
 *
 * `learnerRef` is a pseudonymous, stable handle, never a name or an email.
 * Architecture §27 keeps MVP data on the device; when a shared ledger arrives
 * it carries counts, not identities.
 *
 * Storage is an adapter behind this interface. The in-memory implementation
 * below is the whole story today: the desktop SQLite table and its IPC
 * commands are the next step, and the web binding waits on D10.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO date (YYYY-MM-DD)");
const timestamp = z.string().datetime({ offset: true });

export const SelectionTraceSchema = z
  .object({
    novelty: z.enum(["UNSEEN", "STALE", "RECENT", "SAME_SESSION"]),
    bestNoveltyAvailable: z.enum(["UNSEEN", "STALE", "RECENT", "SAME_SESSION"]),
    crossUserOverExposed: z.boolean(),
    crossUserShare: z.number().min(0).max(1).optional(),
    diversityCost: z.number().min(0),
    poolSize: z.number().int().min(0),
    stratumKey: z.string().min(1),
    reasons: z.array(z.string().min(1)).min(1)
  })
  .strict();

export const DeliveryEventSchema = z
  .object({
    /** Client-generated, so a retried sync cannot create a duplicate (Architecture §22). */
    deliveryId: z.string().min(1),
    sessionId: z.string().min(1),
    /** Pseudonymous. A name or an email here would be a privacy defect. */
    learnerRef: z.string().min(1),
    cohortRef: z.string().min(1).optional(),
    /** D5: Practice and Assessment never merge. */
    population: z.enum(RESULT_POPULATIONS as unknown as [ResultPopulation, ...ResultPopulation[]]),
    itemId: z.string().min(1),
    itemRevision: z.number().int().min(1),
    conceptId: z.string().min(1).optional(),
    corpusReleaseId: z.string().min(1),
    policyVersion: z.string().min(1),
    envelopeId: z.string().min(1),
    tierAtDelivery: z.string().min(1),
    modality: z.string().min(1),
    difficultyLevel: z.number().int().min(1).max(6),
    jurisdictions: z.array(z.string().min(1)).min(1),
    deliveredAt: timestamp,
    deliveredOn: isoDate,
    slotIndex: z.number().int().min(0),
    answeredChoiceId: z.string().min(1).optional(),
    correct: z.boolean().optional(),
    answeredAt: timestamp.optional(),
    trace: SelectionTraceSchema
  })
  .strict()
  .superRefine((event, ctx) => {
    // An answer is a fact about a delivery: recording correctness without the
    // choice that produced it leaves a score nobody can audit.
    if (event.correct !== undefined && event.answeredChoiceId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answeredChoiceId"],
        message: "correctness recorded without the choice that produced it"
      });
    }
    if (event.answeredAt && event.answeredAt < event.deliveredAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answeredAt"],
        message: "answered before it was delivered"
      });
    }
  });

export type SelectionTraceRecord = z.infer<typeof SelectionTraceSchema>;
export type DeliveryEvent = z.infer<typeof DeliveryEventSchema>;

export interface DeliveryEventQuery {
  learnerRef?: string;
  sessionId?: string;
  conceptId?: string;
  stratumKey?: string;
  /** Inclusive lower bound on `deliveredOn`. */
  since?: string;
}

/**
 * Append-only by contract: there is no update and no delete.
 *
 * An answer arrives after its delivery, so `recordAnswer` exists — it fills the
 * answer fields of one event exactly once, and refuses a second attempt rather
 * than overwriting what was recorded.
 */
export interface DeliveryEventRepository {
  append(event: DeliveryEvent): void;
  recordAnswer(deliveryId: string, answer: { answeredChoiceId: string; correct: boolean; answeredAt: string }): void;
  find(query?: DeliveryEventQuery): DeliveryEvent[];
  size: number;
}

export class DuplicateDeliveryError extends Error {
  constructor(deliveryId: string) {
    super(`delivery "${deliveryId}" is already recorded`);
    this.name = "DuplicateDeliveryError";
  }
}

export class UnknownDeliveryError extends Error {
  constructor(deliveryId: string) {
    super(`delivery "${deliveryId}" is not in the ledger`);
    this.name = "UnknownDeliveryError";
  }
}

export class AlreadyAnsweredError extends Error {
  constructor(deliveryId: string) {
    super(`delivery "${deliveryId}" already has an answer`);
    this.name = "AlreadyAnsweredError";
  }
}

/**
 * The in-memory ledger — tests, and any runtime with no durable store.
 *
 * It matches the contract exactly, including the refusals, so a durable
 * adapter cannot be laxer than this one without failing the same tests.
 */
export class InMemoryDeliveryEventRepository implements DeliveryEventRepository {
  private readonly events = new Map<string, DeliveryEvent>();

  append(event: DeliveryEvent): void {
    const parsed = DeliveryEventSchema.parse(event);
    if (this.events.has(parsed.deliveryId)) {
      // Idempotency is the caller's to arrange via deliveryId; silently
      // accepting a second copy would inflate every exposure count.
      throw new DuplicateDeliveryError(parsed.deliveryId);
    }
    this.events.set(parsed.deliveryId, parsed);
  }

  recordAnswer(
    deliveryId: string,
    answer: { answeredChoiceId: string; correct: boolean; answeredAt: string }
  ): void {
    const event = this.events.get(deliveryId);
    if (!event) throw new UnknownDeliveryError(deliveryId);
    if (event.answeredChoiceId !== undefined) throw new AlreadyAnsweredError(deliveryId);
    this.events.set(deliveryId, DeliveryEventSchema.parse({ ...event, ...answer }));
  }

  find(query: DeliveryEventQuery = {}): DeliveryEvent[] {
    return [...this.events.values()]
      .filter((event) => {
        if (query.learnerRef && event.learnerRef !== query.learnerRef) return false;
        if (query.sessionId && event.sessionId !== query.sessionId) return false;
        if (query.conceptId && event.conceptId !== query.conceptId) return false;
        if (query.stratumKey && event.trace.stratumKey !== query.stratumKey) return false;
        if (query.since && event.deliveredOn < query.since) return false;
        return true;
      })
      .sort((a, b) => (a.deliveredAt < b.deliveredAt ? -1 : a.deliveredAt > b.deliveredAt ? 1 : 0));
  }

  get size(): number {
    return this.events.size;
  }
}
