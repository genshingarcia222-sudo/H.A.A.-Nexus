import { describe, expect, it } from "vitest";
import {
  AlreadyAnsweredError,
  DeliveryEventSchema,
  DuplicateDeliveryError,
  InMemoryDeliveryEventRepository,
  UnknownDeliveryError
} from "./delivery-event-repository.js";
import type { DeliveryEvent } from "./delivery-event-repository.js";
import { buildExposureSnapshot } from "./exposure-service.js";

/**
 * D12 work package 8 (first half) — the exposure ledger contract.
 *
 * Append-only, outside the corpus, pseudonymous. The durable adapters are the
 * next step; this pins what any of them must do.
 */

const event = (overrides: Partial<DeliveryEvent> = {}): DeliveryEvent =>
  DeliveryEventSchema.parse({
    deliveryId: "D-0001",
    sessionId: "S-0001",
    learnerRef: "learner-7f3a",
    population: "practice",
    itemId: "NEXUS-L1-PRIV-000001",
    itemRevision: 1,
    conceptId: "PRIV-PHI-DEFINITION",
    corpusReleaseId: "release-abc",
    policyVersion: "training.default@1",
    envelopeId: "training.free@1",
    tierAtDelivery: "free",
    modality: "DIRECT_KNOWLEDGE",
    difficultyLevel: 1,
    jurisdictions: ["US"],
    deliveredAt: "2026-09-25T09:00:00Z",
    deliveredOn: "2026-09-25",
    slotIndex: 0,
    trace: {
      novelty: "UNSEEN",
      bestNoveltyAvailable: "UNSEEN",
      crossUserOverExposed: false,
      diversityCost: 0,
      poolSize: 12,
      stratumKey: "practice|training.free@1|DIRECT_KNOWLEDGE|1|US",
      reasons: ["UNSEEN"]
    },
    ...overrides
  });

describe("the event record", () => {
  it("accepts a complete delivery", () => {
    expect(() => event()).not.toThrow();
  });

  it("carries the D5 population, so practice and assessment never merge", () => {
    expect(event().population).toBe("practice");
    expect(() => event({ population: "exam" as unknown as DeliveryEvent["population"] })).toThrow();
  });

  it("refuses correctness without the choice that produced it", () => {
    expect(() => event({ correct: true })).toThrow();
    expect(() => event({ correct: true, answeredChoiceId: "a" })).not.toThrow();
  });

  it("refuses an answer that precedes its delivery", () => {
    expect(() =>
      event({ answeredChoiceId: "a", correct: true, answeredAt: "2026-09-25T08:00:00Z" })
    ).toThrow();
  });

  it("rejects an unknown field by name", () => {
    expect(() => event({ learnerName: "A. Person" } as unknown as Partial<DeliveryEvent>)).toThrow();
  });

  it("requires a reason for every delivery", () => {
    expect(() => event({ trace: { ...event().trace, reasons: [] } })).toThrow();
  });
});

describe("the ledger is append-only", () => {
  it("stores and finds events", () => {
    const ledger = new InMemoryDeliveryEventRepository();
    ledger.append(event());
    ledger.append(event({ deliveryId: "D-0002", slotIndex: 1, deliveredAt: "2026-09-25T09:01:00Z" }));
    expect(ledger.size).toBe(2);
    expect(ledger.find({ learnerRef: "learner-7f3a" })).toHaveLength(2);
    expect(ledger.find({ sessionId: "nope" })).toEqual([]);
  });

  it("refuses a duplicate delivery id rather than inflating exposure counts", () => {
    const ledger = new InMemoryDeliveryEventRepository();
    ledger.append(event());
    expect(() => ledger.append(event())).toThrow(DuplicateDeliveryError);
  });

  it("records an answer once, and never overwrites it", () => {
    const ledger = new InMemoryDeliveryEventRepository();
    ledger.append(event());
    ledger.recordAnswer("D-0001", { answeredChoiceId: "a", correct: true, answeredAt: "2026-09-25T09:00:30Z" });
    expect(ledger.find()[0]?.correct).toBe(true);
    expect(() =>
      ledger.recordAnswer("D-0001", { answeredChoiceId: "b", correct: false, answeredAt: "2026-09-25T09:02:00Z" })
    ).toThrow(AlreadyAnsweredError);
  });

  it("refuses an answer to a delivery it does not hold", () => {
    const ledger = new InMemoryDeliveryEventRepository();
    expect(() =>
      ledger.recordAnswer("D-9999", { answeredChoiceId: "a", correct: true, answeredAt: "2026-09-25T09:00:30Z" })
    ).toThrow(UnknownDeliveryError);
  });

  it("offers no way to change or delete history", () => {
    const ledger = new InMemoryDeliveryEventRepository();
    expect("update" in ledger).toBe(false);
    expect("delete" in ledger).toBe(false);
  });
});

describe("the snapshot the selector reads", () => {
  const ledger = new InMemoryDeliveryEventRepository();
  ledger.append(event({ deliveryId: "D-1", sessionId: "S-1", deliveredAt: "2026-09-01T09:00:00Z", deliveredOn: "2026-09-01" }));
  ledger.append(
    event({
      deliveryId: "D-2",
      sessionId: "S-2",
      conceptId: "PRIV-COVERED-ENTITY-TYPES",
      deliveredAt: "2026-09-24T09:00:00Z",
      deliveredOn: "2026-09-24"
    })
  );
  ledger.append(
    event({
      deliveryId: "D-3",
      sessionId: "S-2",
      learnerRef: "learner-other",
      conceptId: "PRIV-PHI-DEFINITION",
      deliveredAt: "2026-09-24T10:00:00Z",
      deliveredOn: "2026-09-24"
    })
  );

  it("counts a learner's own history per concept, in sessions and days", () => {
    const snapshot = buildExposureSnapshot(ledger, { learnerRef: "learner-7f3a", asOf: "2026-09-25" });
    expect(snapshot.scope).toBe("LEARNER_ONLY");
    expect(snapshot.learner?.lastSeenOn).toEqual({
      "PRIV-PHI-DEFINITION": "2026-09-01",
      "PRIV-COVERED-ENTITY-TYPES": "2026-09-24"
    });
    // Two distinct sessions in this learner's history; the newest is 1 ago.
    expect(snapshot.learner?.sessionsAgo["PRIV-COVERED-ENTITY-TYPES"]).toBe(1);
    expect(snapshot.learner?.sessionsAgo["PRIV-PHI-DEFINITION"]).toBe(2);
  });

  it("stays LEARNER_ONLY unless a shared ledger is declared", () => {
    // The honest default: one device cannot see other learners.
    const snapshot = buildExposureSnapshot(ledger, { learnerRef: "learner-7f3a", asOf: "2026-09-25" });
    expect(snapshot.strata).toBeUndefined();
  });

  it("builds stratum counts only when the ledger is shared", () => {
    const snapshot = buildExposureSnapshot(ledger, {
      learnerRef: "learner-7f3a",
      asOf: "2026-09-25",
      shared: true,
      eligibleConceptsByStratum: { "practice|training.free@1|DIRECT_KNOWLEDGE|1|US": 12 }
    });
    expect(snapshot.scope).toBe("SHARED");
    const stratum = snapshot.strata?.["practice|training.free@1|DIRECT_KNOWLEDGE|1|US"];
    expect(stratum?.windowSize).toBe(3);
    expect(stratum?.conceptCounts).toEqual({ "PRIV-PHI-DEFINITION": 2, "PRIV-COVERED-ENTITY-TYPES": 1 });
    expect(stratum?.eligibleConcepts).toBe(12);
  });

  it("counts other learners' deliveries but never exposes who they are", () => {
    const snapshot = buildExposureSnapshot(ledger, {
      learnerRef: "learner-7f3a",
      asOf: "2026-09-25",
      shared: true
    });
    expect(JSON.stringify(snapshot)).not.toContain("learner-other");
  });
});
