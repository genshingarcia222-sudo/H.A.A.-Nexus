// Call sites updated for decision D5 (2026-09-20): competency and analytics
// are computed per result population. These fixtures are all practice-mode, so
// they pass "practice" and assert exactly what they asserted before - the
// population argument is threaded through, no expectation was changed.
import { describe, expect, it } from "vitest";
import { InMemoryCompetencyRepository } from "./competency-repository.js";
import { updateCompetencyRecord } from "../competency-engine/index.js";

describe("InMemoryCompetencyRepository", () => {
  it("returns undefined for a domain with no record yet", async () => {
    expect(await new InMemoryCompetencyRepository().get("practice", "HPI")).toBeUndefined();
  });

  it("upserts and retrieves a record by domain", async () => {
    const repo = new InMemoryCompetencyRepository();
    const record = updateCompetencyRecord(undefined, "practice", "HPI", 80, 1000);
    await repo.upsert(record);
    expect((await repo.get("practice", "HPI"))?.avgScore).toBe(80);
  });

  it("overwrites the record for the same domain on repeated upsert", async () => {
    const repo = new InMemoryCompetencyRepository();
    let record = updateCompetencyRecord(undefined, "practice", "HPI", 80, 1000);
    await repo.upsert(record);
    record = updateCompetencyRecord(record, "practice", "HPI", 90, 2000);
    await repo.upsert(record);
    const stored = await repo.get("practice", "HPI");
    expect(stored?.attemptCount).toBe(2);
  });

  it("keeps separate records per domain", async () => {
    const repo = new InMemoryCompetencyRepository();
    await repo.upsert(updateCompetencyRecord(undefined, "practice", "HPI", 80, 1000));
    await repo.upsert(updateCompetencyRecord(undefined, "practice", "ROS", 60, 1000));
    expect(await repo.list()).toHaveLength(2);
  });
});
