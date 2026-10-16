// Tests for the P9-011 field disposition table.
//
// The migration's binding rule is that **no field may be silently dropped**.
// These tests are what makes that rule enforceable rather than aspirational:
// they fail if a field loses its disposition, if one of O6's seventeen carried
// fields disappears, if the single permitted drop becomes something other than
// `accessClasses`, or if a drop stops citing a decision.
//
// They also pin the two counts the decisions commit us to - 17 carried and 15
// multi-select - against the actual records, so a corpus change that breaks a
// decision's arithmetic is a test failure and not a surprise during migration.
//
// `node tools/knowledge-corpus/kb-field-disposition.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DECIDED_COUNTS,
  DISPOSITIONS,
  audit,
  lossReport
} from "./kb-field-disposition.mjs";
import { collect, recordFiles } from "./kb-schema-divergence.mjs";

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  PASS  " + name);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log("  FAIL  " + name + " - " + e.message);
  }
}

console.log("knowledgebase field disposition tests\n");

const data = collect();
const a = audit(data);

console.log("no field is silently dropped");

test("every field the corpus populates has a disposition", () => {
  assert.deepEqual(a.undispositioned, [], "these fields have no recorded outcome");
  assert.equal(a.dispositioned, a.fieldsUsed);
});

test("the table disposes of nothing the corpus does not have", () => {
  // A table that drifts away from the corpus misleads whoever reads it next.
  assert.deepEqual(a.phantom, []);
});

test("all 54 declared properties are populated and accounted for", () => {
  assert.equal(a.recordsExamined, 432, "the corpus is still 432 records");
  assert.equal(a.branchPropertiesDeclared, 54);
  assert.equal(a.fieldsUsed, 54);
});

test("every dropped field cites a decision", () => {
  for (const [field, d] of Object.entries(DISPOSITIONS)) {
    if (d.kind !== "drop-policy" && d.kind !== "drop-authoring") continue;
    assert.ok(d.authority && d.authority.trim(), `${field} is dropped with no authority`);
  }
});

test("the audit reports no problems at all", () => {
  assert.deepEqual(a.problems, []);
  assert.equal(a.ok, true);
});

console.log("\nO6: seventeen carried, accessClasses dropped");

const classC = Object.entries(DISPOSITIONS).filter(([, d]) => /^O6/.test(d.authority ?? ""));

test("exactly 18 class-(c) fields are dispositioned under O6", () => {
  assert.equal(classC.length, 18);
});

test("exactly 17 are carried, and these are them", () => {
  const carried = classC.filter(([, d]) => d.kind === "extend").map(([f]) => f).sort();
  assert.equal(carried.length, DECIDED_COUNTS.classCCarried);
  // Named, not just counted. If a future edit quietly swaps one safety field
  // for something cheaper, a count would still be 17 and this would not.
  assert.deepEqual(carried, [
    "acceptanceCriteria",
    "clinicianJudgmentRequired",
    "encounterDate",
    "errorTargets",
    "escalationRequired",
    "evidenceBasis",
    "expectedOutput",
    "goldBehavior",
    "hardFailureConditions",
    "jurisdictions",
    "moduleIds",
    "payerSpecific",
    "privacyFlags",
    "remediationTargets",
    "safetyFlags",
    "trapTypes",
    "steps"
  ].sort());
});

test("the five safety fields are carried, not dropped", () => {
  // The decision's own words: dropping one of these removes a guarantee a
  // reviewer can currently rely on. This is the test that refuses it.
  for (const field of [
    "safetyFlags",
    "privacyFlags",
    "escalationRequired",
    "clinicianJudgmentRequired",
    "hardFailureConditions"
  ]) {
    assert.equal(DISPOSITIONS[field].kind, "extend", `${field} must be carried`);
    assert.match(DISPOSITIONS[field].authority, /^O6/);
  }
});

test("accessClasses is the ONLY policy drop", () => {
  const dropped = classC.filter(([, d]) => d.kind === "drop-policy").map(([f]) => f);
  assert.deepEqual(dropped, ["accessClasses"]);
});

test("no class-(c) field is quietly reclassified as authoring metadata", () => {
  // The cheapest way to lose a safety field without failing the count above
  // would be to call it authoring metadata. It is not available.
  for (const [field, d] of classC) {
    assert.notEqual(d.kind, "drop-authoring", `${field} must not be reclassified as authoring metadata`);
  }
});

console.log("\nO5: multi-select is carried");

test("correctChoiceIds is a lift that carries multi-select, not a drop", () => {
  const d = DISPOSITIONS.correctChoiceIds;
  assert.equal(d.kind, "lift");
  assert.equal(d.authority, "O5");
  assert.match(d.target, /multi-select/);
});

test("the corpus still holds exactly 15 true multi-select records", () => {
  // Re-derived from the records rather than trusted from the decision, so a
  // corpus change that invalidates O5's arithmetic fails here instead of
  // surfacing halfway through a migration.
  let arrayForm = 0;
  let multiSelect = 0;
  const taskTypes = new Set();
  const correctCounts = new Set();

  for (const file of recordFiles()) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    for (const record of parsed.records ?? []) {
      const ids = record.correctChoiceIds;
      if (!Array.isArray(ids)) continue;
      arrayForm++;
      if (ids.length > 1) {
        multiSelect++;
        taskTypes.add(record.taskType);
        correctCounts.add(ids.length);
      }
    }
  }

  assert.equal(arrayForm, 318, "records in the array form");
  assert.equal(multiSelect, DECIDED_COUNTS.multiSelectRecords, "true multi-select records");
  assert.deepEqual([...taskTypes], ["MULTI_SELECT"], "all of them declare MULTI_SELECT");
  assert.deepEqual([...correctCounts], [2], "all of them have exactly two correct choices");
});

test("every record that is not multi-select lifts to a single id", () => {
  // The 303 remaining array-form records must be mechanically liftable, or the
  // lift is not a lift. One of these carrying two ids would be a 16th
  // multi-select record that O5 never dispositioned.
  let singles = 0;
  for (const file of recordFiles()) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    for (const record of parsed.records ?? []) {
      const ids = record.correctChoiceIds;
      if (!Array.isArray(ids)) continue;
      if (ids.length === 1) singles++;
      assert.ok(ids.length >= 1, `${record.id} has an empty correctChoiceIds`);
      assert.equal(new Set(ids).size, ids.length, `${record.id} repeats a correct choice id`);
    }
  }
  assert.equal(singles, 303);
});

console.log("\nwhat the drops actually cost");

test("the accessClasses drop is reported as a real loss, not a no-op", () => {
  // docs/KNOWLEDGE_ARCHITECTURE.md section 6.2 said this field was "on zero
  // records". All 432 carry a non-empty value. This test exists so the
  // correction cannot quietly regress back into the comfortable version.
  const loss = lossReport();
  const entry = loss.find((l) => l.field === "accessClasses");
  assert.ok(entry, "accessClasses is not in the loss report");
  assert.equal(entry.recordsLosingAValue, 432, "every record carries a value and loses it");
  assert.ok(entry.distinctValuesSampled.length >= 3, "there are at least three distinct values");
});

test("no record is marked ASSESSMENT_CLOSED_BOOK, which is the leg the decision rests on", () => {
  // D4 blocks surfaces rather than records, and this is the measurement that
  // makes that safe to rely on: nothing in the corpus claims to be
  // closed-book, so dropping accessClasses cannot drop a closed-book rule.
  const entry = lossReport().find((l) => l.field === "accessClasses");
  for (const { value } of entry.distinctValuesSampled) {
    assert.ok(!/ASSESSMENT_CLOSED_BOOK/.test(value), `a record claims closed-book access: ${value}`);
  }
});

test("PREMIUM_REALISTIC is among the values being discarded, and is recorded", () => {
  // Entitlement-relevant, so it must not vanish from the record of what the
  // drop costs. 27 records carry it.
  const entry = lossReport().find((l) => l.field === "accessClasses");
  const premium = entry.distinctValuesSampled.find((v) => /PREMIUM_REALISTIC/.test(v.value));
  assert.ok(premium, "the PREMIUM_REALISTIC distinction is not reported");
  assert.equal(premium.count, 27);
});

console.log("\ncontract B's remaining schema work");

test("exactly the 17 carried fields are what contract B must gain", () => {
  assert.equal(a.needsExtension.length, 17);
  const carried = classC.filter(([, d]) => d.kind === "extend").map(([f]) => f).sort();
  assert.deepEqual(a.needsExtension, carried);
});

test("no direct mapping claims a field contract B does not have", () => {
  const union = new Set(data.core.union);
  for (const [field, d] of Object.entries(DISPOSITIONS)) {
    if (d.kind !== "direct") continue;
    assert.ok(union.has(d.target), `${field} -> ${d.target} is not in contract B`);
  }
});

test("the eleven direct fields are the governance spine", () => {
  const direct = Object.entries(DISPOSITIONS).filter(([, d]) => d.kind === "direct").map(([f]) => f).sort();
  assert.deepEqual(direct, [
    "choices",
    "contentStatus",
    "domain",
    "evidence",
    "flags",
    "id",
    "provenance",
    "rationale",
    "reviewStatus",
    "revision",
    "verification"
  ]);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
