import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ITEM_PRODUCTION_REQUIREMENTS,
  ItemDraftSchema,
  isItemDraft,
  itemDraftPromotionBlockers,
  mayPromoteItemDraft
} from "./item-draft.js";
import { AssessmentItemSchema } from "./item.js";
import { KnowledgeCorpusSchema } from "./validate.js";

/**
 * The 318-record ITEM draft migration, validated by the real contract.
 *
 * The engine is a zero-dependency `.mjs` tool and cannot import this schema, so
 * its own counters prove nothing about whether the records it emits are valid.
 * This imports the real engine, runs the real routing over the real corpus, and
 * parses every draft with the real `.strict()` `ItemDraftSchema`.
 *
 * The negative tests matter as much as the positive ones: a draft that could be
 * promoted while a requirement is unresolved, or that parsed as a production
 * ITEM, would defeat the whole boundary.
 */

const enginePath = "../../../../tools/knowledge-corpus/kb-migrate.mjs";

// The engine derives REPO_ROOT from `import.meta.url`, which under vitest
// points inside this package, so the test owns path resolution.
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../../..");

function realRecords(): { record: Record<string, unknown> }[] {
  const root = path.join(REPO, "knowledge-corpus", "records");
  const out: { record: Record<string, unknown> }[] = [];
  for (const batch of readdirSync(root)) {
    const dir = path.join(root, batch);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      for (const record of JSON.parse(readFileSync(path.join(dir, file), "utf8")).records ?? []) {
        out.push({ record });
      }
    }
  }
  return out;
}

function realRegistry() {
  const parsed = JSON.parse(
    readFileSync(path.join(REPO, "knowledge-corpus", "registries", "difficulty.json"), "utf8")
  );
  const hints = new Map<string, readonly number[]>();
  for (const band of parsed.bands ?? []) hints.set(band.id, [...(band.repositoryLevelHint ?? [])]);
  return { registryId: parsed.registryId, registryVersion: parsed.registryVersion, hints };
}

interface Result {
  id: string;
  target?: string;
  candidate: Record<string, unknown>;
  blockedOn: { field: string; why: string }[];
}

interface Engine {
  isFreeTextRecord: (r: Record<string, unknown>) => boolean;
  transformRecord: (e: { record: Record<string, unknown> }, registry?: unknown) => Result;
  toItemDraft: (e: { record: Record<string, unknown> }, item: Result) => Result;
  toOpenResponseTask: (e: { record: Record<string, unknown> }, registry?: unknown) => Result;
}

const engine = (await import(enginePath)) as unknown as Engine;
const registry = realRegistry();
const entries = realRecords();

/** The engine's own three-way routing, reproduced exactly. */
function route(e: { record: Record<string, unknown> }): Result {
  if (engine.isFreeTextRecord(e.record)) return engine.toOpenResponseTask(e, registry);
  const item = engine.transformRecord(e, registry);
  if (item.blockedOn.length === 0) return { ...item, target: "ITEM" };
  return engine.toItemDraft(e, item);
}

const routed = entries.map(route);
const allDrafts = routed.filter((r) => r.target === "ITEM_DRAFT");
// 24 records declare a lifecycle status contract B does not define, so they are
// blocked rather than relabelled. The represented set is what must validate.
const drafts = allDrafts.filter((r) => r.blockedOn.length === 0);
const blockedDrafts = allDrafts.filter((r) => r.blockedOn.length > 0);
const tasks = routed.filter((r) => r.target === "TASK");

describe("every source record is accounted for exactly once", () => {
  it("routes all 432 records, with no record in two families", () => {
    expect(entries.length).toBe(432);
    expect(routed.length).toBe(432);
    expect(allDrafts.length + tasks.length).toBe(432);
    expect(allDrafts.length).toBe(318);
    expect(drafts.length).toBe(294);
    expect(blockedDrafts.length).toBe(24);
    expect(tasks.length).toBe(114);
  });

  it("emits no duplicate candidate id, across both families", () => {
    const ids = routed.map((r) => String(r.candidate.id));
    expect(new Set(ids).size).toBe(432);
  });

  it("every candidate id matches its source record id", () => {
    for (const r of routed) expect(r.candidate.id).toBe(r.id);
  });
});

describe("every draft parses against the real strict ItemDraftSchema", () => {
  it("all 294 representable drafts parse", () => {
    const failures: string[] = [];
    for (const d of drafts) {
      const parsed = ItemDraftSchema.safeParse(d.candidate);
      if (!parsed.success) failures.push(`${d.id}: ${JSON.stringify(parsed.error.issues)}`);
    }
    expect(failures.slice(0, 2), `${failures.length} of ${drafts.length} failed`).toEqual([]);
    expect(failures.length).toBe(0);
  });

  it("the 24 blocked records are named, not silently dropped", () => {
    // Accounted for as blocked with a reason, which is an outcome - not lost.
    expect(blockedDrafts.length).toBe(24);
    for (const d of blockedDrafts) {
      expect(d.blockedOn.length, `${d.id}`).toBeGreaterThan(0);
      expect(d.blockedOn.map((b) => b.field)).toContain("contentStatus");
    }
    // And they emit no candidate that could be mistaken for valid.
    for (const d of blockedDrafts) {
      expect(ItemDraftSchema.safeParse(d.candidate).success, `${d.id} must not validate`).toBe(false);
    }
  });

  it("all 294 load together in the container's itemDrafts array", () => {
    const corpus = KnowledgeCorpusSchema.safeParse({
      corpusId: "KB-MIGRATED",
      version: "1.0.0",
      itemDrafts: drafts.map((d) => d.candidate)
    });
    expect(corpus.success, corpus.success ? "" : JSON.stringify(corpus.error?.issues.slice(0, 2))).toBe(true);
    if (!corpus.success) return;
    expect(corpus.data.itemDrafts).toHaveLength(294);
    // Staged apart from production items, which is what keeps them off a
    // delivery path.
    expect(corpus.data.items).toEqual([]);
  });
});

describe("unresolved requirements are explicit and accurate", () => {
  it("every draft declares a non-empty unresolved list", () => {
    for (const d of drafts) {
      const unresolved = d.candidate.unresolved as string[] | undefined;
      expect(unresolved, `${d.id}`).toBeDefined();
      expect(unresolved!.length, `${d.id}`).toBeGreaterThan(0);
    }
  });

  it("every declared requirement is a real ITEM requirement", () => {
    for (const d of drafts) {
      for (const f of d.candidate.unresolved as string[]) {
        expect(ITEM_PRODUCTION_REQUIREMENTS, `${d.id}: ${f}`).toContain(f);
      }
    }
  });

  it("the distribution matches what the corpus actually lacks", () => {
    // Measured independently of the engine: all 318 lack the same four fields,
    // and only the 42 EASY-band records lack a verified difficulty level.
    const counts = new Map<string, number>();
    for (const d of drafts) {
      for (const f of d.candidate.unresolved as string[]) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    expect(counts.get("skillArea")).toBe(294);
    expect(counts.get("learningObjective")).toBe(294);
    expect(counts.get("questionType")).toBe(294);
    expect(counts.get("source")).toBe(294);
    expect(counts.get("difficultyLevel")).toBe(42);
  });

  it("a verified difficulty level is carried, not listed as unresolved", () => {
    // The two cases must stay distinguishable: 276 have evidence, 42 do not.
    const withLevel = drafts.filter((d) => d.candidate.difficultyLevel !== undefined);
    expect(withLevel.length).toBe(252);
    for (const d of withLevel) {
      expect(d.candidate.unresolved as string[]).not.toContain("difficultyLevel");
    }
  });
});

describe("NEGATIVE: a draft cannot become production content", () => {
  it("no draft parses as a production ITEM", () => {
    // The boundary's whole point. If one did, the ITEM contract would have been
    // relaxed somewhere.
    for (const d of drafts.slice(0, 40)) {
      expect(AssessmentItemSchema.safeParse(d.candidate).success, `${d.id}`).toBe(false);
    }
  });

  it("promotion is refused while anything is unresolved", () => {
    for (const d of drafts.slice(0, 40)) {
      const parsed = ItemDraftSchema.parse(d.candidate);
      expect(mayPromoteItemDraft(parsed), `${d.id}`).toBe(false);
      expect(itemDraftPromotionBlockers(parsed).length).toBeGreaterThan(0);
    }
  });

  it("promotion names every unresolved requirement as a reason", () => {
    const parsed = ItemDraftSchema.parse(drafts[0]!.candidate);
    const reasons = itemDraftPromotionBlockers(parsed).join(" ");
    for (const f of parsed.unresolved) expect(reasons).toContain(f);
  });

  it("refuses promotion even when review has approved it", () => {
    // Structural completeness and approval are different things. An approved
    // record that still lacks a required field is still not an item.
    const parsed = ItemDraftSchema.parse({
      ...drafts[0]!.candidate,
      reviewStatus: "approved",
      flags: []
    });
    expect(mayPromoteItemDraft(parsed)).toBe(false);
    expect(itemDraftPromotionBlockers(parsed).join(" ")).toMatch(/unresolved/);
  });

  it("rejects a draft that declares nothing unresolved", () => {
    // A record with nothing missing is an item, and the schema says so.
    const { unresolved: _omit, ...withoutList } = drafts[0]!.candidate;
    expect(ItemDraftSchema.safeParse(withoutList).success).toBe(false);
    expect(ItemDraftSchema.safeParse({ ...drafts[0]!.candidate, unresolved: [] }).success).toBe(false);
  });

  it("rejects an invented requirement name", () => {
    expect(
      ItemDraftSchema.safeParse({ ...drafts[0]!.candidate, unresolved: ["vibes"] }).success
    ).toBe(false);
  });

  it("rejects a repeated requirement", () => {
    expect(
      ItemDraftSchema.safeParse({
        ...drafts[0]!.candidate,
        unresolved: ["skillArea", "skillArea"]
      }).success
    ).toBe(false);
  });

  it("rejects an unknown key, so nothing smuggles through", () => {
    expect(ItemDraftSchema.safeParse({ ...drafts[0]!.candidate, skillArea: "Privacy" }).success).toBe(
      false
    );
  });

  it("no draft is approved or production-eligible", () => {
    for (const d of drafts) {
      expect(d.candidate.reviewStatus, `${d.id}`).not.toBe("approved");
      expect(d.candidate.contentStatus, `${d.id}`).not.toBe("production-eligible");
    }
  });

  it("drafts are identifiable at runtime, so a consumer can refuse them", () => {
    expect(isItemDraft(ItemDraftSchema.parse(drafts[0]!.candidate))).toBe(true);
    expect(isItemDraft({ family: "ITEM" })).toBe(false);
  });
});

describe("no fabrication, and the source is untouched", () => {
  it("never invents any of the four missing fields", () => {
    for (const d of drafts) {
      for (const f of ["skillArea", "learningObjective", "questionType", "source"]) {
        expect(d.candidate[f], `${d.id} invented ${f}`).toBeUndefined();
      }
    }
  });

  it("carries question, choices and rationale verbatim", () => {
    for (const e of entries.filter((x) => !engine.isFreeTextRecord(x.record)).slice(0, 40)) {
      const d = route(e);
      expect(d.candidate.question).toBe(e.record.prompt);
      expect(d.candidate.rationale).toBe(e.record.rationale);
      expect(d.candidate.choices).toEqual(e.record.choices);
    }
  });

  it("carries review and lifecycle state without advancing it", () => {
    for (const e of entries.filter((x) => !engine.isFreeTextRecord(x.record)).slice(0, 40)) {
      const d = route(e);
      expect(d.candidate.reviewStatus).toBe(e.record.reviewStatus);
      expect(d.candidate.contentStatus).toBe(e.record.contentStatus);
    }
  });

  it("leaks no accessClasses or authoring metadata", () => {
    for (const d of drafts) {
      for (const k of ["accessClasses", "batchId", "packet", "fingerprints", "ownerRole", "createdAt"]) {
        expect(d.candidate[k], `${d.id} leaked ${k}`).toBeUndefined();
      }
    }
  });

  it("does not mutate the source records", () => {
    // The transform must be pure with respect to its input.
    const before = JSON.stringify(entries.map((e) => e.record));
    entries.map(route);
    expect(JSON.stringify(entries.map((e) => e.record))).toBe(before);
  });

  it("is deterministic across runs", () => {
    expect(JSON.stringify(entries.map(route))).toBe(JSON.stringify(routed));
  });
});

describe("the TASK migration is unaffected", () => {
  it("still routes 114 free-text records, none blocked", () => {
    expect(tasks.length).toBe(114);
    for (const t of tasks) expect(t.blockedOn, `${t.id}`).toEqual([]);
  });

  it("no task was rerouted into the draft family", () => {
    for (const t of tasks) expect(t.candidate.family).toBe("TASK");
    for (const d of allDrafts) expect(d.candidate.family).toBe("ITEM_DRAFT");
  });
});
