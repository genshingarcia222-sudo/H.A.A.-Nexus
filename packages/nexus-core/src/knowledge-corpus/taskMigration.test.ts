import { describe, expect, it } from "vitest";
import { OpenResponseTaskSchema } from "./open-response.js";
import { KnowledgeCorpusSchema } from "./validate.js";

/**
 * O9 end to end: the migration engine's actual output, validated by the actual
 * contract.
 *
 * The engine is a zero-dependency `.mjs` tool and cannot import this Zod
 * schema, so without this test the two sides agree only by eye — and the
 * engine emits into a `.strict()` schema, where one undeclared key rejects the
 * whole record. This imports the real engine, runs it over the real corpus, and
 * parses every candidate it produces with the real schema.
 *
 * That makes "114 migratable" a verified claim rather than a counter the engine
 * printed about itself.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The tool lives outside the package, so this is a path import by design.
const enginePath = "../../../../tools/knowledge-corpus/kb-migrate.mjs";

// The engine derives its own REPO_ROOT from `import.meta.url`, which under
// vitest points inside this package rather than at the repository. So the test
// owns path resolution - it knows where it sits - and exercises the engine's
// pure transform with the real records and the real registry. The transform is
// what is under test; the engine's own file discovery is covered by its .mjs
// suite, where the paths do resolve.
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../../..");
const RECORDS = path.join(REPO, "knowledge-corpus", "records");

function realRecords(): { record: Record<string, unknown> }[] {
  const out: { record: Record<string, unknown> }[] = [];
  for (const batch of readdirSync(RECORDS)) {
    const dir = path.join(RECORDS, batch);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const parsed = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      for (const record of parsed.records ?? []) out.push({ record });
    }
  }
  return out;
}

function realRegistry(): { registryId: string; registryVersion: string; hints: Map<string, readonly number[]> } {
  const parsed = JSON.parse(
    readFileSync(path.join(REPO, "knowledge-corpus", "registries", "difficulty.json"), "utf8")
  );
  const hints = new Map<string, readonly number[]>();
  for (const band of parsed.bands ?? []) hints.set(band.id, [...(band.repositoryLevelHint ?? [])]);
  return { registryId: parsed.registryId, registryVersion: parsed.registryVersion, hints };
}

interface MigrationResult {
  id: string;
  recordType: string;
  target?: string;
  candidate: Record<string, unknown>;
  blockedOn: { field: string; why: string }[];
}

interface Engine {
  toOpenResponseTask: (entry: { record: Record<string, unknown> }, registry?: unknown) => MigrationResult;
  isFreeTextRecord: (record: Record<string, unknown>) => boolean;
}

const engine = (await import(enginePath)) as unknown as Engine;
const registry = realRegistry();
const entries = realRecords();
const freeText = entries.filter((e) => engine.isFreeTextRecord(e.record));
const tasks = freeText.map((e) => engine.toOpenResponseTask(e, registry));

describe("O9 migration: the engine's output satisfies the real contract", () => {
  it("finds the 114 free-text records", () => {
    expect(entries.length).toBe(432);
    expect(freeText.length).toBe(114);
  });

  it("EVERY candidate parses against OpenResponseTaskSchema", () => {
    // The claim that matters. A single undeclared key would fail here, because
    // the schema is strict.
    const failures: string[] = [];
    for (const t of tasks) {
      const parsed = OpenResponseTaskSchema.safeParse(t.candidate);
      if (!parsed.success) {
        failures.push(`${t.id}: ${JSON.stringify(parsed.error.issues)}`);
      }
    }
    expect(failures.slice(0, 3), `${failures.length} of ${tasks.length} failed`).toEqual([]);
    expect(failures.length).toBe(0);
  });

  it("reports none of them blocked, and the engine agrees", () => {
    for (const t of tasks) {
      expect(t.blockedOn, `${t.id} is blocked`).toEqual([]);
    }
    expect(tasks.filter((t) => t.blockedOn.length === 0).length).toBe(114);
  });

  it("the kinds match what the corpus carries", () => {
    const kinds = new Map<string, number>();
    for (const t of tasks) {
      const k = String(t.candidate.kind);
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    expect(Object.fromEntries([...kinds].sort())).toEqual({
      DOCUMENTATION_TASK: 59,
      QUESTION: 24,
      SCENARIO: 15,
      WORKFLOW: 16
    });
  });
});

describe("O9 migration: nothing is invented and nothing is advanced", () => {
  it("text moves verbatim - prompt and expectedOutput are untouched", () => {
    for (const e of freeText.slice(0, 40)) {
      const out = engine.toOpenResponseTask(e, registry);
      expect(out.candidate.prompt).toBe(e.record.prompt);
      expect(out.candidate.expectedOutput).toBe(e.record.expectedOutput);
    }
  });

  it("ids are carried verbatim", () => {
    for (const e of freeText) {
      expect(engine.toOpenResponseTask(e, registry).candidate.id).toBe(e.record.id);
    }
  });

  it("NO candidate is approved or production-eligible", () => {
    // A migration is not a reviewer. If this ever fails, generated clinical
    // content has been promoted without a human.
    for (const t of tasks) {
      expect(t.candidate.reviewStatus, `${t.id}`).not.toBe("approved");
      expect(t.candidate.contentStatus, `${t.id}`).not.toBe("production-eligible");
    }
  });

  it("review state is carried, not advanced", () => {
    for (const e of freeText.slice(0, 40)) {
      const out = engine.toOpenResponseTask(e, registry);
      expect(out.candidate.reviewStatus).toBe(e.record.reviewStatus);
      expect(out.candidate.contentStatus).toBe(e.record.contentStatus);
    }
  });

  it("every candidate declares HUMAN_REVIEW_REQUIRED scoring", () => {
    for (const t of tasks) {
      expect(t.candidate.scoringMode, `${t.id}`).toBe("HUMAN_REVIEW_REQUIRED");
    }
  });

  it("no candidate carries a choice-only key", () => {
    for (const t of tasks) {
      for (const key of ["choices", "correctChoiceId", "correctChoiceIds", "responseFormat"]) {
        expect(t.candidate[key], `${t.id} leaked ${key}`).toBeUndefined();
      }
    }
  });

  it("no candidate carries accessClasses or authoring metadata", () => {
    for (const t of tasks) {
      for (const key of ["accessClasses", "batchId", "packet", "fingerprints", "ownerRole", "createdAt"]) {
        expect(t.candidate[key], `${t.id} leaked ${key}`).toBeUndefined();
      }
    }
  });

  it("O4: the band is preserved and no numeric level is invented", () => {
    for (const t of tasks) {
      expect(t.candidate.difficultyBand, `${t.id}`).toBeDefined();
      expect(t.candidate.difficultyLevel, `${t.id} invented a level`).toBeUndefined();
    }
  });

  it("is deterministic - two runs produce identical candidates", () => {
    const again = freeText.map((e) => engine.toOpenResponseTask(e, registry));
    expect(JSON.stringify(again)).toBe(JSON.stringify(tasks));
  });
});

describe("O9 migration: the whole set loads as a corpus", () => {
  it("all 114 candidates load together in the container", () => {
    const corpus = KnowledgeCorpusSchema.safeParse({
      corpusId: "KB-MIGRATED",
      version: "1.0.0",
      tasks: tasks.map((t) => t.candidate)
    });
    expect(corpus.success, corpus.success ? "" : JSON.stringify(corpus.error?.issues.slice(0, 2))).toBe(
      true
    );
    if (!corpus.success) return;
    expect(corpus.data.tasks).toHaveLength(114);
  });

  it("their ids are unique, so nothing was duplicated", () => {
    const ids = new Set(tasks.map((t) => t.candidate.id));
    expect(ids.size).toBe(114);
  });
});
