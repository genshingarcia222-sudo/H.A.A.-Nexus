import { describe, expect, it } from "vitest";
import { InMemoryCompetencyRepository } from "./competency-repository.js";
import { updateCompetencyRecord } from "../competency-engine/index.js";

describe("InMemoryCompetencyRepository", () => {
  it("returns undefined for a domain with no record yet", async () => {
    expect(await new InMemoryCompetencyRepository().get("HPI")).toBeUndefined();
  });

  it("upserts and retrieves a record by domain", async () => {
    const repo = new InMemoryCompetencyRepository();
    const record = updateCompetencyRecord(undefined, "HPI", 80, 1000);
    await repo.upsert(record);
    expect((await repo.get("HPI"))?.avgScore).toBe(80);
  });

  it("overwrites the record for the same domain on repeated upsert", async () => {
    const repo = new InMemoryCompetencyRepository();
    let record = updateCompetencyRecord(undefined, "HPI", 80, 1000);
    await repo.upsert(record);
    record = updateCompetencyRecord(record, "HPI", 90, 2000);
    await repo.upsert(record);
    const stored = await repo.get("HPI");
    expect(stored?.attemptCount).toBe(2);
  });

  it("keeps separate records per domain", async () => {
    const repo = new InMemoryCompetencyRepository();
    await repo.upsert(updateCompetencyRecord(undefined, "HPI", 80, 1000));
    await repo.upsert(updateCompetencyRecord(undefined, "ROS", 60, 1000));
    expect(await repo.list()).toHaveLength(2);
  });
});
