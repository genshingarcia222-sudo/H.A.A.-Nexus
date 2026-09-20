import { beforeEach, describe, expect, it } from "vitest";
import type { CompetencyRecord, SessionRecord, UserProfile } from "@haa-nexus/nexus-core";
import {
  browserStorageAvailable,
  DevBrowserCompetencyRepository,
  DevBrowserProfileRepository,
  DevBrowserSessionRepository,
  DEV_STORAGE_KEYS
} from "./devBrowserRepositories.js";

/**
 * Development-only browser persistence.
 *
 * The property that matters is survival across a reload, which is simulated by
 * building a *new* repository over the same storage - exactly what a page load
 * does. The second property is that broken or unavailable storage degrades to
 * "nothing stored" rather than taking the app down.
 *
 * None of this decides D10: what persists a real web learner's progress is
 * still open.
 */

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  constructor(private readonly failOnWrite = false) {}
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failOnWrite) throw new DOMException("QuotaExceededError");
    this.map.set(key, value);
  }
  /** Corrupt a key the way a half-finished manual edit would. */
  corrupt(key: string) {
    this.map.set(key, "{not json");
  }
}

const record = (over: Partial<SessionRecord> = {}): SessionRecord =>
  ({
    id: "s1",
    scenarioId: "SCRIBE-FM-014",
    scenarioVersion: "1.0",
    scenarioTitle: "Three-Day Cough",
    mode: "practice",
    status: "completed",
    startedAt: 1000,
    activeMs: 60000,
    pausedMs: 0,
    completedAt: 2000,
    flags: [],
    draft: {
      chiefComplaint: "Cough",
      hpi: "",
      ros: "",
      physicalExam: "",
      assessment: "",
      plan: "",
      additionalNotes: ""
    },
    evaluation: null,
    ...over
  }) as SessionRecord;

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
});

describe("dev browser persistence - the lifecycle a reload puts it through", () => {
  it("creates, mutates, persists and restores a session across a reload", async () => {
    const before = new DevBrowserSessionRepository(storage);
    await before.save(record({ status: "in_progress", completedAt: null }));
    await before.save(record({ status: "completed", draft: { ...record().draft, hpi: "Three days." } }));

    // A reload is a new repository over the same storage.
    const after = new DevBrowserSessionRepository(storage);
    const restored = await after.get("s1");
    expect(restored?.status).toBe("completed");
    expect(restored?.draft.hpi).toBe("Three days.");
    expect(await after.list()).toHaveLength(1);
  });

  it("lists newest first, as the SQLite repository does", async () => {
    const repo = new DevBrowserSessionRepository(storage);
    await repo.save(record({ id: "old", startedAt: 1000 }));
    await repo.save(record({ id: "new", startedAt: 5000 }));
    expect((await repo.list()).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("finds interrupted sessions after a reload, so recovery still works", async () => {
    const repo = new DevBrowserSessionRepository(storage);
    await repo.save(record({ id: "done", status: "completed" }));
    await repo.save(record({ id: "live", status: "in_progress", completedAt: null }));
    await repo.save(record({ id: "held", status: "paused", completedAt: null }));

    const interrupted = await new DevBrowserSessionRepository(storage).findInterrupted();
    expect(interrupted.map((r) => r.id).sort()).toEqual(["held", "live"]);
  });

  it("keeps competency records across a reload and folds a batch in one write", async () => {
    const repo = new DevBrowserCompetencyRepository(storage);
    const domains: CompetencyRecord[] = ["accuracy", "completeness"].map(
      (domain) =>
        ({ population: "practice", domain, attemptCount: 1, updatedAt: 10 }) as unknown as CompetencyRecord
    );
    await repo.upsertMany(domains);

    const after = new DevBrowserCompetencyRepository(storage);
    expect((await after.list()).map((r) => r.domain).sort()).toEqual(["accuracy", "completeness"]);
    expect((await after.get("practice", "accuracy"))?.attemptCount).toBe(1);
  });

  it("replaces a domain rather than duplicating it", async () => {
    const repo = new DevBrowserCompetencyRepository(storage);
    await repo.upsert({ population: "practice", domain: "accuracy", attemptCount: 1 } as unknown as CompetencyRecord);
    await repo.upsert({ population: "practice", domain: "accuracy", attemptCount: 2 } as unknown as CompetencyRecord);
    expect(await repo.list()).toHaveLength(1);
    expect((await repo.get("practice", "accuracy"))?.attemptCount).toBe(2);
  });

  it("keeps the profile across a reload", async () => {
    await new DevBrowserProfileRepository(storage).save({ displayName: "Dev", updatedAt: 5 } as UserProfile);
    expect((await new DevBrowserProfileRepository(storage).get())?.displayName).toBe("Dev");
  });
});

describe("dev browser persistence - failure paths", () => {
  it("reports storage as unavailable when writing throws", () => {
    expect(browserStorageAvailable(new FakeStorage(true))).toBe(false);
    expect(browserStorageAvailable(undefined)).toBe(false);
    expect(browserStorageAvailable(new FakeStorage())).toBe(true);
  });

  it("treats corrupt stored data as empty instead of throwing on boot", async () => {
    storage.corrupt(DEV_STORAGE_KEYS.sessions);
    const repo = new DevBrowserSessionRepository(storage);
    expect(await repo.list()).toEqual([]);
    expect(await repo.get("s1")).toBeUndefined();
  });

  it("keeps working when a write fails, rather than taking the app down", async () => {
    const full = new FakeStorage(true);
    const repo = new DevBrowserSessionRepository(full);
    await expect(repo.save(record())).resolves.toBeUndefined();
    // Nothing was stored, and nothing threw: the session lives in memory for
    // this tab, which is the right trade for a development convenience.
    expect(await repo.list()).toEqual([]);
  });

  it("namespaces its keys so it cannot collide with anything else", () => {
    expect(Object.values(DEV_STORAGE_KEYS).every((k) => k.startsWith("nexus.dev."))).toBe(true);
  });
});
