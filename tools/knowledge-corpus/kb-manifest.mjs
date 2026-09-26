// Builds the canonical corpus manifest — the primary recovery point for a future
// session that has lost its conversation.
//
// Everything in it is measured from the files on disk at the moment it runs.
// Nothing is carried over from a previous manifest, so a stale count cannot
// survive a regeneration.
//
//   node tools/knowledge-corpus/kb-manifest.mjs
//   node tools/knowledge-corpus/kb-manifest.mjs --check   verify, do not write
//
// --check exits 1 if the manifest on disk disagrees with the corpus, which is how
// a commit that changed records without refreshing the manifest is caught.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./kb-validate.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CORPUS_ROOT = path.join(REPO_ROOT, "knowledge-corpus");
const MANIFEST_PATH = path.join(CORPUS_ROOT, "manifests/corpus-manifest.json");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function checksumTree(relativeDir) {
  const absolute = path.join(CORPUS_ROOT, relativeDir);
  if (!existsSync(absolute)) return {};
  const out = {};
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) Object.assign(out, checksumTree(relative));
    else if (entry.name.endsWith(".json")) out[relative] = sha256(readFileSync(path.join(CORPUS_ROOT, relative)));
  }
  return out;
}

export function buildManifest() {
  const report = validate({});
  const card = report.scorecard;

  const checksums = {
    ...checksumTree("registries"),
    ...checksumTree("schema"),
    ...checksumTree("sources"),
    ...checksumTree("records")
  };

  const batches = existsSync(path.join(CORPUS_ROOT, "records"))
    ? readdirSync(path.join(CORPUS_ROOT, "records"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  return {
    manifestId: "KB-CORPUS-MANIFEST",
    manifestVersion: "1.0.0",
    generatedOn: "2026-09-26",
    sourceArchiveVersion: {
      declared: "Nexus Knowledgebase Archive v1.0",
      presentInRepository: false,
      note:
        "Neither nexus_knowledgebase_materials_v1.md nor Nexus_Knowledgebase_Archive_v1.0.pdf is present in the repository or in this session's filesystem. See knowledge-corpus/source/SOURCE_RECONCILIATION_v1.md. The 400 seed records that archive describes are therefore NOT in this corpus, and no part of them has been reconstructed from memory."
    },
    generationVersion: "kb-generate/1.0.0",
    schemaId: report.schemaId,
    batches,
    totals: {
      records: card.total,
      approved: card.approved,
      pendingHumanReview: card.humanReviewRequired,
      sourceVerified: card.sourceVerified,
      rejected: card.rejected,
      deprecated: card.deprecated
    },
    coverage: {
      byDifficulty: card.byDifficulty,
      byModule: card.byModule,
      byCompetency: card.byCompetency,
      byTaskType: card.byTaskType,
      byRecordType: card.byRecordType,
      byEvidenceBasis: card.byEvidenceBasis,
      byContentStatus: card.byContentStatus,
      byAccessClass: card.byAccessClass,
      bySource: card.bySource,
      competencyGaps: card.competencyGaps,
      moduleGaps: card.moduleGaps,
      taskTypeGaps: card.taskTypeGaps
    },
    qa: {
      errors: card.errorCount,
      warnings: card.warningCount,
      duplicates: card.duplicates,
      nearDuplicates: card.nearDuplicates,
      schemaErrors: card.schemaErrors,
      codingVersionIssues: card.codingVersionIssues,
      status: card.errorCount === 0 ? "PASS" : "FAIL",
      report: "knowledge-corpus/qa/KB-001.qa-report.json"
    },
    sourceRegistry: {
      sources: JSON.parse(readFileSync(path.join(CORPUS_ROOT, "sources/source-registry.json"), "utf8")).sources.length,
      retrievedInThisWorkstream: 0,
      humanVerified: 0
    },
    knownLimitations: [
      "The declared source archive is absent from the repository; the corpus does not contain the 400 seed records and nothing has been reconstructed from conversational memory.",
      "No source was retrieved or opened in the workstream that produced this manifest. Every citation is transcribed from an existing repository artifact and is unverified.",
      "Zero records are approved for training or generation. Every record requires human review, and the 24 EXTERNAL_AUTHORITY records additionally require a registered reviewer to open the cited source.",
      "The difficulty distribution is weighted toward HARD because counterfactual mutation adds dependencies and competing priorities. This is a measured imbalance to redress in KB-002, not a labelling artefact.",
      "Competency coverage is uneven: KB-D07 and KB-D10 carry 12 records each against KB-D12's 96. Both under-covered axes are source-dependent, which is why they were not expanded here.",
      "The knowledge-corpus engine on feat/training-question-bank (owner decision D12) is not merged to main and is not imported by these tools. Alignment is by field naming and lifecycle vocabulary only; no integration contract exists yet."
    ],
    lastVerifiedCommit: git(["rev-parse", "HEAD"]),
    branch: git(["branch", "--show-current"]),
    checksums
  };
}

function main(argv) {
  const manifest = buildManifest();
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

  if (argv.includes("--check")) {
    if (!existsSync(MANIFEST_PATH)) {
      console.error("no manifest on disk; run without --check to write one");
      return 1;
    }
    const onDisk = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    const drift = [];
    if (onDisk.totals?.records !== manifest.totals.records) drift.push(`records ${onDisk.totals?.records} on disk vs ${manifest.totals.records} measured`);
    for (const [file, hash] of Object.entries(manifest.checksums)) {
      if (onDisk.checksums?.[file] !== hash) drift.push(`checksum changed: ${file}`);
    }
    for (const file of Object.keys(onDisk.checksums ?? {})) {
      if (!(file in manifest.checksums)) drift.push(`file in manifest but gone from disk: ${file}`);
    }
    if (drift.length > 0) {
      console.error(`manifest disagrees with the corpus (${drift.length} item(s)):`);
      for (const item of drift.slice(0, 20)) console.error(`  ${item}`);
      return 1;
    }
    console.log(`manifest matches the corpus: ${manifest.totals.records} records, ${Object.keys(manifest.checksums).length} checksummed files`);
    return 0;
  }

  writeFileSync(MANIFEST_PATH, serialized);
  console.log(`wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
  console.log(`  records ${manifest.totals.records}, approved ${manifest.totals.approved}, QA ${manifest.qa.status}`);
  console.log(`  checksummed files ${Object.keys(manifest.checksums).length}`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
