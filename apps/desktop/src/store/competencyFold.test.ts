import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type CompetencyRecord
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "./sessionStore.js";
import { useEntitlementStore } from "./entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Folding an attempt into competency is all-or-nothing.
 *
 * It used to run domain by domain: read, compute, write, repeat. A failure
 * partway through left the attempt counted in some domains and not others,
 * and `submit` is idempotent - a retry finds the session already completed
 * and returns - so nothing could ever finish the fold. The inconsistency was
 * permanent and silent.
 *
 * These tests pin the property, not the mechanism: no domain is written
 * unless every domain can be, and one attempt counts exactly once.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  (competencyRepository as InMemoryCompetencyRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function submitAnAttempt() {
  const started = useSessionStore.getState().start(SCENARIO, "practice");
  expect(started).toBe(true);
  useSessionStore.getState().updateField("chiefComplaint", "Cough for three days");
  await useSessionStore.getState().submit();
}

async function domainsOnRecord(): Promise<CompetencyRecord[]> {
  return competencyRepository.list();
}

describe("competency fold - atomicity", () => {
  it("writes every domain as one batch rather than one call per domain", async () => {
    const upsertMany = vi.spyOn(competencyRepository, "upsertMany");
    const upsertOne = vi.spyOn(competencyRepository, "upsert");

    await submitAnAttempt();

    expect(upsertMany).toHaveBeenCalledTimes(1);
    expect(upsertOne).not.toHaveBeenCalled();
    // Every scored domain in a single batch.
    expect(upsertMany.mock.calls[0]![0]!.length).toBe(7);
  });

  it("leaves no domain written when the batch fails", async () => {
    vi.spyOn(competencyRepository, "upsertMany").mockRejectedValueOnce(new Error("disk full"));

    await submitAnAttempt();

    expect(await domainsOnRecord()).toEqual([]);
  });

  it("leaves no domain written when reading an existing record fails partway", async () => {
    // The read/compute phase runs before anything is written, so a failure
    // there cannot leave a partial fold behind.
    const get = vi.spyOn(competencyRepository, "get");
    get.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("database is locked"));

    await submitAnAttempt();

    expect(await domainsOnRecord()).toEqual([]);
  });

  it("counts one attempt exactly once across every domain", async () => {
    await submitAnAttempt();

    const records = await domainsOnRecord();
    expect(records.length).toBe(7);
    for (const record of records) {
      expect(record.attemptCount, `${record.domain} attemptCount`).toBe(1);
    }
  });

  it("does not fold the same attempt twice when submit is called again", async () => {
    await submitAnAttempt();
    await useSessionStore.getState().submit();

    for (const record of await domainsOnRecord()) {
      expect(record.attemptCount, `${record.domain} attemptCount`).toBe(1);
    }
  });

  it("stamps every domain in one fold with the same timestamp", async () => {
    // One fold, one moment: per-domain clock reads would make an attempt look
    // like several events spread over time.
    await submitAnAttempt();

    const stamps = new Set((await domainsOnRecord()).map((r) => r.updatedAt));
    expect(stamps.size).toBe(1);
  });

  it("still saves the attempt to history when the competency fold fails", async () => {
    vi.spyOn(competencyRepository, "upsertMany").mockRejectedValueOnce(new Error("disk full"));

    await submitAnAttempt();

    // The learner's attempt is not lost because a derived roll-up failed.
    expect((await sessionRepository.list()).length).toBe(1);
    expect(useSessionStore.getState().saveError).toBeNull();
  });
});
