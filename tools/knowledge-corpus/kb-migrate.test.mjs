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
  isFreeTextRecord,
  toItemDraft,
  toOpenResponseTask,
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
// What `migrate()` actually produces: free-text records take the O9 TASK
// route. Kept separate from `results` on purpose - the assertions above
// describe `transformRecord` in isolation, which is still right for them to
// describe, and conflating the two would make a failure ambiguous.
const routed = entries.map((entry) => {
  if (isFreeTextRecord(entry.record)) return toOpenResponseTask(entry);
  const item = transformRecord(entry);
  if (item.blockedOn.length === 0) return { ...item, target: "ITEM" };
  return toItemDraft(entry, item);
});
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

// O9 replaced this. It used to assert the 114 free-text records were blocked
// structurally because contract B's multiple-choice ITEM family could not
// represent them - true until O9 gave them their own TASK family. The
// replacement asserts more than the original did: that all 114 now migrate,
// that none is blocked, and that none of them acquired choices on the way.
test("O9: all 114 free-text records migrate as TASK, none blocked", () => {
  const tasks = routed.filter((r) => r.target === "TASK");
  assert.equal(tasks.length, 114, "free-text records routed to TASK");
  assert.equal(m.openResponse.freeTextRecords, 114);
  assert.equal(m.openResponse.migratableAsTask, 114);
  assert.equal(m.openResponse.stillBlocked, 0);
  for (const r of tasks) {
    assert.deepEqual(r.blockedOn, [], `${r.id} is blocked`);
  }
});

test("O9: no record is blocked on choices any more", () => {
  // The structural blocker O9 removed. A record still reporting it would mean
  // a free-text record had been routed down the multiple-choice path.
  const structural = routed.filter((r) => r.blockedOn.some((b) => b.field === "choices"));
  assert.equal(structural.length, 0, "no routed record reports a choices blocker");
  assert.equal(m.structurallyBlocked, 0, "and the engine's own report agrees");
});

test("O9: a TASK candidate never carries a choice-only key", () => {
  for (const r of routed.filter((x) => x.target === "TASK")) {
    for (const key of ["choices", "correctChoiceId", "correctChoiceIds", "responseFormat"]) {
      assert.equal(r.candidate[key], undefined, `${r.id} leaked ${key}`);
    }
  }
});

test("the 318 choice-based records are all accounted for, now as drafts", () => {
  // Updated when the draft boundary landed. These used to be blocked outright;
  // 294 are now staged as ITEM_DRAFT with their unresolved requirements named,
  // and 24 stay blocked on a lifecycle status contract B does not define. The
  // assertion is stronger than the original: it pins both halves of the split
  // rather than only "all blocked".
  const items = routed.filter((r) => r.target !== "TASK");
  assert.equal(items.length, 318);
  const represented = items.filter((r) => r.blockedOn.length === 0);
  const blocked = items.filter((r) => r.blockedOn.length > 0);
  assert.equal(represented.length, 294, "represented as drafts");
  assert.equal(blocked.length, 24, "blocked on an unrecognised lifecycle status");
  for (const r of represented) {
    assert.equal(r.candidate.family, "ITEM_DRAFT");
    assert.ok((r.candidate.unresolved ?? []).length > 0, `${r.id} must name what is unresolved`);
  }
  for (const r of blocked) {
    assert.ok(r.blockedOn.some((b) => b.field === "contentStatus"), `${r.id}`);
  }
  // None of them became a production item, which is the point of the boundary.
  assert.equal(items.filter((r) => r.target === "ITEM").length, 0);
  assert.equal(m.recordsExamined, 432);
  assert.equal(m.migratableToday, 408, "114 tasks + 294 drafts");
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
