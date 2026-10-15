// B9 regression: the archive reference's competency-axis table.
//
// The first extraction of this table was contaminated. It paired labels to
// D01-D12 by position after dropping only lines that matched an id exactly, and
// the archive renders the matrix as two column streams that pdftotext offsets by
// two rows - so the header line and every embedded id survived into the label
// text and the pairing was wrong for every row. DEVICE-02 found it
// independently; this suite is what stops it returning.
//
// `node tools/knowledge-corpus/kb-archive-reference.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./kb-schema-divergence.mjs";

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

const ref = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "knowledge-corpus/source/archive-v1-reference.json"), "utf8")
);

console.log("archive v1.0 reference\n");

test("the identity checks still reconcile to 400", () => {
  assert.equal(ref.declaredTotals.seedRecords, 400);
  assert.equal(ref.verification.distinctRecordIdsFound, 400);
  assert.equal(
    ref.declaredTotals.tieredCompetencySeeds + ref.declaredTotals.realisticPremiumCases,
    400
  );
  assert.equal(
    ref.verification.bandCounts.reduce((n, b) => n + b.records, 0),
    400
  );
});

test("there are twenty modules and twelve axes", () => {
  assert.equal(ref.knowledgeModules.length, 20);
  assert.equal(ref.competencyAxes.length, 12);
});

test("module ids are contiguous M01-M20", () => {
  assert.deepEqual(
    ref.knowledgeModules.map((m) => m.moduleId),
    Array.from({ length: 20 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`)
  );
});

test("axis ids are contiguous D01-D12", () => {
  assert.deepEqual(
    ref.competencyAxes.map((a) => a.axisId),
    Array.from({ length: 12 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`)
  );
});

test("B9: no axis label carries an embedded id", () => {
  // This is the exact contamination. A label reading "D05  ICD-10-CM coding
  // support" under axisId D08 is how the first version got every row wrong.
  for (const a of ref.competencyAxes) {
    assert.ok(!/\bD\d{2}\b/.test(a.competency), `${a.axisId} label carries an id: ${a.competency}`);
  }
});

test("B9: no axis label carries column bleed or a header cell", () => {
  for (const a of ref.competencyAxes) {
    assert.ok(!/\s{3,}/.test(a.competency), `${a.axisId} label has column bleed`);
    assert.ok(!/Competency|matrix/i.test(a.competency), `${a.axisId} label is a header cell`);
    assert.ok(a.competency.length > 10, `${a.axisId} label is too short to be real`);
  }
});

test("B9: every axis label is distinct", () => {
  const seen = new Set(ref.competencyAxes.map((a) => a.competency));
  assert.equal(seen.size, 12);
});

test("B9: the privacy axis is D10, which the corpus independently confirms", () => {
  // The pairing is by column-stream order, and this is the row that proves it:
  // records tagged KB-D10 carry privacyFlags at 47% against an 11-17% baseline
  // for every other axis. Same-row pairing would put HIPAA at D09, which sits
  // at baseline.
  const d10 = ref.competencyAxes.find((a) => a.axisId === "D10");
  assert.match(d10.competency, /HIPAA|privacy/i);
});

test("the extraction records its method and its evidence", () => {
  // A derived table that does not say how it was derived is the thing that got
  // shipped wrong the first time.
  assert.match(ref.competencyAxisExtraction.status, /CORRECTED/);
  assert.ok(ref.competencyAxisExtraction.pairingEvidence.length > 80);
  assert.equal(ref.competencyAxisExtraction.pairing, "column-stream order, not same-row");
});

test("the still-missing artifacts are still recorded as missing", () => {
  const missing = ref.alsoNamedButNOTRecovered.map((a) => a.name);
  assert.ok(missing.some((n) => n.endsWith(".jsonl")), "the jsonl must stay recorded as missing");
  for (const a of ref.alsoNamedButNOTRecovered) assert.equal(a.found, false);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
