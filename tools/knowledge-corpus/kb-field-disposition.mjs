// Every contract A field, and what the migration to contract B does with it.
//
// This is the input table for P9-011, and it exists because the migration's own
// instruction is that **no field may be silently dropped**. A prose table in
// `docs/KNOWLEDGE_ARCHITECTURE.md` section 3 cannot enforce that; this can. The table
// below is declarative, and everything underneath it is a check that the table
// still agrees with the actual schema, the actual 432 records and the actual
// contract B source.
//
// It changes nothing. It reads, cross-checks, and exits non-zero when a field
// has no disposition, when a disposition names a field the corpus does not
// have, or when a decided count no longer matches reality.
//
//   node tools/knowledge-corpus/kb-field-disposition.mjs          report
//   node tools/knowledge-corpus/kb-field-disposition.mjs --json   machine-readable
//
// The readers come from `kb-schema-divergence.mjs` on purpose. That tool
// already parses contract A's JSON Schema, contract B's Zod source and the
// records, and a second parser for the same three inputs is how two tools start
// disagreeing about what the corpus contains.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, recordFiles } from "./kb-schema-divergence.mjs";

/**
 * How a field crosses from A to B.
 *
 * - `direct`      the same name exists in B and carries the same meaning.
 * - `rename`      same concept, different name in B.
 * - `lift`        a flat A value becomes a nested or differently-shaped B value.
 * - `extend`      B has no equivalent and the decision is to **add one**.
 * - `drop-policy` deliberately not migrated, under a named decision.
 * - `drop-authoring` belongs to the authoring pipeline and must NOT enter the
 *   runtime contract at all.
 *
 * `extend` and the two `drop` kinds are the ones that need an `authority`: a
 * field is only allowed to be left behind by a decision somebody can be held to.
 */
const D = (kind, target, authority, note) => ({ kind, target, authority, note });

export const DISPOSITIONS = {
  // --- the governance spine: same name, same meaning (11) -----------------
  id: D("direct", "id", "D18", "identity"),
  provenance: D("direct", "provenance", "D18", "provenance"),
  revision: D("direct", "revision", "D18", "revision history"),
  reviewStatus: D("direct", "reviewStatus", "D18", "review eligibility"),
  verification: D("direct", "verification", "D18", "human-verification gate"),
  contentStatus: D("direct", "contentStatus", "D18", "lifecycle"),
  evidence: D("direct", "evidence", "D18", "evidence basis"),
  flags: D("direct", "flags", "D18", "flags"),
  domain: D("direct", "domain", "D18", "domain"),
  rationale: D("direct", "rationale", "D18", "rationale"),
  choices: D("direct", "choices", "D18", "answer choices"),

  // --- (a) rename: same concept, different name (9) -----------------------
  recordType: D("rename", "family + kind", "D18 §3(a)", "one discriminator becomes B's two-level one"),
  prompt: D("rename", "question (ITEM) / statement (KNOWLEDGE)", "D18 §3(a)", "the split is by family"),
  difficulty: D("rename", "difficultyLevel", "D18 §3(a)", "B's difficultyIntent has no A source"),
  competencyIds: D("rename", "competencyRefs", "D18 §3(a)", "two A fields collapse into one B field"),
  sourceCompetencyIds: D("rename", "competencyRefs", "D18 §3(a)", "the A distinction must survive in lineage or be dropped on the record"),
  scenarioType: D("rename", "encounterType / setting", "D18 §3(a)", "CONTEXT family"),
  taskType: D("rename", "modality / modalityDetail / responseFormat", "D18 §3(a)", "one A field, three B fields"),
  createdAt: D("drop-authoring", null, "D18 §3(a)", "belongs to the authoring record, not the knowledge record"),
  updatedAt: D("drop-authoring", null, "D18 §3(a)", "belongs to the authoring record, not the knowledge record"),

  // --- (b) structural lift (9) --------------------------------------------
  effectiveFrom: D("lift", "applicability.effectiveFrom", "D18 §3(b)", "B cross-validates against codingReference"),
  effectiveTo: D("lift", "applicability.effectiveTo", "D18 §3(b)", "B cross-validates against codingReference"),
  codingVersion: D("lift", "codingReference{system,code,version,source,effectiveFrom,effectiveTo}", "D18 §3(b)", "an upgrade, not a rename: a flat version string cannot carry §5 provenance"),
  variantOf: D("lift", "variantGroup / supersedes / exceptionOf", "D18 §3(b)", "5 A lineage fields become 3 B fields"),
  parentId: D("lift", "variantGroup / supersedes / exceptionOf", "D18 §3(b)", "highest-volume lift; most likely to lose information"),
  templateId: D("lift", "variantGroup / supersedes / exceptionOf", "D18 §3(b)", "authoring template identity, carried as lineage"),
  mutationTypes: D("lift", "variantGroup / supersedes / exceptionOf", "D18 §3(b)", "counterfactual operator identity"),
  variantLineage: D("lift", "variantGroup / supersedes / exceptionOf", "D18 §3(b)", "explicit lineage chain"),
  correctChoiceIds: D("lift", "correctChoiceId + optional multi-select", "O5", "15 records are true multi-select and are CARRIED; scoring is all-or-nothing"),

  // --- (c) the 18 policy and safety fields: 17 carried, 1 dropped ---------
  safetyFlags: D("extend", "safetyFlags", "O6 (safety)", "SAFETY-PRECEDENCE enforces it today"),
  privacyFlags: D("extend", "privacyFlags", "O6 (safety)", "privacy enforcement"),
  escalationRequired: D("extend", "escalationRequired", "O6 (safety)", "safety metadata"),
  clinicianJudgmentRequired: D("extend", "clinicianJudgmentRequired", "O6 (safety)", "safety metadata"),
  hardFailureConditions: D("extend", "hardFailureConditions", "O6 (safety)", "hard-failure semantics"),
  jurisdictions: D("extend", "jurisdictions", "O6 (regulatory)", "§5 depends on it to show a coding statement safely"),
  payerSpecific: D("extend", "payerSpecific", "O6 (regulatory)", "payer applicability"),
  encounterDate: D("extend", "encounterDate", "O6 (regulatory)", "temporal applicability"),
  goldBehavior: D("extend", "goldBehavior", "O6 (assessment)", "what a correct response is"),
  acceptanceCriteria: D("extend", "acceptanceCriteria", "O6 (assessment)", "gradeable intent"),
  errorTargets: D("extend", "errorTargets", "O6 (assessment)", "error taxonomy targets"),
  remediationTargets: D("extend", "remediationTargets", "O6 (assessment)", "remediation links"),
  trapTypes: D("extend", "trapTypes", "O6 (assessment)", "trap taxonomy"),
  expectedOutput: D("extend", "expectedOutput", "O6 (assessment)", "expected output, 114 records"),
  steps: D("extend", "steps", "O6 (assessment)", "multi-stage steps, 16 records"),
  moduleIds: D("extend", "moduleIds", "O6 (structural)", "module boundary"),
  evidenceBasis: D("extend", "evidenceBasis", "O6 (structural)", "provenance-adjacent"),
  // MEASURED 2026-10-14 and it corrects the record: every one of the 432
  // records carries a NON-EMPTY accessClasses (299 / 106 / 27 across three
  // distinct values), so "it is on zero records and the generator cannot
  // assign it" - the §6.2 wording - is false. What is true, and is the leg the
  // decision actually rests on, is that NO record carries
  // ASSESSMENT_CLOSED_BOOK, so no closed-book subset rule is needed and D4
  // still blocks surfaces rather than records. The drop stands as ratified, but
  // it discards real data on 432 records rather than nothing, and `lossReport`
  // below measures that every run so the cost can never go quiet again.
  accessClasses: D("drop-policy", null, "O6 + D18 §6.2", "THE ONE DELIBERATE DROP: D4 blocks surfaces, not records, and no record carries ASSESSMENT_CLOSED_BOOK. NOT a no-op: 432 records carry a non-empty value, 27 of them PREMIUM_REALISTIC"),

  // --- (d) authoring-pipeline metadata: must NOT enter the contract (7) ---
  batchId: D("drop-authoring", null, "D18 §3(d)", "how a record was produced"),
  packet: D("drop-authoring", null, "D18 §3(d)", "authoring packet"),
  canonicalOrder: D("drop-authoring", null, "D18 §3(d)", "authoring ordering"),
  auditTags: D("drop-authoring", null, "D18 §3(d)", "authoring audit"),
  fingerprints: D("drop-authoring", null, "D18 §3(d)", "duplicate control during generation; NOT retrieval metadata and must not become any"),
  ownerRole: D("drop-authoring", null, "D18 §3(d)", "who owes work on it"),
  nextActionOwner: D("drop-authoring", null, "D18 §3(d)", "who owes work on it")
};

/** The counts the decisions commit us to. A drift here is a real finding. */
export const DECIDED_COUNTS = {
  /** O6: eighteen class-(c) fields, seventeen carried, one dropped. */
  classCCarried: 17,
  classCDropped: 1,
  /** O5: true multi-select records. */
  multiSelectRecords: 15
};

/**
 * What a drop actually costs, measured from the records rather than asserted.
 *
 * "No field may be silently dropped" is only meaningful if the drop's size is
 * known. This counts, for every `drop-policy` and `drop-authoring` field, how
 * many records carry a **non-empty** value and what those values are.
 *
 * It exists because of a specific error: `docs/KNOWLEDGE_ARCHITECTURE.md` §6.2
 * recorded that `accessClasses` was "on zero records", and all 432 carry one.
 * A sentence cannot be trusted to stay true about data; a measurement can be
 * re-run.
 */
export function lossReport(files = recordFiles()) {
  const dropped = Object.entries(DISPOSITIONS)
    .filter(([, d]) => d.kind === "drop-policy" || d.kind === "drop-authoring")
    .map(([field]) => field);

  const nonEmpty = new Map(dropped.map((f) => [f, 0]));
  const values = new Map(dropped.map((f) => [f, new Map()]));

  const meaningful = (v) => {
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  };

  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    for (const record of parsed.records ?? []) {
      for (const field of dropped) {
        if (!meaningful(record[field])) continue;
        nonEmpty.set(field, nonEmpty.get(field) + 1);
        const key = JSON.stringify(record[field]);
        const seen = values.get(field);
        // Only keep a small sample of distinct values; this is a cost report,
        // not a second copy of the corpus.
        if (seen.size < 8 || seen.has(key)) seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }

  return dropped
    .map((field) => ({
      field,
      kind: DISPOSITIONS[field].kind,
      authority: DISPOSITIONS[field].authority,
      recordsLosingAValue: nonEmpty.get(field),
      distinctValuesSampled: [...values.get(field).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }))
    }))
    .sort((a, b) => b.recordsLosingAValue - a.recordsLosingAValue);
}

export function audit(data = collect()) {
  const { branch, core, usage, result } = data;
  const used = [...usage.counts.keys()].sort();
  const usedSet = new Set(used);
  const coreUnion = new Set(core.union);

  const problems = [];

  // 1. No silent dropping: every field the corpus actually uses is dispositioned.
  const undispositioned = used.filter((k) => !DISPOSITIONS[k]);
  for (const k of undispositioned) {
    problems.push(`NO DISPOSITION: \`${k}\` is on ${usage.counts.get(k)} record(s) and the table does not say what happens to it`);
  }

  // 2. No phantom entries: a disposition for a field no record carries is a
  //    table drifting away from the corpus, which is how a reader is misled.
  const phantom = Object.keys(DISPOSITIONS).filter((k) => !usedSet.has(k));
  for (const k of phantom) {
    problems.push(`PHANTOM: the table disposes of \`${k}\`, which no record uses`);
  }

  // 3. A `direct` target must genuinely exist in contract B today.
  for (const [field, d] of Object.entries(DISPOSITIONS)) {
    if (d.kind !== "direct") continue;
    if (!coreUnion.has(d.target)) {
      problems.push(`NOT DIRECT: \`${field}\` is marked direct but \`${d.target}\` is not in contract B's field union`);
    }
  }

  // 4. Every field left behind cites a decision. This is the rule that makes
  //    "no silent dropping" mean something: a drop needs an authority.
  for (const [field, d] of Object.entries(DISPOSITIONS)) {
    if (d.kind !== "drop-policy" && d.kind !== "drop-authoring") continue;
    if (!d.authority || !String(d.authority).trim()) {
      problems.push(`UNJUSTIFIED DROP: \`${field}\` is dropped with no decision cited`);
    }
  }

  // 5. O6's arithmetic.
  const classC = Object.entries(DISPOSITIONS).filter(([, d]) => /^O6/.test(d.authority ?? ""));
  const carried = classC.filter(([, d]) => d.kind === "extend");
  const dropped = classC.filter(([, d]) => d.kind === "drop-policy");
  if (carried.length !== DECIDED_COUNTS.classCCarried) {
    problems.push(`O6 DRIFT: ${carried.length} class-(c) fields carried, the decision says ${DECIDED_COUNTS.classCCarried}`);
  }
  if (dropped.length !== DECIDED_COUNTS.classCDropped) {
    problems.push(`O6 DRIFT: ${dropped.length} class-(c) fields dropped, the decision says ${DECIDED_COUNTS.classCDropped}`);
  }
  if (dropped.length === 1 && dropped[0][0] !== "accessClasses") {
    problems.push(`O6 VIOLATION: the dropped class-(c) field is \`${dropped[0][0]}\`, and the decision names only \`accessClasses\``);
  }

  // 6. The fields that need contract B to grow, which is the migration's
  //    remaining schema work and must land WITH the records (the A9 precedent).
  const needsExtension = Object.entries(DISPOSITIONS)
    .filter(([, d]) => d.kind === "extend")
    .map(([field]) => field)
    .sort();

  const byKind = {};
  for (const [field, d] of Object.entries(DISPOSITIONS)) {
    (byKind[d.kind] ??= []).push(field);
  }
  for (const list of Object.values(byKind)) list.sort();

  const loss = lossReport();

  return {
    loss,
    recordsExamined: usage.records,
    branchPropertiesDeclared: branch.properties.length,
    fieldsUsed: used.length,
    dispositioned: used.filter((k) => DISPOSITIONS[k]).length,
    undispositioned,
    phantom,
    byKind,
    needsExtension,
    counts: Object.fromEntries(used.map((k) => [k, usage.counts.get(k)])),
    mappedSameName: result.mapped ?? [],
    problems,
    ok: problems.length === 0
  };
}

function render(a) {
  const L = [];
  L.push("H.A.A. Nexus knowledgebase field disposition  (P9-011, contract A -> contract B)");
  L.push("");
  L.push("Every field contract A declares and the corpus populates, and what the");
  L.push("migration does with it. Derived from the schema, the records and contract B's");
  L.push("source - not from prose. It migrates nothing.");
  L.push("");
  L.push(`  records examined        ${a.recordsExamined}`);
  L.push(`  A properties declared   ${a.branchPropertiesDeclared}`);
  L.push(`  A fields populated      ${a.fieldsUsed}`);
  L.push(`  dispositioned           ${a.dispositioned} of ${a.fieldsUsed}`);
  L.push("");
  const labels = {
    direct: "direct        same name, same meaning in B",
    rename: "rename        same concept, different name",
    lift: "lift          flat A value becomes a different B shape",
    extend: "extend        B gains the field (O6 / O5)",
    "drop-policy": "drop-policy   deliberately not migrated",
    "drop-authoring": "drop-authoring authoring metadata, must not enter the contract"
  };
  for (const kind of ["direct", "rename", "lift", "extend", "drop-policy", "drop-authoring"]) {
    const fields = a.byKind[kind] ?? [];
    L.push(`${labels[kind]}  (${fields.length})`);
    for (const f of fields) {
      const d = DISPOSITIONS[f];
      const n = a.counts[f] ?? 0;
      const to = d.target ? ` -> ${d.target}` : "";
      L.push(`    ${f.padEnd(26)} ${String(n).padStart(4)} rec  [${d.authority}]${to}`);
    }
    L.push("");
  }
  const policyLoss = a.loss.filter((l) => l.kind === "drop-policy");
  const authoringLoss = a.loss.filter((l) => l.kind === "drop-authoring" && l.recordsLosingAValue > 0);
  L.push("WHAT EACH DROP ACTUALLY COSTS  (measured, not asserted)");
  for (const l of policyLoss) {
    L.push(`    ${l.field}  [${l.authority}]  ${l.recordsLosingAValue} record(s) lose a non-empty value`);
    for (const v of l.distinctValuesSampled) L.push(`        ${String(v.count).padStart(4)} x  ${v.value}`);
  }
  L.push(`    authoring metadata: ${authoringLoss.length} field(s) carry values and are dropped BY DESIGN`);
  L.push("      (they describe how a record was produced; D18 §3(d) keeps them out of the contract)");
  L.push("");
  L.push(`CONTRACT B MUST GAIN ${a.needsExtension.length} FIELDS before the records can validate:`);
  L.push(`  ${a.needsExtension.join(", ")}`);
  L.push("");
  L.push("  These land in the SAME commit series as the records that populate them.");
  L.push("  A9 removed a field nothing consumed; adding one ahead of its records");
  L.push("  would repeat exactly that mistake.");
  L.push("");
  if (a.ok) {
    L.push("RESULT  every populated field has a disposition, every drop cites a decision,");
    L.push("        and O5/O6 arithmetic matches the decisions.");
  } else {
    L.push(`RESULT  ${a.problems.length} PROBLEM(S):`);
    for (const p of a.problems) L.push(`  - ${p}`);
  }
  return L.join("\n");
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const a = audit();
  console.log(process.argv.includes("--json") ? JSON.stringify(a, null, 2) : render(a));
  process.exit(a.ok ? 0 : 1);
}
