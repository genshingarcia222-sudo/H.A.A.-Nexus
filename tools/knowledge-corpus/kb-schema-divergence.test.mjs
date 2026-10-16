// Tests for the Knowledgebase schema divergence measurement.
//
// The parser is the part that can lie. A field-name scanner that silently drops
// fields reports the two contracts as further apart than they are, which is
// exactly the wrong way for a measurement feeding decision O1 / D18 to fail.
// The first run of the tool did this, so the comment cases below are
// regressions, not hypotheticals.
import assert from "node:assert/strict";
import {
  stripComments,
  topLevelKeys,
  parseShapes,
  resolveFields,
  compare,
  collect,
  CORE_FAMILY_SCHEMAS
} from "./kb-schema-divergence.mjs";

const failures = [];
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`  FAIL  ${name} - ${e.message}`);
  }
}

console.log("comment stripping");

test("removes a block comment but keeps the field behind it", () => {
  const out = stripComments("{ /** the id */ id: z.string() }");
  assert.ok(!out.includes("the id"));
  assert.match(out, /id:\s*z\.string\(\)/);
});

test("removes a line comment to end of line only", () => {
  const out = stripComments("a: 1, // note\nb: 2");
  assert.ok(!out.includes("note"));
  assert.match(out, /b:\s*2/);
});

test("does not strip // inside a string literal", () => {
  const out = stripComments('url: "https://example.test/x", id: 1');
  assert.ok(out.includes("https://example.test/x"), "a URL is not a comment");
  assert.match(out, /id:\s*1/);
});

test("does not strip /* inside a string literal", () => {
  const out = stripComments('pattern: "/*", id: 1');
  assert.ok(out.includes("/*"));
  assert.match(out, /id:\s*1/);
});

test("handles an escaped quote without swallowing the rest of the file", () => {
  const out = stripComments('a: "he said \\"hi\\"", b: 2');
  assert.match(out, /b:\s*2/);
});

console.log("\ntop-level key extraction");

test("reads keys at depth zero only", () => {
  const { keys } = topLevelKeys("outer: z.object({ inner: z.string() }), sibling: z.number()");
  assert.deepEqual(keys, ["outer", "sibling"], "a nested field must not leak upward");
});

test("reads a commented field - the regression that inflated the divergence", () => {
  const { keys } = topLevelKeys("/** doc */ questionId: z.string(), // trailing\n  domain: z.string()");
  assert.deepEqual(keys.sort(), ["domain", "questionId"]);
});

test("collects spreads separately from keys", () => {
  const { keys, spreads } = topLevelKeys("...recordHeaderShape, family: z.literal('ITEM')");
  assert.deepEqual(keys, ["family"]);
  assert.deepEqual(spreads, ["recordHeaderShape"]);
});

test("is not confused by a comma inside a nested call", () => {
  const { keys } = topLevelKeys("a: z.enum(['x','y']), b: z.string().min(1).max(3)");
  assert.deepEqual(keys, ["a", "b"]);
});

console.log("\nshape parsing and resolution");

const SAMPLE = `
const headerShape = {
  /** stable */ id: z.string(),
  revision: z.number()
};
export const BaseSchema = z.object({
  ...headerShape,
  domain: z.string()
}).strict();
export const ChildSchema = BaseSchema.extend({
  family: z.literal("ITEM"),
  extra: z.string()
}).strict();
export const AltSchema = z.object({ ...headerShape, other: z.string() }).strict();
export const UnionSchema = z.discriminatedUnion("kind", [ChildSchema, AltSchema]).superRefine(() => {});
`;

test("resolves a spread into the field set", () => {
  const shapes = parseShapes(SAMPLE);
  assert.deepEqual(resolveFields(shapes, "BaseSchema").sort(), ["domain", "id", "revision"]);
});

test("resolves an .extend() base transitively", () => {
  const shapes = parseShapes(SAMPLE);
  assert.deepEqual(resolveFields(shapes, "ChildSchema").sort(), ["domain", "extra", "family", "id", "revision"]);
});

test("treats a discriminatedUnion as the union of its members, not as missing", () => {
  const shapes = parseShapes(SAMPLE);
  assert.ok(shapes.UnionSchema, "the union must be recorded");
  assert.deepEqual(shapes.UnionSchema.unionOf, ["ChildSchema", "AltSchema"]);
  assert.deepEqual(resolveFields(shapes, "UnionSchema").sort(), [
    "domain",
    "extra",
    "family",
    "id",
    "other",
    "revision"
  ]);
});

test("a cycle terminates instead of recursing forever", () => {
  const shapes = parseShapes("export const A = B.extend({ a: z.string() });\nexport const B = A.extend({ b: z.string() });");
  assert.deepEqual(resolveFields(shapes, "A").sort(), ["a", "b"]);
});

console.log("\ncomparison arithmetic");

test("splits used keys into mapped and unmapped against the runtime union", () => {
  const branch = { properties: ["id", "packet", "ghost"], required: ["id"] };
  const core = { union: ["id", "statement"] };
  const usage = { records: 2, counts: new Map([["id", 2], ["packet", 2]]), problems: [] };
  const r = compare(branch, core, usage);
  assert.deepEqual(r.mapped, ["id"]);
  assert.deepEqual(r.unmapped, ["packet"]);
  assert.deepEqual(r.declaredUnused, ["ghost"], "a declared-but-unused property costs nothing to migrate");
  assert.deepEqual(r.coreOnly, ["statement"]);
});

test("reports how many records each unmapped key appears on", () => {
  const usage = { records: 3, counts: new Map([["packet", 3], ["steps", 1]]), problems: [] };
  const r = compare({ properties: [], required: [] }, { union: [] }, usage);
  assert.deepEqual(r.strictRejectionRisk, [
    { key: "packet", records: 3 },
    { key: "steps", records: 1 }
  ]);
});

console.log("\nagainst the real repository");

test("every runtime family schema resolves to a non-empty field set", () => {
  const { core } = collect();
  for (const family of Object.keys(CORE_FAMILY_SCHEMAS)) {
    const info = core.families[family];
    assert.ok(info.present, `${family} (${info.schema}) was not found`);
    assert.ok(info.fields.length > 0, `${family} resolved to zero fields`);
  }
});

test("the authored corpus is readable and non-empty", () => {
  const { usage } = collect();
  assert.deepEqual(usage.problems, [], "record problems: " + usage.problems.join("; "));
  assert.ok(usage.records > 0, "no records were read");
});

test("mapped and unmapped together account for every key the corpus uses", () => {
  const { usage, result } = collect();
  assert.equal(result.mapped.length + result.unmapped.length, usage.counts.size);
});

test("the two contracts genuinely diverge, which is the finding O1 rests on", () => {
  const { result } = collect();
  // Deliberately loose: this asserts that a real divergence exists and is
  // measured, not a particular number that every authoring commit would churn.
  assert.ok(result.unmapped.length > 0, "if nothing is unmapped, O1 is not a migration question");
  assert.ok(result.coreOnly.length > 0, "the runtime contract must demand something the records lack");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
