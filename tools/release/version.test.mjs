// Tests for the product-version tool.
//
// Plain Node with node:assert, like the preflight and nexus-sync suites, so the
// tool stays dependency-free and runnable anywhere Node is:
// `node tools/release/version.test.mjs`.
//
// Two things are worth testing beyond the happy path, and both are here: that a
// rewrite preserves a file a human maintains (line endings, key order,
// indentation, trailing newline), and that a refusal writes *nothing* rather
// than some of the six files.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CHANNELS,
  REPO_ROOT,
  VERSION_SOURCES,
  applySet,
  checkVersions,
  compareVersions,
  parseCargoVersion,
  parseJsonVersion,
  parseVersion,
  planSet,
  readVersions,
  setCargoVersion,
  setJsonVersion
} from "./version.mjs";

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

console.log("release version tests\n");
console.log("the format the policy allows");

test("accepts a plain release version", () => {
  const v = parseVersion("1.2.3");
  assert.equal(v.major, 1);
  assert.equal(v.minor, 2);
  assert.equal(v.patch, 3);
  assert.equal(v.prerelease, false);
  assert.equal(v.channel, null);
});

test("accepts each channel the policy names, with a counter", () => {
  for (const channel of CHANNELS) {
    const v = parseVersion(`0.2.0-${channel}.1`);
    assert.ok(v, channel);
    assert.equal(v.channel, channel);
    assert.equal(v.counter, 1);
    assert.equal(v.prerelease, true);
  }
});

test("rejects what semver allows but an MSI ProductVersion cannot carry", () => {
  // Every one of these is valid semver. None of them survives the installer's
  // numeric version field, which is why the policy is narrower than semver.
  for (const bad of ["1.2.3+abc123", "1.2.3-beta", "1.2.3-beta.1+sha", "1.2", "1.2.3.4", "v1.2.3", "1.2.3-nightly.1"]) {
    assert.equal(parseVersion(bad), null, bad);
  }
});

test("rejects numbers past the installer's field widths", () => {
  assert.equal(parseVersion("256.0.0"), null);
  assert.equal(parseVersion("0.256.0"), null);
  assert.equal(parseVersion("0.0.65536"), null);
  assert.ok(parseVersion("255.255.65535"));
});

test("orders a pre-release before its own release, and channels in policy order", () => {
  assert.equal(compareVersions("0.1.0", "0.2.0"), -1);
  assert.equal(compareVersions("0.2.0-rc.1", "0.2.0"), -1);
  assert.equal(compareVersions("0.2.0-alpha.9", "0.2.0-beta.1"), -1);
  assert.equal(compareVersions("0.2.0-rc.1", "0.2.0-rc.2"), -1);
  assert.equal(compareVersions("0.2.0", "0.2.0"), 0);
  assert.equal(compareVersions("1.0.0", "0.9.9"), 1);
});

test("refuses to compare something that is not a policy version", () => {
  assert.throws(() => compareVersions("1.2.3", "1.2.3+build"), /not a policy version/);
});

console.log("\nreading a declaration");

test("reads a top-level version and ignores a dependency range of the same name", () => {
  const pkg = ['{', '  "name": "x",', '  "version": "0.1.0",', '  "dependencies": {', '    "version": "^1.0.0"', '  }', '}'].join("\n");
  assert.equal(parseJsonVersion(pkg), "0.1.0");
});

test("reads a Cargo [package] version, not a dependency's", () => {
  const toml = [
    "[package]",
    'name = "x"',
    'version = "0.1.0"',
    "",
    "[dependencies]",
    'rusqlite = { version = "0.31", features = ["bundled"] }'
  ].join("\n");
  assert.equal(parseCargoVersion(toml), "0.1.0");
});

test("reads nothing when a Cargo file declares no [package] version", () => {
  assert.equal(parseCargoVersion('[dependencies]\nserde = { version = "1" }'), null);
});

console.log("\nwriting a declaration");

test("rewrites a JSON version and changes nothing else", () => {
  const before = '{\n  "name": "x",\n  "version": "0.1.0",\n  "private": true\n}\n';
  const after = setJsonVersion(before, "0.2.0");
  assert.equal(after, '{\n  "name": "x",\n  "version": "0.2.0",\n  "private": true\n}\n');
});

test("preserves CRLF line endings, because the working copies here are CRLF", () => {
  const before = '{\r\n  "name": "x",\r\n  "version": "0.1.0"\r\n}\r\n';
  const after = setJsonVersion(before, "0.2.0");
  assert.ok(after.includes("\r\n"), "line endings were rewritten to LF");
  assert.ok(!/[^\r]\n/.test(after), "a bare LF was introduced");
  assert.equal(parseJsonVersion(after), "0.2.0");
});

test("rewrites only the [package] version in a Cargo file", () => {
  const before = '[package]\nversion = "0.1.0"\n\n[dependencies]\nrusqlite = { version = "0.31" }\n';
  const after = setCargoVersion(before, "0.2.0");
  assert.ok(after.includes('[package]\nversion = "0.2.0"'));
  assert.ok(after.includes('rusqlite = { version = "0.31" }'), "a dependency version was rewritten");
});

test("refuses a file with no version line rather than adding one", () => {
  assert.throws(() => setJsonVersion('{\n  "name": "x"\n}\n', "0.2.0"), /exactly one/);
  assert.throws(() => setCargoVersion("[dependencies]\n", "0.2.0"), /exactly one/);
});

console.log("\nchecking a set of declarations");

test("agreement with a policy-shaped version is clean", () => {
  const c = checkVersions([
    { file: "a", version: "0.1.0" },
    { file: "b", version: "0.1.0" }
  ]);
  assert.deepEqual(c.problems, []);
  assert.equal(c.agree, true);
  assert.equal(c.version, "0.1.0");
});

test("reports a disagreement and names both sides", () => {
  const c = checkVersions([
    { file: "a", version: "0.1.0" },
    { file: "b", version: "0.2.0" }
  ]);
  assert.equal(c.agree, false);
  assert.ok(c.problems.some((p) => p.includes("a=0.1.0") && p.includes("b=0.2.0")), c.problems.join("; "));
  assert.equal(c.version, null);
});

test("reports a missing declaration separately from a disagreement", () => {
  const c = checkVersions([
    { file: "a", version: "0.1.0" },
    { file: "b", version: null }
  ]);
  assert.equal(c.problems.length, 1);
  assert.ok(c.problems[0].includes("no version declared"));
});

test("reports agreement on a version the policy does not admit as a problem anyway", () => {
  // Six files agreeing on "1.0" is still not releasable. Parity alone was the
  // pre-D16 check; the format rule is what D16 added.
  const c = checkVersions([
    { file: "a", version: "1.0" },
    { file: "b", version: "1.0" }
  ]);
  assert.equal(c.agree, true);
  assert.equal(c.problems.length, 2);
  assert.ok(c.problems.every((p) => p.includes("not a policy version")));
});

console.log("\nsetting across a repository");

function fixture(version = "0.1.0", { breakCargo = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "haa-version-"));
  for (const s of VERSION_SOURCES) {
    const file = path.join(root, s.file);
    mkdirSync(path.dirname(file), { recursive: true });
    if (s.kind === "cargo") {
      writeFileSync(
        file,
        breakCargo
          ? '[dependencies]\nserde = { version = "1" }\n'
          : `[package]\nname = "x"\nversion = "${version}"\n\n[dependencies]\nrusqlite = { version = "0.31" }\n`
      );
    } else {
      writeFileSync(file, `{\n  "name": "${s.file}",\n  "version": "${version}",\n  "private": true\n}\n`);
    }
  }
  return root;
}

test("sets every source in one go", () => {
  const root = fixture("0.1.0");
  const plan = planSet("0.2.0", root);
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.writes.length, VERSION_SOURCES.length);
  applySet(plan);
  const after = checkVersions(readVersions(root));
  assert.deepEqual(after.problems, []);
  assert.equal(after.version, "0.2.0");
});

test("a refused plan writes nothing at all, not some of the files", () => {
  const root = fixture("0.1.0", { breakCargo: true });
  const plan = planSet("0.2.0", root);
  assert.ok(plan.problems.length, "expected the broken Cargo file to be a problem");
  assert.throws(() => applySet(plan), /refusing to write/);
  // The five well-formed files must still be at the old version. This is the
  // whole reason planSet is separate from applySet.
  const after = checkVersions(readVersions(root));
  assert.equal(after.version, "0.1.0");
});

test("refuses a version the policy does not admit, before reading anything", () => {
  const root = fixture("0.1.0");
  const plan = planSet("0.2", root);
  assert.ok(plan.problems.some((p) => p.includes("not a policy version")));
  assert.throws(() => applySet(plan), /refusing to write/);
  assert.equal(checkVersions(readVersions(root)).version, "0.1.0");
});

test("setting the version it already has is a no-op, not an error", () => {
  const root = fixture("0.1.0");
  const plan = planSet("0.1.0", root);
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.writes.length, 0);
});

test("converges a repository whose sources had drifted apart", () => {
  const root = fixture("0.1.0");
  writeFileSync(
    path.join(root, "apps/desktop/src-tauri/tauri.conf.json"),
    '{\n  "name": "x",\n  "version": "0.9.9",\n  "private": true\n}\n'
  );
  assert.equal(checkVersions(readVersions(root)).agree, false);
  applySet(planSet("0.2.0", root));
  assert.equal(checkVersions(readVersions(root)).version, "0.2.0");
});

console.log("\nthis repository");

test("every source the policy names exists and declares a policy version", () => {
  const check = checkVersions(readVersions());
  assert.deepEqual(check.problems, [], check.problems.join("; "));
  assert.equal(check.sources.length, 6);
});

test("the four shipping declarations are the ones preflight enforces", () => {
  const shipping = VERSION_SOURCES.filter((s) => s.shipping).map((s) => s.file);
  assert.deepEqual(shipping, [
    "package.json",
    "apps/desktop/package.json",
    "apps/desktop/src-tauri/tauri.conf.json",
    "apps/desktop/src-tauri/Cargo.toml"
  ]);
});

test("the binary reports its own version rather than a JSON file's claim", () => {
  const rs = readFileSync(path.join(REPO_ROOT, "apps/desktop/src-tauri/src/commands.rs"), "utf8");
  assert.ok(/fn get_app_version/.test(rs), "get_app_version is gone");
  assert.ok(/CARGO_PKG_VERSION/.test(rs), "get_app_version no longer reads the crate version");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
