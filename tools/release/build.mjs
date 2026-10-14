// The Windows release build, run so that its result can be trusted.
//
// Two defects in the 2026-10-14 release build of 0.1.0 are what this exists to
// prevent. Both are recorded in `docs/RELEASE_CANDIDATE_0.1.0.md`.
//
//   1. The build was invoked as `... tauri build 2>&1 | tail -25`, followed by
//      `BUILD_EXIT=$?`. In a shell pipeline `$?` is the status of the **last**
//      command, so that captured `tail`'s success, not Tauri's. A failed build
//      would have reported `BUILD_EXIT=0`. The artifacts happened to exist, so
//      the release was still verifiable - by luck, not by the check.
//
//   2. `tauri build` rewrote `apps/desktop/src-tauri/Cargo.toml` with LF line
//      endings, leaving the working tree dirty after every release build. That
//      is precisely the condition `docs/RELEASE_POLICY.md` section 7 requires to be
//      absent at a release commit, so the next commit either carries the noise
//      or someone reverts a file without checking what changed in it.
//
// The fixes, in order of importance:
//
//   - the child process is spawned **without a shell and without a pipeline**,
//     so the exit status reported is the build's own;
//   - the full log is kept, and the *first* actionable error line is surfaced
//     rather than only the tail;
//   - the working tree is snapshotted before and after; a build-generated
//     mutation is classified as content-identical or semantic, and only a
//     content-identical one is restored - never a blind `git checkout --`.
//
//   node tools/release/build.mjs            build, then report
//   node tools/release/build.mjs --no-restore   report the mutation, change nothing
//
// Exit code is the build's own, or 1 when this tool refuses the result.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Lines that name a real failure, in the order a reader wants them. */
const ERROR_PATTERNS = [
  /^error(\[E\d+\])?:/i,
  /^error /i,
  /\bpanicked at\b/,
  /^\s*Error\b/,
  /\bfailed to\b/i,
  /\bcould not\b/i,
  /^npm ERR!/,
  /^ERR_PNPM/
];

/**
 * Runs a command and returns its **own** exit status.
 *
 * `shell` is deliberately false. With a shell the caller could pass a pipeline,
 * and a pipeline's status is its last stage - the defect this module exists to
 * prevent. `spawnSync` also reports a signal and a spawn failure, both of which
 * a shell would flatten into a number.
 */
export function runProcess(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
    env: options.env ?? process.env
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const log = `${stdout}${stderr}`;

  if (result.error) {
    // The command never ran. That is a failure, and reporting 0 here would be
    // the same class of lie as reading `tail`'s status.
    return { code: 1, log, signal: null, spawnError: String(result.error.message ?? result.error) };
  }

  return {
    // A signal kill leaves `status` null. Null is not success.
    code: result.status === null ? 1 : result.status,
    log,
    signal: result.signal ?? null,
    spawnError: null
  };
}

/** True only for an exit status that genuinely means success. */
export function succeeded(outcome) {
  return outcome.code === 0 && outcome.signal === null && outcome.spawnError === null;
}

/**
 * The first lines of a log that name a failure.
 *
 * A tail shows the summary; the summary is rarely the cause. Cargo prints the
 * first `error[E...]` hundreds of lines before `error: could not compile`, and
 * that first line is the one worth reading.
 */
export function firstErrors(log, limit = 5) {
  const hits = [];
  for (const line of log.split(/\r?\n/)) {
    if (ERROR_PATTERNS.some((re) => re.test(line))) {
      hits.push(line.trim());
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

// --- working-tree mutation -------------------------------------------------

/** `git status --porcelain` as a map of path -> status code. */
export function treeState(cwd = REPO_ROOT) {
  const out = runProcess("git", ["status", "--porcelain"], { cwd });
  if (!succeeded(out)) throw new Error(`git status failed: ${out.log}`);
  const state = new Map();
  for (const line of out.log.split(/\r?\n/)) {
    if (!line.trim()) continue;
    state.set(line.slice(3).trim(), line.slice(0, 2));
  }
  return state;
}

/** Paths dirtied between two snapshots. */
export function newlyDirty(before, after) {
  return [...after.keys()].filter((p) => !before.has(p));
}

/**
 * Whether a tracked file's change is content-identical - a line-ending or
 * whitespace-normalisation difference that `git diff` reports as nothing.
 *
 * This is the check that makes restoring safe. `git diff` applies the
 * repository's own normalisation, so an empty diff on a modified file means the
 * bytes on disk differ from the index while the *content* does not. A semantic
 * edit - a bumped version, an added dependency - produces a non-empty diff and
 * must never be thrown away.
 */
export function isContentIdentical(filePath, cwd = REPO_ROOT) {
  const out = runProcess("git", ["diff", "--", filePath], { cwd });
  if (!succeeded(out)) return false;
  return out.log.replace(/^warning:.*$/gim, "").trim() === "";
}

export function classifyMutation(filePath, cwd = REPO_ROOT) {
  return isContentIdentical(filePath, cwd) ? "content-identical" : "semantic";
}

// --- main ------------------------------------------------------------------

function main(argv) {
  const restore = !argv.includes("--no-restore");

  const head = runProcess("git", ["rev-parse", "HEAD"]);
  const before = treeState();
  if (before.size > 0) {
    console.log("WORKING TREE IS NOT CLEAN before the build:");
    for (const [p, s] of before) console.log(`  ${s} ${p}`);
    console.log("");
    console.log("Release policy section 7 requires a clean tree at the release commit.");
    console.log("Refusing, so that a build-generated change cannot be confused with this one.");
    return 1;
  }

  console.log(`RELEASE COMMIT   ${head.log.trim()}`);
  console.log("BUILDING         pnpm --filter @haa-nexus/desktop exec tauri build");
  console.log("");

  // No shell, no pipeline: the status below is Tauri's own.
  const build = runProcess("npx", ["--yes", "pnpm@9", "--filter", "@haa-nexus/desktop", "exec", "tauri", "build"]);

  const lines = build.log.split(/\r?\n/);
  for (const line of lines.slice(-25)) if (line.trim()) console.log(line);
  console.log("");

  if (!succeeded(build)) {
    console.log(`BUILD FAILED     exit ${build.code}${build.signal ? ` (signal ${build.signal})` : ""}`);
    if (build.spawnError) console.log(`SPAWN ERROR      ${build.spawnError}`);
    const errors = firstErrors(build.log);
    if (errors.length > 0) {
      console.log("");
      console.log("FIRST ERRORS (not the tail - the cause):");
      for (const e of errors) console.log(`  ${e}`);
    }
    console.log("");
    console.log(`full log: ${lines.length} lines, not truncated above except for display`);
    return build.code;
  }

  console.log("BUILD OK         exit 0, from the build process itself, not a pipeline");

  // --- what the build did to the working tree ---
  const after = treeState();
  const dirtied = newlyDirty(before, after);

  if (dirtied.length === 0) {
    console.log("TREE             clean after the build");
    return 0;
  }

  console.log("");
  console.log("BUILD-GENERATED WORKING-TREE CHANGES:");
  let semantic = 0;
  for (const file of dirtied) {
    const kind = classifyMutation(file);
    console.log(`  ${kind.padEnd(18)} ${file}`);
    if (kind === "semantic") semantic += 1;
  }

  if (semantic > 0) {
    console.log("");
    console.log("A build-generated change is SEMANTIC, not just line endings.");
    console.log("Nothing was restored. Read the diff before deciding - a version or a");
    console.log("dependency may legitimately have changed, and discarding it blindly");
    console.log("is exactly what this tool refuses to do.");
    return 1;
  }

  if (!restore) {
    console.log("");
    console.log("--no-restore: leaving the change in place. The tree is dirty.");
    return 0;
  }

  for (const file of dirtied) {
    const out = runProcess("git", ["checkout", "--", file]);
    if (!succeeded(out)) {
      console.log(`FAILED to restore ${file}: ${out.log}`);
      return 1;
    }
  }
  console.log("");
  console.log("RESTORED         every change above was proved content-identical first");
  console.log("TREE             clean");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
