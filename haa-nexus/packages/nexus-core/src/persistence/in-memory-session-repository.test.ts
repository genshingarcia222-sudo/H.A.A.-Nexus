import { describe, expect, it } from "vitest";
import { InMemorySessionRepository } from "./in-memory-session-repository.js";
import type { SessionRecord } from "./types.js";

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "s1",
    scenarioId: "SCRIBE-TEST-001",
    scenarioVersion: "1.0",
    scenarioTitle: "Test Scenario",
    mode: "practice",
    status: "in_progress",
    startedAt: Date.now(),
    activeMs: 0,
    pausedMs: 0,
    completedAt: null,
    flags: [],
    draft: {
      chiefComplaint: "",
      hpi: "",
      ros: "",
      physicalExam: "",
      assessment: "",
      plan: "",
      additionalNotes: ""
    },
    evaluation: null,
    ...overrides
  };
}

describe("InMemorySessionRepository", () => {
  it("saves and retrieves a record by id", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeRecord());
    expect((await repo.get("s1"))?.scenarioId).toBe("SCRIBE-TEST-001");
  });

  it("returns undefined for an unknown id", async () => {
    const repo = new InMemorySessionRepository();
    expect(await repo.get("nope")).toBeUndefined();
  });

  it("overwrites a record saved again under the same id (e.g. pause -> complete)", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeRecord({ status: "in_progress" }));
    await repo.save(makeRecord({ status: "completed" }));
    expect((await repo.get("s1"))?.status).toBe("completed");
  });

  it("lists records newest-first", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeRecord({ id: "s1", startedAt: 1000 }));
    await repo.save(makeRecord({ id: "s2", startedAt: 2000 }));
    const list = await repo.list();
    expect(list.map((r) => r.id)).toEqual(["s2", "s1"]);
  });

  it("findInterrupted returns only in_progress/paused sessions", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeRecord({ id: "s1", status: "completed" }));
    await repo.save(makeRecord({ id: "s2", status: "in_progress" }));
    await repo.save(makeRecord({ id: "s3", status: "paused" }));
    const interrupted = await repo.findInterrupted();
    expect(interrupted.map((r) => r.id).sort()).toEqual(["s2", "s3"]);
  });

  it("clear() removes every record (test-only convenience)", async () => {
    const repo = new InMemorySessionRepository();
    await repo.save(makeRecord());
    repo.clear();
    expect(await repo.list()).toEqual([]);
  });
});
