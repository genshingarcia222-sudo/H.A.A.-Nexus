// The P9-011 migration engine: contract A records -> contract B candidates.
//
// It is deterministic, it writes only into an isolated output directory, and it
// **never invents a value**. That last property is the point. Contract B
// requires fields contract A has no source for, and the only ways to satisfy
// them are to author content (which needs a human) or to weaken the contract
// (which is not this tool's to do). So where a value cannot be carried, the
// record is reported as blocked, with the field named, rather than filled in
// with something plausible.
//
// The canonical corpus is never modified. Nothing here promotes a record's
// review status or production eligibility, and nothing can: those are human
// gates and a migration is not a reviewer.
//
//   node tools/knowledge-corpus/kb-migrate.mjs            report only
//   node tools/knowledge-corpus/kb-migrate.mjs --write    also write candidates
//   node tools/knowledge-corpus/kb-migrate.mjs --json     machine-readable
//
// Exit 0 when every record has an outcome and no value was invented. Exit 1
// only if the tool itself cannot read an input.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISPOSITIONS } from "./kb-field-disposition.mjs";
import { recordFiles, REPO_ROOT } from "./kb-schema-divergence.mjs";

const OUT_DIR = path.join(REPO_ROOT, "knowledge-corpus", "migrated");

/**
 * Fields contract B's ITEM family requires, and where a value comes from.
 *
 * `from` is the contract A field. `null` means **contract A has no source for
 * it**, which is the finding this table exists to make explicit rather than to
 * work around.
 */
export const ITEM_REQUIRED = {
  questionId: { from: "id", how: "carried verbatim; ids are opaque after minting" },
  domain: { from: "domain", how: "carried verbatim" },
  question: { from: "prompt", how: "renamed, text unchanged" },
  choices: { from: "choices", how: "carried verbatim" },
  correctChoiceId: { from: "correctChoiceIds", how: "lowest-sorted member; the full set goes to correctChoiceIds (O5)" },
  rationale: { from: "rationale", how: "carried verbatim" },
  revision: { from: "revision", how: "carried verbatim" },
  contentStatus: { from: "contentStatus", how: "carried verbatim" },
  reviewStatus: { from: "reviewStatus", how: "carried verbatim; a migration never advances it" },
  provenance: { from: "provenance", how: "carried; authoring provenance, not a source citation" },
  modality: { from: "taskType", how: "mapped through TASK_TO_MODALITY" },
  difficultyLevel: {
    from: "difficulty",
    how: "BLOCKED ON O4: contract A carries a band (EASY/MODERATE/HARD), contract B a 1-6 level. The band-to-level mapping is advisory and unaccepted, so applying it would resolve O4 by side effect"
  },
  skillArea: { from: null, how: "contract A has no skillArea. `domain` is already used for `domain`, and `moduleIds` are ids, not a skill area" },
  learningObjective: {
    from: null,
    how: "contract A has no learning objective. `goldBehavior` describes what a correct RESPONSE does, which is not what the item TEACHES - treating one as the other is a semantic conversion, not a mapping"
  },
  questionType: { from: null, how: "contract A's 27 taskTypes do not map onto contract B's QUESTION_TYPES enum without an authoring judgement per task type" },
  source: {
    from: null,
    how: "contract A carries authoring provenance, not a source citation. The declared source archive is ABSENT from the repository (O3), so there is no citation to carry and inventing one is forbidden"
  }
};

/** The 27 authored task types against contract B's seven modalities. */
export const TASK_TO_MODALITY = {
  MCQ: "DIRECT_KNOWLEDGE",
  // A knowledge question with more than one correct choice is still a
  // knowledge question; O5 carries the answer set, not a new modality.
  MULTI_SELECT: "DIRECT_KNOWLEDGE",
  SHORT_ANSWER: "DIRECT_KNOWLEDGE",
  STRUCTURED_SHORT_ANSWER: "DIRECT_KNOWLEDGE",
  CHART_EXTRACTION: "TRANSFORMATION",
  SOAP_TRANSFORMATION: "SOAP",
  DOCUMENTATION_CORRECTION: "ERROR_DETECTION",
  CONTRADICTION_DETECTION: "ERROR_DETECTION",
  ERROR_HUNT: "ERROR_DETECTION",
  SEQUENCING: "WORKFLOW",
  WORKFLOW_DECISION: "WORKFLOW",
  RESULT_ROUTING: "WORKFLOW",
  MEDICATION_WORKFLOW_REVIEW: "WORKFLOW",
  INSURANCE_VERIFICATION: "WORKFLOW",
  PRIOR_AUTHORIZATION: "WORKFLOW",
  REFERRAL_PACKET_REVIEW: "WORKFLOW",
  IMAGING_ORDER_VALIDATION: "WORKFLOW",
  INFORMATION_GAP: "WORKFLOW",
  HANDOFF: "SITUATIONAL",
  CLOSED_LOOP_COMMUNICATION: "SITUATIONAL",
  CALL_PROBING: "SITUATIONAL",
  PRIVACY_JUDGMENT: "SITUATIONAL",
  AUDIT_RECONSTRUCTION: "SITUATIONAL",
  DELAYED_CLUE_REASONING: "SITUATIONAL",
  SCENARIO_CONTINUATION: "SITUATIONAL",
  CODING_SUPPORT: "COMPARATIVE_DECISION",
  REMEDIATION: "DIRECT_KNOWLEDGE"
};

/** Which contract B family an authored record type belongs to. */
export const RECORD_TYPE_TO_FAMILY = {
  QUESTION: "ITEM",
  DOCUMENTATION_TASK: "ITEM",
  WORKFLOW: "ITEM",
  COMMUNICATION_EVENT: "ITEM",
  SCENARIO: "ITEM",
  REMEDIATION: "ITEM"
};

export function loadRecords(files = recordFiles()) {
  const records = [];
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    for (const record of parsed.records ?? []) {
      records.push({ record, file, templateId: parsed.templateId, batchId: parsed.batchId });
    }
  }
  return records;
}

/**
 * Transform one record as far as it can honestly go.
 *
 * Returns the partial contract B candidate and the list of required fields that
 * could not be supplied. A record with an empty `blockedOn` is fully migratable
 * today; one with entries is not, and the entries say exactly why.
 */
export function transformRecord(entry) {
  const a = entry.record;
  const blockedOn = [];
  const candidate = { family: "ITEM" };

  const carry = (bField, aField) => {
    if (a[aField] !== undefined && a[aField] !== null) candidate[bField] = a[aField];
  };

  carry("questionId", "id");
  carry("domain", "domain");
  carry("question", "prompt");
  carry("choices", "choices");
  carry("rationale", "rationale");
  carry("revision", "revision");
  carry("contentStatus", "contentStatus");
  carry("reviewStatus", "reviewStatus");
  carry("provenance", "provenance");

  // O5: the answer set.
  const ids = Array.isArray(a.correctChoiceIds) ? [...a.correctChoiceIds].sort() : null;
  if (ids && ids.length > 0) {
    candidate.correctChoiceId = ids[0];
    if (ids.length > 1) {
      candidate.responseFormat = "MULTI_SELECT";
      candidate.correctChoiceIds = ids;
    }
  }

  // O6: the seventeen carried policy fields, by their own names.
  for (const [field, d] of Object.entries(DISPOSITIONS)) {
    if (d.kind !== "extend") continue;
    if (a[field] !== undefined) candidate[field] = a[field];
  }

  // Modality, from the task type.
  const modality = TASK_TO_MODALITY[a.taskType];
  if (modality) candidate.modality = modality;
  else blockedOn.push({ field: "modality", why: `taskType "${a.taskType}" has no modality mapping` });

  // Structural eligibility: contract B's ITEM needs 3-5 choices, because it
  // extends a multiple-choice question bank.
  const choiceCount = Array.isArray(a.choices) ? a.choices.length : 0;
  if (choiceCount < 3 || choiceCount > 5) {
    blockedOn.push({
      field: "choices",
      why: `${choiceCount} choices; contract B's ITEM requires 3-5 because it extends a multiple-choice bank. This record is a free-text or structured-output task and contract B has no family for one`
    });
  }

  // The fields contract A cannot supply. Named per record so the blocker is
  // countable rather than anecdotal.
  for (const [field, spec] of Object.entries(ITEM_REQUIRED)) {
    if (spec.from === null) {
      blockedOn.push({ field, why: spec.how });
    }
  }
  if (a.difficulty !== undefined) {
    blockedOn.push({ field: "difficultyLevel", why: ITEM_REQUIRED.difficultyLevel.how });
  }

  return { id: a.id, recordType: a.recordType, taskType: a.taskType, candidate, blockedOn };
}

export function migrate({ write = false } = {}) {
  const entries = loadRecords();
  const results = entries.map(transformRecord);

  const migratable = results.filter((r) => r.blockedOn.length === 0);
  const blocked = results.filter((r) => r.blockedOn.length > 0);

  // Why each record is blocked, aggregated.
  const byField = new Map();
  for (const r of blocked) {
    for (const b of r.blockedOn) {
      if (!byField.has(b.field)) byField.set(b.field, { field: b.field, records: 0, why: b.why });
      byField.get(b.field).records += 1;
    }
  }

  const structural = blocked.filter((r) => r.blockedOn.some((b) => b.field === "choices"));

  if (write) {
    // Isolated, and rebuilt from scratch so a stale candidate cannot survive a
    // run. Never inside `records/`, which is the canonical corpus.
    rmSync(OUT_DIR, { recursive: true, force: true });
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      path.join(OUT_DIR, "candidates.json"),
      `${JSON.stringify({ generatedBy: "kb-migrate", migratable: migratable.length, candidates: migratable.map((r) => r.candidate) }, null, 2)}\n`
    );
    writeFileSync(
      path.join(OUT_DIR, "blockers.json"),
      `${JSON.stringify({ blocked: blocked.length, byField: [...byField.values()], records: blocked.map((r) => ({ id: r.id, recordType: r.recordType, taskType: r.taskType, blockedOn: r.blockedOn.map((b) => b.field) })) }, null, 2)}\n`
    );
  }

  return {
    recordsExamined: results.length,
    migratableToday: migratable.length,
    blocked: blocked.length,
    structurallyBlocked: structural.length,
    byField: [...byField.values()].sort((a, b) => b.records - a.records),
    wrote: write ? OUT_DIR : null,
    // Every record has an outcome; that is the invariant, not that every record
    // migrates.
    everyRecordAccountedFor: migratable.length + blocked.length === results.length
  };
}

function render(m) {
  const L = [];
  L.push("H.A.A. Nexus P9-011 migration: contract A -> contract B");
  L.push("");
  L.push("Deterministic, isolated, and it invents nothing. Where contract B needs a");
  L.push("value contract A has no source for, the record is reported blocked with the");
  L.push("field named - not filled in with something plausible.");
  L.push("");
  L.push(`  records examined          ${m.recordsExamined}`);
  L.push(`  fully migratable today    ${m.migratableToday}`);
  L.push(`  blocked                   ${m.blocked}`);
  L.push(`  every record accounted for ${m.everyRecordAccountedFor ? "yes" : "NO"}`);
  L.push("");
  L.push("WHY RECORDS ARE BLOCKED  (a record can be blocked on more than one)");
  for (const b of m.byField) {
    L.push(`  ${b.field.padEnd(20)} ${String(b.records).padStart(4)} record(s)`);
    for (const line of wrap(b.why, 72)) L.push(`      ${line}`);
  }
  L.push("");
  L.push(`STRUCTURAL: ${m.structurallyBlocked} records are free-text or structured-output tasks.`);
  L.push("  Contract B's ITEM family extends a MULTIPLE-CHOICE question bank, so it");
  L.push("  cannot represent them at all. Giving it one is a content-model decision,");
  L.push("  not an implementation detail, and it is not taken here.");
  L.push("");
  if (m.wrote) L.push(`wrote candidates and blockers to ${path.relative(REPO_ROOT, m.wrote)}`);
  return L.join("\n");
}

function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else line += ` ${w}`;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const m = migrate({ write: process.argv.includes("--write") });
  console.log(process.argv.includes("--json") ? JSON.stringify(m, null, 2) : render(m));
  process.exit(m.everyRecordAccountedFor ? 0 : 1);
}
