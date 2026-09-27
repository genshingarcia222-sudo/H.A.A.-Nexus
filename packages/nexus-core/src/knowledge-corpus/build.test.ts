import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCorpus, canonicalJson, detectUnbumpedRevisions, diffPartitions, invalidationReport } from "./build.js";
import type { CorpusSourceFile } from "./build.js";

/**
 * D12 work package 5 — the deterministic build.
 *
 * The property that matters: same inputs, byte-identical output. Everything
 * else here protects it — no clock, no directory-order dependence, and no
 * partial bundle when validation fails.
 */

const hash = (input: string) => createHash("sha256").update(input, "utf-8").digest("hex");
const ASOF = "2026-09-25";
const build = (files: CorpusSourceFile[], asOf = ASOF) => buildCorpus(files, { asOf, hash });

const provenance = {
  generationMethod: "MACHINE_DRAFTED",
  authoredBy: "machine:claude-code",
  authoredOn: "2026-09-21"
};

const sourcesFile: CorpusSourceFile = {
  path: "content/knowledge/sources/privacy.json",
  contents: JSON.stringify({
    corpusId: "NEXUS-KNOWLEDGE",
    version: "1",
    sources: [
      {
        id: "HHS-PR-SUMMARY",
        authority: "U.S. HHS Office for Civil Rights",
        authorityClass: "OFFICIAL_GUIDANCE",
        title: "Summary of the HIPAA Privacy Rule",
        jurisdiction: "US",
        snapshotHash: "hhs-v1"
      }
    ]
  })
};

const knowledgeRecord = {
  id: "NEXUS-KR-PRIV-000001",
  family: "KNOWLEDGE",
  revision: 1,
  kind: "RULE",
  domain: "Medical Scribing",
  topic: "Privacy & Confidentiality",
  title: "Minimum necessary standard",
  statement: "A covered entity must limit uses and disclosures to the minimum necessary.",
  evidence: [{ ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" }],
  applicability: { jurisdictions: ["US"], effectiveTo: "2026-10-20" },
  contentStatus: "candidate",
  reviewStatus: "pending",
  flags: ["HUMAN-VERIFY-REQUIRED"],
  provenance
};

const knowledgeFile = (record: unknown = knowledgeRecord): CorpusSourceFile => ({
  path: "content/knowledge/knowledge/privacy.json",
  contents: JSON.stringify({ corpusId: "NEXUS-KNOWLEDGE", version: "1", knowledge: [record] })
});

describe("canonical output", () => {
  it("sorts keys, keeps array order and ends with a newline", () => {
    const json = canonicalJson({ b: 1, a: [{ z: 1, y: 2 }] });
    expect(json).toBe('{\n  "a": [\n    {\n      "y": 2,\n      "z": 1\n    }\n  ],\n  "b": 1\n}\n');
  });

  it("does not reorder arrays, because their order is content", () => {
    // A SOAP note's segments and a workflow's canonical steps are meaning.
    const json = canonicalJson({ steps: ["s3", "s1", "s2"] });
    expect(json).toContain('"s3"');
    expect(JSON.parse(json).steps).toEqual(["s3", "s1", "s2"]);
  });
});

describe("determinism", () => {
  it("produces a byte-identical bundle and release id on a rebuild", () => {
    const first = build([sourcesFile, knowledgeFile()]);
    const second = build([sourcesFile, knowledgeFile()]);
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.release.bundle).toBe(first.release.bundle);
    expect(second.release.releaseId).toBe(first.release.releaseId);
  });

  it("does not depend on the order files arrive in", () => {
    // Two files feeding the *same* family, so the merge order is what the
    // path sort decides. Without the sort, a directory listing's order would
    // change the bundle bytes and therefore the release id.
    const second: CorpusSourceFile = {
      path: "content/knowledge/knowledge/zz-privacy.json",
      contents: JSON.stringify({
        corpusId: "NEXUS-KNOWLEDGE",
        version: "1",
        knowledge: [{ ...knowledgeRecord, id: "NEXUS-KR-PRIV-000002", title: "A second rule" }]
      })
    };
    const forward = build([sourcesFile, knowledgeFile(), second]);
    const reversed = build([second, knowledgeFile(), sourcesFile]);
    expect(forward.success && reversed.success).toBe(true);
    if (!forward.success || !reversed.success) return;
    expect(reversed.release.bundle).toBe(forward.release.bundle);
    expect(reversed.release.releaseId).toBe(forward.release.releaseId);
    expect(forward.release.corpus.knowledge.map((record) => record.id)).toEqual([
      "NEXUS-KR-PRIV-000001",
      "NEXUS-KR-PRIV-000002"
    ]);
  });

  it("does not depend on the date the build runs", () => {
    const today = build([sourcesFile, knowledgeFile()], "2026-09-25");
    const nextYear = build([sourcesFile, knowledgeFile()], "2027-05-01");
    expect(today.success && nextYear.success).toBe(true);
    if (!today.success || !nextYear.success) return;
    // The bundle is identical; only the *report* about it differs.
    expect(nextYear.release.releaseId).toBe(today.release.releaseId);
    expect(nextYear.release.upcoming).not.toEqual(today.release.upcoming);
  });

  it("changes the release id when content changes", () => {
    const before = build([sourcesFile, knowledgeFile()]);
    const after = build([sourcesFile, knowledgeFile({ ...knowledgeRecord, revision: 2, title: "Minimum necessary" })]);
    expect(before.success && after.success).toBe(true);
    if (!before.success || !after.success) return;
    expect(after.release.releaseId).not.toBe(before.release.releaseId);
  });
});

describe("merging authoring files", () => {
  it("merges families across files and counts them", () => {
    const result = build([sourcesFile, knowledgeFile()]);
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
    if (!result.success) return;
    expect(result.release.counts).toMatchObject({ sources: 1, knowledge: 1, items: 0 });
    expect(result.release.corpusId).toBe("NEXUS-KNOWLEDGE");
  });

  it("indexes each partition by path, hash and the ids it contributes", () => {
    const result = build([sourcesFile, knowledgeFile()]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const partition = result.release.partitions.find((entry) => entry.path.endsWith("knowledge/privacy.json"));
    expect(partition?.recordIds).toEqual(["NEXUS-KR-PRIV-000001"]);
    expect(partition?.hash).toHaveLength(64);
  });

  it("refuses files that disagree about the corpus identity", () => {
    const other: CorpusSourceFile = {
      path: "content/knowledge/knowledge/other.json",
      contents: JSON.stringify({ corpusId: "SOMETHING-ELSE", version: "1", knowledge: [] })
    };
    const result = build([sourcesFile, other]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("disagrees");
  });

  it("reports malformed JSON by path", () => {
    const result = build([sourcesFile, { path: "content/knowledge/broken.json", contents: "{ not json" }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("content/knowledge/broken.json");
  });

  it("emits nothing at all when validation fails", () => {
    // A partial bundle is worse than none: it looks like a release.
    const dangling = knowledgeFile({
      ...knowledgeRecord,
      evidence: [{ ref: "NOT-A-SOURCE", locator: "x" }]
    });
    const result = build([sourcesFile, dangling]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("NOT-A-SOURCE");
  });

  it("refuses two files defining the same id rather than letting one win", () => {
    const result = build([sourcesFile, knowledgeFile(), { ...knowledgeFile(), path: "content/knowledge/knowledge/copy.json" }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("duplicate record id");
  });
});

describe("the release reports what is about to change", () => {
  it("lists records changing temporal state within the window", () => {
    const result = build([sourcesFile, knowledgeFile()], "2026-09-25");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.release.upcoming.map((entry) => `${entry.id}:${entry.becomes}`)).toEqual([
      "NEXUS-KR-PRIV-000001:EXPIRED"
    ]);
  });

  it("says nothing when the change is far away", () => {
    const result = build([sourcesFile, knowledgeFile()], "2026-01-01");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.release.upcoming).toEqual([]);
  });
});

describe("incremental builds", () => {
  it("names which partitions were added, changed, removed or left alone", () => {
    const before = build([sourcesFile, knowledgeFile()]);
    const after = build([sourcesFile, knowledgeFile({ ...knowledgeRecord, revision: 2 })]);
    expect(before.success && after.success).toBe(true);
    if (!before.success || !after.success) return;
    const changes = diffPartitions(before.release.partitions, after.release.partitions);
    expect(changes).toEqual([
      { path: "content/knowledge/knowledge/privacy.json", change: "changed" },
      { path: "content/knowledge/sources/privacy.json", change: "unchanged" }
    ]);
  });

  it("reports an added and a removed partition", () => {
    const before = build([sourcesFile]);
    const after = build([knowledgeFile()]);
    expect(before.success && after.success).toBe(false); // knowledge alone has a dangling ref
    const changes = diffPartitions(
      [{ path: "a.json", hash: "1", recordIds: [] }],
      [{ path: "b.json", hash: "2", recordIds: [] }]
    );
    expect(changes).toEqual([
      { path: "a.json", change: "removed" },
      { path: "b.json", change: "added" }
    ]);
  });
});

describe("source-change invalidation", () => {
  const verifiedRecord = {
    ...knowledgeRecord,
    contentStatus: "source-verified",
    reviewStatus: "in-review",
    flags: [],
    verification: {
      humanVerificationRequired: true,
      humanVerifiedBy: "REV-ANA",
      humanVerifiedOn: "2026-09-22",
      reviewedSourceSnapshots: ["hhs-v1"]
    }
  };
  const reviewFile: CorpusSourceFile = {
    path: "content/knowledge/reviews/privacy.json",
    contents: JSON.stringify({
      corpusId: "NEXUS-KNOWLEDGE",
      version: "1",
      reviewers: [{ id: "REV-ANA", displayName: "A. Reviewer" }],
      reviews: [
        {
          id: "REVIEW-0001",
          reviewerId: "REV-ANA",
          reviewedOn: "2026-09-22",
          target: "NEXUS-KR-PRIV-000001@1",
          stage: "SOURCE",
          decision: "APPROVE",
          sourceSnapshots: ["hhs-v1"]
        }
      ]
    })
  };
  const movedSource: CorpusSourceFile = {
    ...sourcesFile,
    contents: sourcesFile.contents.replace("hhs-v1", "hhs-v2")
  };

  it("says nothing while the source is the one that was reviewed", () => {
    const result = build([sourcesFile, knowledgeFile(verifiedRecord), reviewFile]);
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
    if (!result.success) return;
    expect(invalidationReport(result.release.corpus)).toEqual([]);
  });

  it("reports a record whose source has moved, without changing the record", () => {
    const result = build([movedSource, knowledgeFile(verifiedRecord), reviewFile]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const report = invalidationReport(result.release.corpus);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ id: "NEXUS-KR-PRIV-000001", reason: "SOURCE_CHANGED" });
    // The record itself is untouched: invalidation derives, it does not edit.
    expect(result.release.corpus.knowledge[0]?.contentStatus).toBe("source-verified");
  });

  it("reports a withdrawn source", () => {
    const parsed = JSON.parse(sourcesFile.contents) as { sources: Record<string, unknown>[] };
    const withdrawn: CorpusSourceFile = {
      ...sourcesFile,
      contents: JSON.stringify({ ...parsed, sources: [{ ...parsed.sources[0], status: "withdrawn" }] })
    };
    const result = build([withdrawn, knowledgeFile(verifiedRecord), reviewFile]);
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
    if (!result.success) return;
    expect(invalidationReport(result.release.corpus)[0]?.reason).toBe("SOURCE_WITHDRAWN");
  });

  it("does not invalidate a candidate nobody had verified", () => {
    const result = build([movedSource, knowledgeFile()]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(invalidationReport(result.release.corpus)).toEqual([]);
  });
});

describe("revisions must move when content does", () => {
  it("catches a record edited at the same revision", () => {
    const before = build([sourcesFile, knowledgeFile()]);
    const after = build([sourcesFile, knowledgeFile({ ...knowledgeRecord, statement: "Quietly different." })]);
    expect(before.success && after.success).toBe(true);
    if (!before.success || !after.success) return;
    const violations = detectUnbumpedRevisions(before.release.corpus, after.release.corpus);
    expect(violations.map((violation) => violation.id)).toEqual(["NEXUS-KR-PRIV-000001"]);
  });

  it("accepts the same edit with a bumped revision", () => {
    const before = build([sourcesFile, knowledgeFile()]);
    const after = build([
      sourcesFile,
      knowledgeFile({ ...knowledgeRecord, revision: 2, statement: "Openly different." })
    ]);
    expect(before.success && after.success).toBe(true);
    if (!before.success || !after.success) return;
    expect(detectUnbumpedRevisions(before.release.corpus, after.release.corpus)).toEqual([]);
  });

  it("says nothing about a record that is simply new", () => {
    const before = build([sourcesFile]);
    const after = build([sourcesFile, knowledgeFile()]);
    expect(after.success).toBe(true);
    if (!before.success || !after.success) return;
    expect(detectUnbumpedRevisions(before.release.corpus, after.release.corpus)).toEqual([]);
  });
});
