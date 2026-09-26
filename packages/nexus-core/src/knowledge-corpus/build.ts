import { validateKnowledgeCorpus } from "./validate.js";
import type { KnowledgeCorpus } from "./validate.js";
import { effectiveWindow } from "./eligibility.js";
import { upcomingTransitions } from "./temporal.js";
import type { UpcomingTransition } from "./temporal.js";

/**
 * The corpus build (D12-31 … D12-34).
 *
 * A **pure function of its inputs**: the authoring files sorted by path, the
 * schema version, and the build version. No clock, no network, no randomness,
 * no environment. Building the same inputs twice must produce byte-identical
 * output, which is what makes a release something you can point at rather than
 * something you hope was made the same way.
 *
 * Note the two things this module deliberately does not do. It does not
 * *generate* content — machine drafting happens offline and lands as
 * candidates, never as a release. And it does not repair: a corpus that fails
 * validation produces no release at all, rather than a partial one that looks
 * usable.
 */

/** One authoring file, as read from disk. */
export interface CorpusSourceFile {
  /** Repository-relative path. Sorted, so the build order never depends on a directory listing. */
  path: string;
  contents: string;
}

export interface CorpusPartition {
  path: string;
  /** SHA-256 of the file's bytes, for incremental builds. */
  hash: string;
  recordIds: string[];
}

export interface CorpusRelease {
  releaseId: string;
  corpusId: string;
  version: string;
  /** The canonical JSON the release *is*. Byte-identical across rebuilds. */
  bundle: string;
  corpus: KnowledgeCorpus;
  partitions: CorpusPartition[];
  /** Records changing temporal state soon, so re-verification can be scheduled. */
  upcoming: UpcomingTransition[];
  counts: {
    sources: number;
    knowledge: number;
    contexts: number;
    concepts: number;
    items: number;
    reviews: number;
    openConflicts: number;
  };
}

export type CorpusBuildResult =
  | { success: true; release: CorpusRelease }
  | { success: false; errors: string[] };

export interface BuildOptions {
  /** The date the report is computed against. Required: the build never reads a clock. */
  asOf: string;
  /** Hash function, injected so this module stays free of Node built-ins. */
  hash: (input: string) => string;
  /** How far ahead to report temporal transitions. */
  upcomingWithinDays?: number;
}

/**
 * Canonical JSON: keys sorted, arrays left in authored order, two-space
 * indentation, LF, trailing newline.
 *
 * Key order is the only thing normalised. Array order is *authored meaning* —
 * the order of a SOAP note's segments or a workflow's canonical steps is
 * content, not formatting — so it is never touched.
 */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, entry]) => [key, sortKeys(entry)]));
  }
  return value;
}

/** Every record id a file contributes, for the partition index. */
function idsIn(parsed: unknown): string[] {
  const ids: string[] = [];
  const record = parsed as Record<string, unknown[]> | null;
  if (!record || typeof record !== "object") return ids;
  for (const key of ["sources", "knowledge", "contexts", "concepts", "items", "competencies", "reviewers", "reviews", "conflicts"]) {
    for (const entry of record[key] ?? []) {
      const candidate = entry as { id?: string; questionId?: string };
      const id = candidate.questionId ?? candidate.id;
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
}

/**
 * Merges authoring files into one corpus and validates the whole thing.
 *
 * Files are merged, not overlaid: two files defining the same id is a
 * duplicate-id error from the validator, not a silent last-one-wins.
 */
export function buildCorpus(files: CorpusSourceFile[], options: BuildOptions): CorpusBuildResult {
  const errors: string[] = [];
  const ordered = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const merged: Record<string, unknown[]> = {
    sources: [],
    knowledge: [],
    contexts: [],
    concepts: [],
    items: [],
    competencies: [],
    reviewers: [],
    reviews: [],
    conflicts: []
  };
  let corpusId: string | undefined;
  let version: string | undefined;
  const partitions: CorpusPartition[] = [];

  for (const file of ordered) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.contents);
    } catch (error) {
      errors.push(`${file.path}: not valid JSON (${error instanceof Error ? error.message : "unknown error"})`);
      continue;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.corpusId === "string") {
      if (corpusId && corpusId !== record.corpusId) {
        errors.push(`${file.path}: corpusId "${record.corpusId}" disagrees with "${corpusId}"`);
      }
      corpusId = record.corpusId;
    }
    if (typeof record.version === "string") {
      if (version && version !== record.version) {
        errors.push(`${file.path}: version "${record.version}" disagrees with "${version}"`);
      }
      version = record.version;
    }

    for (const key of Object.keys(merged)) {
      const entries = record[key];
      if (entries === undefined) continue;
      if (!Array.isArray(entries)) {
        errors.push(`${file.path}: "${key}" must be an array`);
        continue;
      }
      merged[key]!.push(...entries);
    }

    partitions.push({ path: file.path, hash: options.hash(file.contents), recordIds: idsIn(parsed) });
  }

  if (!corpusId) errors.push("(corpus): no file declares a corpusId");
  if (!version) errors.push("(corpus): no file declares a version");
  if (errors.length > 0) return { success: false, errors };

  const validated = validateKnowledgeCorpus({ corpusId, version, ...merged });
  if (!validated.success) {
    // A failed validation emits nothing. A partial bundle is worse than no
    // bundle: it looks like a release.
    return { success: false, errors: validated.errors };
  }

  const corpus = validated.data;
  const bundle = canonicalJson(corpus);
  const releaseId = options.hash(bundle);

  const windows = [
    ...corpus.knowledge.map((record) => ({ id: record.id, window: effectiveWindow(record, corpus) })),
    ...corpus.items.map((record) => ({ id: record.questionId, window: effectiveWindow(record, corpus) }))
  ];

  return {
    success: true,
    release: {
      releaseId,
      corpusId: corpus.corpusId,
      version: corpus.version,
      bundle,
      corpus,
      partitions,
      upcoming: upcomingTransitions(windows, options.asOf, options.upcomingWithinDays ?? 60),
      counts: {
        sources: corpus.sources.length,
        knowledge: corpus.knowledge.length,
        contexts: corpus.contexts.length,
        concepts: corpus.concepts.length,
        items: corpus.items.length,
        reviews: corpus.reviews.length,
        openConflicts: corpus.conflicts.filter((conflict) => conflict.status === "open").length
      }
    }
  };
}

export interface PartitionChange {
  path: string;
  change: "added" | "changed" | "removed" | "unchanged";
}

/**
 * Which partitions moved between two releases (D12-32).
 *
 * Incremental builds re-validate only changed partitions, but cross-reference
 * validation always runs over the whole index — it is index-sized, not
 * content-sized, and a reference can break because something *else* changed.
 */
export function diffPartitions(previous: CorpusPartition[], next: CorpusPartition[]): PartitionChange[] {
  const before = new Map(previous.map((partition) => [partition.path, partition.hash]));
  const after = new Map(next.map((partition) => [partition.path, partition.hash]));
  const changes: PartitionChange[] = [];

  for (const [path, hash] of after) {
    const previousHash = before.get(path);
    if (previousHash === undefined) changes.push({ path, change: "added" });
    else if (previousHash !== hash) changes.push({ path, change: "changed" });
    else changes.push({ path, change: "unchanged" });
  }
  for (const [path] of before) {
    if (!after.has(path)) changes.push({ path, change: "removed" });
  }

  return changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface Invalidation {
  id: string;
  sourceRef: string;
  reason: "SOURCE_CHANGED" | "SOURCE_SUPERSEDED" | "SOURCE_WITHDRAWN";
  detail: string;
}

/**
 * Records whose evidence has moved underneath them (D12-34).
 *
 * **Derives; never mutates.** No record's status is rewritten because a source
 * changed — the record simply stops satisfying `isDeliverable` until a reviewer
 * looks at the new bytes. A build that silently downgraded records would lose
 * the very history a reviewer needs to see.
 */
export function invalidationReport(corpus: KnowledgeCorpus): Invalidation[] {
  const invalidations: Invalidation[] = [];
  const sourcesById = new Map(corpus.sources.map((source) => [source.id, source]));

  const cited = (record: { evidence?: { ref: string }[] } & Record<string, unknown>): string[] => {
    if (Array.isArray(record.evidence)) return record.evidence.map((link) => link.ref);
    const refs: string[] = [];
    const source = record.source as { ref?: string } | undefined;
    if (source?.ref) refs.push(source.ref);
    for (const link of (record.additionalEvidence as { ref: string }[] | undefined) ?? []) refs.push(link.ref);
    return refs;
  };

  const subjects: { id: string; refs: string[]; reviewed: Set<string> }[] = [
    ...corpus.knowledge.map((record) => ({
      id: record.id,
      refs: cited(record),
      reviewed: new Set(record.verification?.reviewedSourceSnapshots ?? [])
    })),
    ...corpus.contexts.map((record) => ({
      id: record.id,
      refs: cited(record),
      reviewed: new Set(record.verification?.reviewedSourceSnapshots ?? [])
    })),
    ...corpus.items.map((record) => ({
      id: record.questionId,
      refs: cited(record as unknown as Record<string, unknown>),
      reviewed: new Set(record.verification?.reviewedSourceSnapshots ?? [])
    }))
  ];

  for (const subject of subjects) {
    // A record nobody has verified yet cannot be *invalidated* by a source
    // change: it was never resting on those bytes in the first place.
    if (subject.reviewed.size === 0) continue;
    for (const ref of subject.refs) {
      const source = sourcesById.get(ref);
      if (!source) continue;
      if (source.status === "superseded") {
        invalidations.push({
          id: subject.id,
          sourceRef: ref,
          reason: "SOURCE_SUPERSEDED",
          detail: `superseded by ${source.supersededBy ?? "an unnamed edition"}`
        });
        continue;
      }
      if (source.status === "withdrawn") {
        invalidations.push({ id: subject.id, sourceRef: ref, reason: "SOURCE_WITHDRAWN", detail: "source withdrawn" });
        continue;
      }
      if (source.snapshotHash && !subject.reviewed.has(source.snapshotHash)) {
        invalidations.push({
          id: subject.id,
          sourceRef: ref,
          reason: "SOURCE_CHANGED",
          detail: `source now hashes to ${source.snapshotHash}, which no review records`
        });
      }
    }
  }

  return invalidations.sort((a, b) => a.id.localeCompare(b.id) || a.sourceRef.localeCompare(b.sourceRef));
}

export interface RevisionViolation {
  id: string;
  revision: number;
  message: string;
}

/**
 * Content that changed without its revision moving (D12-21).
 *
 * Silently editing a record at the same revision is how a reviewer's approval
 * comes to cover words nobody approved. The build refuses it.
 */
export function detectUnbumpedRevisions(previous: KnowledgeCorpus, next: KnowledgeCorpus): RevisionViolation[] {
  const violations: RevisionViolation[] = [];
  const digest = (record: unknown) => canonicalJson(record);

  const index = (corpus: KnowledgeCorpus) => {
    const map = new Map<string, { revision: number; digest: string }>();
    for (const record of [...corpus.knowledge, ...corpus.contexts, ...corpus.concepts]) {
      map.set(record.id, { revision: record.revision, digest: digest(record) });
    }
    for (const record of corpus.items) {
      map.set(record.questionId, { revision: record.revision, digest: digest(record) });
    }
    return map;
  };

  const before = index(previous);
  for (const [id, after] of index(next)) {
    const earlier = before.get(id);
    if (!earlier) continue;
    if (earlier.revision === after.revision && earlier.digest !== after.digest) {
      violations.push({
        id,
        revision: after.revision,
        message: `"${id}" changed without bumping revision ${after.revision}`
      });
    }
  }
  return violations;
}
