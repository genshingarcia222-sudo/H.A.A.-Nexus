// Tests for the P9-011 migration engine.
//
// Two things are pinned here, and the second matters more than the first.
//
//   1. What the engine carries, it carries faithfully: ids, text, the O5 answer
//      set, the seventeen O6 policy fields, and nothing invented.
//   2. What it cannot carry, it refuses to invent. A migration that filled in a
//      plausible `learningObjective` would pass every schema check and would be
//      fabricated content in a clinical training corpus. These tests fail if a
//      candidate ever acquires one of the unsourceable fields.
//
// `node tools/knowledge-corpus/kb-migrate.test.mjs`
import assert from "node:assert/strict";
import {
  ITEM_REQUIRED,
  RECORD_TYPE_TO_FAMILY,
  TASK_TO_MODALITY,
  loadDifficultyRegistry,
  loadRecords,
  migrate,
  transformRecord
} from "./kb-migrate.mjs";

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

console.log("P9-011 migration engine tests\n");

const entries = loadRecords();
const results = entries.map((entry) => transformRecord(entry));
const m = migrate();

console.log("every record has an outcome");

test("all 432 records are examined and accounted for", () => {
  assert.equal(m.recordsExamined, 432);
  assert.equal(m.everyRecordAccountedFor, true);
  assert.equal(m.migratableToday + m.blocked, 432);
});

test("no record is silently skipped", () => {
  const ids = new Set(results.map((r) => r.id));
  assert.equal(ids.size, 432, "every record produced exactly one distinct outcome");
});

console.log("\nthe mappings have no gaps and no phantoms");

test("every task type in the corpus maps to a modality", () => {
  // A gap would silently block records on a mapping omission rather than on a
  // real contract problem, which is how an engineering oversight gets
  // misreported as a content blocker.
  const used = [...new Set(entries.map((e) => e.record.taskType))];
  const unmapped = used.filter((t) => !TASK_TO_MODALITY[t]);
  assert.deepEqual(unmapped, [], "unmapped task types");
  assert.equal(used.length, 27);
});

test("the modality map contains nothing the corpus does not use", () => {
  // Three invented entries were caught this way while writing the engine.
  const used = new Set(entries.map((e) => e.record.taskType));
  const phantom = Object.keys(TASK_TO_MODALITY).filter((t) => !used.has(t));
  assert.deepEqual(phantom, []);
});

test("every record type has a family", () => {
  const used = [...new Set(entries.map((e) => e.record.recordType))];
  for (const rt of used) assert.ok(RECORD_TYPE_TO_FAMILY[rt], `${rt} has no family`);
  assert.equal(used.length, 6);
});

console.log("\nwhat is carried is carried faithfully");

test("ids are carried verbatim", () => {
  for (const r of results) {
    const source = entries.find((e) => e.record.id === r.id).record;
    assert.equal(r.candidate.questionId, source.id);
  }
});

test("prompt and rationale text are carried without alteration", () => {
  // A migration that reworded content would be authoring, not migrating.
  for (const e of entries.slice(0, 60)) {
    const out = transformRecord(e);
    assert.equal(out.candidate.question, e.record.prompt);
    assert.equal(out.candidate.rationale, e.record.rationale);
  }
});

test("review status is never advanced by the migration", () => {
  // The human gate. A migration is not a reviewer, and this is the test that
  // says so in code.
  for (const r of results) {
    const source = entries.find((e) => e.record.id === r.id).record;
    assert.equal(r.candidate.reviewStatus, source.reviewStatus);
    assert.notEqual(r.candidate.reviewStatus, "approved");
  }
});

console.log("\nO5: the answer set");

test("the 15 true multi-select records become MULTI_SELECT with their full set", () => {
  const multi = results.filter((r) => r.candidate.responseFormat === "MULTI_SELECT");
  assert.equal(multi.length, 15);
  for (const r of multi) {
    assert.ok(Array.isArray(r.candidate.correctChoiceIds));
    assert.ok(r.candidate.correctChoiceIds.length >= 2);
    assert.ok(
      r.candidate.correctChoiceIds.includes(r.candidate.correctChoiceId),
      "correctChoiceId must be inside the set, as the contract requires"
    );
  }
});

test("single-answer records get one id and NO set", () => {
  const singles = results.filter(
    (r) => r.candidate.correctChoiceId && r.candidate.responseFormat !== "MULTI_SELECT"
  );
  assert.equal(singles.length, 303);
  for (const r of singles) {
    assert.equal(r.candidate.correctChoiceIds, undefined, "a single answer must not carry a set");
  }
});

test("the answer set is sorted, so output is stable", () => {
  for (const r of results) {
    const ids = r.candidate.correctChoiceIds;
    if (!ids) continue;
    assert.deepEqual(ids, [...ids].sort());
  }
});

console.log("\nO6: the seventeen carried fields, and the one drop");

test("carried policy fields survive the transform with identical values", () => {
  const fields = ["safetyFlags", "privacyFlags", "escalationRequired", "clinicianJudgmentRequired", "hardFailureConditions", "jurisdictions", "goldBehavior", "moduleIds"];
  let checked = 0;
  for (const e of entries.slice(0, 80)) {
    const out = transformRecord(e);
    for (const f of fields) {
      if (e.record[f] === undefined) continue;
      assert.deepEqual(out.candidate[f], e.record[f], `${f} on ${e.record.id}`);
      checked++;
    }
  }
  assert.ok(checked > 200, `only ${checked} field values checked`);
});

test("accessClasses NEVER appears on a candidate", () => {
  // The drop, enforced in the transform as well as by the contract's
  // strictness. Belt and braces, because this one is a decided omission and a
  // leak would be a silent reversal of it.
  for (const r of results) {
    assert.equal(r.candidate.accessClasses, undefined, `${r.id} leaked accessClasses`);
  }
});

test("no authoring-pipeline metadata leaks into a candidate", () => {
  for (const r of results) {
    for (const f of ["batchId", "packet", "canonicalOrder", "auditTags", "fingerprints", "ownerRole", "nextActionOwner", "createdAt", "updatedAt"]) {
      assert.equal(r.candidate[f], undefined, `${r.id} leaked ${f}`);
    }
  }
});

console.log("\nthe engine invents nothing");

test("no candidate acquires a field contract A cannot supply", () => {
  // The headline guarantee. If this ever fails, something is fabricating
  // content for a clinical training corpus.
  const unsourceable = Object.entries(ITEM_REQUIRED)
    .filter(([, spec]) => spec.from === null)
    .map(([field]) => field);
  assert.deepEqual(unsourceable.sort(), ["learningObjective", "questionType", "skillArea", "source"]);
  for (const r of results) {
    for (const field of unsourceable) {
      assert.equal(r.candidate[field], undefined, `${r.id} invented ${field}`);
    }
  }
});

test("every record is blocked on the unsourceable fields, and says so", () => {
  for (const r of results) {
    const blocked = r.blockedOn.map((b) => b.field);
    for (const field of ["skillArea", "learningObjective", "questionType", "source"]) {
      assert.ok(blocked.includes(field), `${r.id} does not report ${field} as blocked`);
    }
  }
});

test("the 114 free-text records are blocked structurally, with a reason", () => {
  const structural = results.filter((r) => r.blockedOn.some((b) => b.field === "choices"));
  assert.equal(structural.length, 114);
  assert.equal(m.structurallyBlocked, 114);
  for (const r of structural) {
    const why = r.blockedOn.find((b) => b.field === "choices").why;
    assert.match(why, /multiple-choice/);
  }
});

// O4 is two rules, not one, and this pins both. Before O4 was implemented no
// level could be assigned at all, so this asserted that EVERY record carried the
// blocker. O4 ("bands preserved, levels only on evidence") made a level
// assignable wherever the registry hints exactly one, which is four of the five
// bands. Asserting the old universal claim would now require the engine to
// withhold a level it has evidence for.
test("difficultyLevel is assigned only on evidence, and blocked on O4 otherwise", () => {
  const registry = loadDifficultyRegistry();
  let verified = 0;
  let blocked = 0;
  for (const r of results) {
    const band = r.candidate.difficultyBand;
    assert.ok(band, `${r.id} lost its difficulty band; O4 preserves the band unconditionally`);
    const hint = registry.hints.get(band);
    assert.ok(hint, `${band} is not a band ${registry.registryId} defines`);
    const d = r.blockedOn.find((b) => b.field === "difficultyLevel");
    if (hint.length === 1) {
      assert.equal(d, undefined, `${r.id}: ${band} hints exactly one level, so nothing is blocked`);
      assert.equal(r.candidate.difficultyLevel, hint[0], `${r.id}: the hinted level must be carried`);
      verified++;
    } else {
      assert.ok(d, `${r.id} does not report the difficulty blocker although ${band} hints ${hint.length} levels`);
      assert.match(d.why, /O4/);
      assert.equal(r.candidate.difficultyLevel, undefined, "a level must not be guessed from a band");
      blocked++;
    }
  }
  assert.equal(blocked, 63, "EASY is the only ambiguous band, and it is on 63 records");
  assert.equal(verified + blocked, 432, "every record must fall on one side or the other");
});

console.log("\ndeterminism and isolation");

test("two runs produce identical output", () => {
  const a = JSON.stringify(entries.map((entry) => transformRecord(entry)));
  const b = JSON.stringify(loadRecords().map((entry) => transformRecord(entry)));
  assert.equal(a, b);
});

test("the engine writes nothing into the canonical corpus", () => {
  // `migrate()` without --write must not touch the filesystem at all, and the
  // write path is an isolated directory, never `records/`.
  const report = migrate();
  assert.equal(report.wrote, null);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
