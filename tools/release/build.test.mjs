// Tests for the release build runner.
//
// The defect being pinned is specific and it really happened: the 0.1.0 release
// build was invoked as `... tauri build 2>&1 | tail -25` and then read `$?`,
// which is the status of `tail`. A failed build would have printed
// `BUILD_EXIT=0`. These tests prove the runner cannot be fooled that way, and
// one of them reproduces the old defect so the difference is visible rather
// than asserted.
//
// No real release build is run. Failure is produced with a controlled command,
// because the way to test a failure path is not to break the product.
//
// `node tools/release/build.test.mjs`
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  REPO_ROOT,
  classifyMutation,
  firstErrors,
  isContentIdentical,
  newlyDirty,
  runProcess,
  succeeded,
  treeState
} from "./build.mjs";

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

console.log("release build runner tests\n");
console.log("the exit status is the build's own");

test("a successful command reports success", () => {
  const out = runProcess(process.execPath, ["-e", "console.log('built')"]);
  assert.equal(out.code, 0);
  assert.ok(succeeded(out));
  assert.match(out.log, /built/);
});

test("a failing command reports its own non-zero status", () => {
  const out = runProcess(process.execPath, ["-e", "process.exit(3)"]);
  assert.equal(out.code, 3);
  assert.equal(succeeded(out), false);
});

test("THE DEFECT: reading the last stage of a pipeline hides a failed build", () => {
  // What the 0.1.0 build did: `tauri build 2>&1 | tail -25` then `$?`. A
  // pipeline's status is its LAST stage, so the status read belonged to `tail`.
  // Reproduced here without a shell, so it runs the same on every platform and
  // the arithmetic of the defect is explicit rather than quoted.
  const build = runProcess(process.execPath, ["-e", "console.log('boom'); process.exit(3)"]);
  const logFilter = runProcess(process.execPath, ["-e", "process.exit(0)"]);

  // `$?` after the pipeline === the filter's status.
  assert.equal(logFilter.code, 0, "the log filter succeeds, as it almost always does");
  assert.equal(build.code, 3, "while the build itself failed");

  // So the old command would have reported BUILD_EXIT=0 for a failed build.
  // The runner reads the build, never the filter.
  assert.notEqual(build.code, logFilter.code, "which is exactly why one must not stand in for the other");
  assert.equal(succeeded(build), false);
  assert.equal(succeeded(logFilter), true);
});

test("the same defect, through a real shell pipeline, where one is available", () => {
  // The portable test above is the one that must always pass. This one proves
  // the shell really behaves that way, and skips rather than fails where bash
  // is not spawnable (Windows without a POSIX shell on PATH).
  let shellStatus;
  try {
    shellStatus = execSync(
      `${JSON.stringify(process.execPath)} -e "process.exit(3)" 2>&1 | tail -5; echo $?`,
      { shell: "bash", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    console.log("        (skipped: no spawnable bash)");
    return;
  }
  assert.equal(shellStatus, "0", "the pipeline really does hide a failure");
});

test("a failure is still a failure when the log is long", () => {
  // The old command only ever displayed the last 25 lines. A runner that
  // decided success from what it displayed would pass this wrongly.
  const out = runProcess(process.execPath, [
    "-e",
    "for (let i = 0; i < 400; i++) console.log('line ' + i); process.exit(7)"
  ]);
  assert.equal(out.code, 7);
  assert.equal(succeeded(out), false);
  assert.ok(out.log.split("\n").length > 300, "the whole log is kept, not just a tail");
});

test("a command that cannot be spawned is a failure, not a zero", () => {
  const out = runProcess("definitely-not-a-real-binary-xyz", []);
  assert.equal(succeeded(out), false);
  assert.notEqual(out.code, 0);
  assert.ok(out.spawnError, "the spawn error is reported rather than swallowed");
});

test("succeeded() rejects a signal kill, which leaves status null", () => {
  assert.equal(succeeded({ code: 1, signal: "SIGKILL", spawnError: null }), false);
  assert.equal(succeeded({ code: 0, signal: "SIGKILL", spawnError: null }), false);
  assert.equal(succeeded({ code: 0, signal: null, spawnError: null }), true);
});

console.log("\nthe first error is surfaced, not the tail");

test("finds a cargo error from the top of the log", () => {
  const log = [
    "   Compiling haa-nexus-desktop v0.1.0",
    "error[E0425]: cannot find value `nope` in this scope",
    ...Array.from({ length: 50 }, (_, i) => `note: line ${i}`),
    "error: could not compile `haa-nexus-desktop` (bin) due to 1 previous error"
  ].join("\n");
  const errors = firstErrors(log);
  assert.match(errors[0], /E0425/, "the cause comes first, not the summary");
});

test("returns nothing for a clean log", () => {
  assert.deepEqual(firstErrors("   Compiling\n    Finished `release` profile\n"), []);
});

test("catches a rust panic and a pnpm failure", () => {
  assert.ok(firstErrors("thread 'main' panicked at src/main.rs:1").length === 1);
  assert.ok(firstErrors("ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  oops").length === 1);
});

console.log("\nbuild-generated working-tree changes");

test("newlyDirty reports only what the build added", () => {
  const before = new Map([["already.txt", " M"]]);
  const after = new Map([
    ["already.txt", " M"],
    ["apps/desktop/src-tauri/Cargo.toml", " M"]
  ]);
  assert.deepEqual(newlyDirty(before, after), ["apps/desktop/src-tauri/Cargo.toml"]);
});

test("treeState parses git status into path and code", () => {
  const state = treeState();
  assert.ok(state instanceof Map);
  for (const [p, code] of state) {
    assert.equal(typeof p, "string");
    assert.equal(code.length, 2);
  }
});

test("a line-ending-only rewrite is classified content-identical", () => {
  // Reproduced in a disposable repository rather than on the real Cargo.toml,
  // so the real release manifest is never touched to prove a point about it.
  const dir = mkdtempSync(path.join(tmpdir(), "nexus-build-test-"));
  const file = path.join(dir, "Cargo.toml");
  const run = (args) => runProcess("git", args, { cwd: dir });

  run(["init", "-q"]);
  run(["config", "user.email", "t@test"]);
  run(["config", "user.name", "t"]);
  // The real repository's arrangement: git normalises to LF in the index and
  // hands CRLF to the working tree. Committing a CRLF file therefore stores LF.
  run(["config", "core.autocrlf", "true"]);
  writeFileSync(file, '[package]\r\nname = "x"\r\nversion = "0.1.0"\r\n');
  run(["add", "Cargo.toml"]);
  run(["commit", "-q", "-m", "x"]);

  // What `tauri build` does: identical content, LF endings on disk.
  writeFileSync(file, '[package]\nname = "x"\nversion = "0.1.0"\n');

  assert.equal(
    classifyMutation("Cargo.toml", dir),
    "content-identical",
    "a line-ending-only rewrite must be recognised as safe to restore"
  );
});

test("a real edit is classified semantic and must not be restored", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "nexus-build-test-"));
  const file = path.join(dir, "Cargo.toml");
  const run = (args) => runProcess("git", args, { cwd: dir });

  run(["init", "-q"]);
  run(["config", "user.email", "t@test"]);
  run(["config", "user.name", "t"]);
  writeFileSync(file, '[package]\nname = "x"\nversion = "0.1.0"\n');
  run(["add", "Cargo.toml"]);
  run(["commit", "-q", "-m", "x"]);

  // A version bump is exactly the change that must survive.
  writeFileSync(file, '[package]\nname = "x"\nversion = "0.2.0"\n');

  assert.equal(classifyMutation("Cargo.toml", dir), "semantic");
  assert.equal(isContentIdentical("Cargo.toml", dir), false);
});

test("an unmodified file is content-identical, so the check is not vacuous", () => {
  // If `isContentIdentical` answered false for everything, the restore path
  // would never run; if it answered true for everything, a real edit would be
  // discarded. Both directions need a case, and this is the true one.
  //
  // Done in a disposable repository rather than by naming a file in this one.
  // The first version of this test asserted on `package.json` and started
  // failing the moment this package added a script to it - a test that depends
  // on the repository staying still is a test that fails for the wrong reason.
  const dir = mkdtempSync(path.join(tmpdir(), "nexus-build-test-"));
  const run = (args) => runProcess("git", args, { cwd: dir });

  run(["init", "-q"]);
  run(["config", "user.email", "t@test"]);
  run(["config", "user.name", "t"]);
  writeFileSync(path.join(dir, "untouched.toml"), '[package]\nname = "x"\n');
  run(["add", "untouched.toml"]);
  run(["commit", "-q", "-m", "x"]);

  assert.equal(isContentIdentical("untouched.toml", dir), true);
  assert.equal(classifyMutation("untouched.toml", dir), "content-identical");
});

console.log("\nthe runner is wired into the release process");

test("the release policy's gate list names this runner", () => {
  const policy = readFileSync(path.join(REPO_ROOT, "docs/RELEASE_POLICY.md"), "utf8");
  assert.ok(
    /tools\/release\/build\.mjs/.test(policy),
    "the policy still tells a releaser to run a bare `tauri build`"
  );
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
