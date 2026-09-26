// Tests for the preflight facility's parsing and classification.
//
// Plain Node with node:assert, so preflight stays dependency-free and runnable
// anywhere Node is: `node tools/preflight/preflight.test.mjs`. The package
// suites (`pnpm -r test`) cover the application; this covers the tool.
import assert from "node:assert/strict";
import { parseRegister, providerReadiness, collect, parseVersionParity, parseCargoPackageVersion } from "./preflight.mjs";

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

console.log("preflight tests\n");
console.log("decision register parsing");

test("reads one entry per decision heading and ignores prose headings", () => {
  const md = [
    "## D1 — A question?",
    "**Blocked work:** something.",
    "## A2 — Another question?",
    "**Blocked because:** reasons.",
    "## What is not blocked",
    "Prose, not a decision."
  ].join("\n\n");
  const { entries, problems } = parseRegister(md);
  assert.deepEqual(entries.map((e) => e.id), ["D1", "A2"]);
  assert.deepEqual(problems, []);
});

test("classifies an entry with options but no verdict as blocked", () => {
  const { entries } = parseRegister("## D10 — Which mechanism?\n\n**Options:**\n\n| a | b |");
  assert.equal(entries[0].status, "blocked");
});

test("classifies an entry carrying a decision as resolved", () => {
  const { entries } = parseRegister("## D1 — Which tier?\n\n**RESOLVED:** the owner chose X.");
  assert.equal(entries[0].status, "resolved");
});

test("flags an entry that records neither a blocker nor a decision", () => {
  // The failure mode this exists for: a decision whose blocker is described
  // only in prose reads as done at a glance, and nothing contradicts it.
  const { problems } = parseRegister("## A6 — Something?\n\nThis depends on D8, informally.");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /A6: neither blocked nor resolved/);
});

test("flags an entry marked both resolved and blocked", () => {
  const { problems } = parseRegister("## A9 — X?\n\n**RESOLVED:** yes.\n\n**Blocked because:** no.");
  assert.ok(problems.some((p) => /A9: marked both/.test(p)));
});

test("flags a duplicate decision id", () => {
  const md = "## D1 — First?\n\n**Blocked work:** a.\n\n## D1 — Again?\n\n**Blocked work:** b.";
  assert.ok(parseRegister(md).problems.some((p) => /duplicate decision id/.test(p)));
});

test("flags a reference to a document that does not exist", () => {
  const { problems } = parseRegister("## D1 — X?\n\n**Blocked work:** see `docs/NOT_A_REAL_DOC.md`.");
  assert.ok(problems.some((p) => /broken reference: docs\/NOT_A_REAL_DOC\.md/.test(p)));
});

test("accepts a reference to a document that exists", () => {
  const { problems } = parseRegister("## D1 — X?\n\n**Blocked work:** see `docs/DECISION_REGISTER.md`.");
  assert.deepEqual(problems, []);
});

test("treats a range heading as a pointer, not a malformed entry", () => {
  const { entries, problems } = parseRegister("## D3–D9 (policy)\n\nRecorded elsewhere.");
  assert.equal(entries[0].status, "pointer");
  assert.deepEqual(problems, []);
});

console.log("\nprovider readiness");

test("reports PayMongo as unconfigured when no variable is set", () => {
  const r = providerReadiness({});
  assert.equal(r.paymongo.mode, "unconfigured");
  assert.deepEqual(r.paymongo.configuredVariableNames, []);
});

test("classifies a test key as test mode and never returns the value", () => {
  const r = providerReadiness({ PAYMONGO_SECRET_KEY: "sk_test_THIS_MUST_NOT_LEAK" });
  assert.equal(r.paymongo.mode, "test");
  assert.deepEqual(r.paymongo.configuredVariableNames, ["PAYMONGO_SECRET_KEY"]);
  assert.ok(!JSON.stringify(r).includes("THIS_MUST_NOT_LEAK"), "the key value must never appear in the report");
});

test("classifies a live key as live mode and never returns the value", () => {
  const r = providerReadiness({ PAYMONGO_PUBLIC_KEY: "pk_live_ALSO_MUST_NOT_LEAK" });
  assert.equal(r.paymongo.mode, "live");
  assert.ok(!JSON.stringify(r).includes("ALSO_MUST_NOT_LEAK"));
});

test("reports an unrecognised key shape as unknown rather than guessing", () => {
  assert.equal(providerReadiness({ PAYMONGO_SECRET_KEY: "something-else" }).paymongo.mode, "unknown");
});

console.log("\nversion parity (P9-D)");

test("agrees when every source declares the same version", () => {
  const r = parseVersionParity([
    { label: "a", file: "package.json", version: "0.1.0" },
    { label: "b", file: "apps/desktop/src-tauri/Cargo.toml", version: "0.1.0" }
  ]);
  assert.equal(r.agree, true);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.distinct, ["0.1.0"]);
});

test("reports which files disagree, and with what, rather than just failing", () => {
  const r = parseVersionParity([
    { label: "a", file: "package.json", version: "0.1.0" },
    { label: "b", file: "apps/desktop/src-tauri/tauri.conf.json", version: "0.2.0" }
  ]);
  assert.equal(r.agree, false);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /package\.json=0\.1\.0/);
  assert.match(r.problems[0], /tauri\.conf\.json=0\.2\.0/);
});

test("treats a missing version as a problem rather than as agreement", () => {
  const r = parseVersionParity([
    { label: "a", file: "package.json", version: "0.1.0" },
    { label: "b", file: "apps/desktop/src-tauri/Cargo.toml", version: null }
  ]);
  assert.equal(r.agree, false);
  assert.ok(r.problems.some((p) => /Cargo\.toml: no version declared/.test(p)));
});

test("reads the [package] version and not a dependency's version", () => {
  const toml = [
    "[package]",
    'name = "haa-nexus-desktop"',
    'version = "0.1.0"',
    "",
    "[dependencies]",
    'rusqlite = { version = "0.31", features = ["bundled"] }',
    'tauri = { version = "2" }'
  ].join("\n");
  assert.equal(parseCargoPackageVersion(toml), "0.1.0");
});

test("reads the [package] version when it is declared after other tables", () => {
  const toml = ['[dependencies]', 'tauri = { version = "2" }', "", "[package]", 'version = "9.9.9"'].join("\n");
  assert.equal(parseCargoPackageVersion(toml), "9.9.9");
});

test("handles CRLF line endings, which the Windows device produces", () => {
  assert.equal(parseCargoPackageVersion('[package]\r\nversion = "1.2.3"\r\n'), "1.2.3");
});

test("returns null rather than guessing when there is no [package] table", () => {
  assert.equal(parseCargoPackageVersion('[dependencies]\nserde = { version = "1" }\n'), null);
});

console.log("\nagainst the real repository");

test("collects a report whose sections are all present", () => {
  const r = collect();
  for (const key of ["repository", "decisions", "scenarios", "competency", "schemaVersion", "versionParity", "providers"]) {
    assert.ok(key in r, `missing section: ${key}`);
  }
});

// This is the P9-D enforcement itself, not a description of it. A version bump
// that updates some of the four files and not the rest fails here, before it
// can ship an installer whose advertised version disagrees with its binary.
test("every version the shipped product declares agrees", () => {
  const v = collect().versionParity;
  assert.equal(v.sources.length, 4, "expected all four version sources to be read");
  assert.deepEqual(v.problems, [], "version parity: " + v.problems.join("; "));
  assert.equal(v.distinct.length, 1, `expected one version across all sources, saw ${v.distinct.join(", ")}`);
});

test("the shipped decision register parses without problems", () => {
  const { problems, entries } = collect().decisions;
  assert.deepEqual(problems, [], "register problems: " + problems.join("; "));
  assert.ok(entries.length >= 7, `expected the register to record at least 7 decisions, saw ${entries.length}`);
});

test("measures the A2 mismatch rather than assuming it", () => {
  const c = collect().competency;
  assert.equal(typeof c.registryDomains, "number");
  assert.equal(typeof c.evaluatorDomains, "number");
});

test("reports no secret values anywhere in a full report", () => {
  const text = JSON.stringify(collect());
  assert.ok(!/sk_live|sk_test|pk_live|pk_test/.test(text), "a key-shaped value reached the report");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
