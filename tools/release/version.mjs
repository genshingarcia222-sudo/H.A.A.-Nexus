// H.A.A. Nexus product version: read it, check it against the policy, set it.
//
// The policy is docs/RELEASE_POLICY.md. The part this tool exists to enforce is
// that the version lives in **one** place conceptually and in six places
// mechanically, and that nobody has to edit six files by hand to bump it. A
// version bump done by hand is how an installer ends up advertising a version
// its binary does not carry, which is the release defect Phase 9 item P9-D
// records.
//
//   node tools/release/version.mjs            what each source declares
//   node tools/release/version.mjs check      exit 1 if they disagree or the format is wrong
//   node tools/release/version.mjs set 0.2.0  rewrite all six, or refuse and change nothing
//   node tools/release/version.mjs --json     machine-readable
//
// It writes only version numbers. It does not commit, does not tag, does not
// touch the CHANGELOG, and does not build. Tagging and release approval are
// owner steps by policy, not tool steps.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Every place the product version is declared.
 *
 * The first four are the shipping declarations: two of them reach an end user
 * (the installer's advertised version and the binary's own
 * `CARGO_PKG_VERSION`). The two library packages are private and consumed as
 * `workspace:*`, so no dependency resolution reads their numbers - they are
 * here because the policy is "one repository, one version", and a package
 * sitting at a stale number is a question someone later has to answer.
 */
export const VERSION_SOURCES = [
  { label: "root package.json", file: "package.json", kind: "json", shipping: true },
  { label: "desktop package.json", file: "apps/desktop/package.json", kind: "json", shipping: true },
  { label: "tauri.conf.json", file: "apps/desktop/src-tauri/tauri.conf.json", kind: "json", shipping: true },
  { label: "Cargo.toml [package]", file: "apps/desktop/src-tauri/Cargo.toml", kind: "cargo", shipping: true },
  { label: "nexus-core package.json", file: "packages/nexus-core/package.json", kind: "json", shipping: false },
  { label: "ui-kit package.json", file: "packages/ui-kit/package.json", kind: "json", shipping: false }
];

/** The channels the policy admits for a pre-release. */
export const CHANNELS = ["alpha", "beta", "rc"];

// --- the format the policy allows ------------------------------------------

/**
 * `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-<channel>.<n>`.
 *
 * Deliberately narrower than semver: semver would also accept build metadata
 * (`+sha`), a bare `-beta` with no counter, and arbitrary identifiers. The MSI
 * `ProductVersion` field is numeric and has no representation for any of that,
 * so a version that semver accepts can still be one the installer cannot
 * carry. Narrow here, once, rather than discovering it at bundle time.
 */
export function parseVersion(text) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/.exec(String(text ?? ""));
  if (!m) return null;
  const [, major, minor, patch, channel, counter] = m;
  if (channel && !CHANNELS.includes(channel)) return null;
  // MSI's ProductVersion packs major and minor into single bytes and the build
  // field into 16 bits. Anything above these never reaches an installer.
  if (Number(major) > 255 || Number(minor) > 255 || Number(patch) > 65535) return null;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    channel: channel ?? null,
    counter: channel ? Number(counter) : null,
    prerelease: Boolean(channel),
    text: String(text)
  };
}

/**
 * Policy order, for the updater's "is this newer?" question and for release
 * sequencing. A pre-release precedes its own release, so 0.2.0-rc.1 < 0.2.0.
 */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`not a policy version: ${!x ? a : b}`);
  for (const key of ["major", "minor", "patch"]) {
    if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  }
  if (x.prerelease !== y.prerelease) return x.prerelease ? -1 : 1;
  if (!x.prerelease) return 0;
  if (x.channel !== y.channel) {
    const rank = (c) => CHANNELS.indexOf(c);
    return rank(x.channel) < rank(y.channel) ? -1 : 1;
  }
  if (x.counter !== y.counter) return x.counter < y.counter ? -1 : 1;
  return 0;
}

// --- reading ---------------------------------------------------------------

/**
 * The top-level `version` of a package-shaped JSON file.
 *
 * Read by line with a two-space indent requirement rather than by parsing,
 * because the same tool has to write the value back without reformatting a
 * file a human maintains. `JSON.parse` would lose key order, indentation and
 * the trailing newline; a nested `"version"` (a dependency range) is excluded
 * by the indent.
 */
export function parseJsonVersion(text) {
  const lines = text.split(/\r?\n/);
  const hits = lines.filter((l) => /^ {2}"version"\s*:\s*"[^"]*"\s*,?\s*$/.test(l));
  if (hits.length !== 1) return null;
  return /"version"\s*:\s*"([^"]*)"/.exec(hits[0])[1];
}

export function setJsonVersion(text, version) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let seen = 0;
  const out = lines.map((line) => {
    if (!/^ {2}"version"\s*:\s*"[^"]*"\s*,?\s*$/.test(line)) return line;
    seen++;
    return line.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  });
  if (seen !== 1) throw new Error(`expected exactly one top-level "version" line, found ${seen}`);
  return out.join(eol);
}

/**
 * The `version` of a Cargo.toml's `[package]` table, found by walking tables.
 * A file-wide match would sometimes return a dependency's version instead
 * (`rusqlite = { version = "0.31" }`).
 */
export function parseCargoVersion(text) {
  let table = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const header = /^\[([^\]]+)\]$/.exec(trimmed);
    if (header) {
      table = header[1];
      continue;
    }
    if (table === "package") {
      const m = /^version\s*=\s*"([^"]+)"/.exec(trimmed);
      if (m) return m[1];
    }
  }
  return null;
}

export function setCargoVersion(text, version) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let table = "";
  let seen = 0;
  const out = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    const header = /^\[([^\]]+)\]$/.exec(trimmed);
    if (header) {
      table = header[1];
      return line;
    }
    if (table === "package" && /^version\s*=\s*"[^"]+"/.test(trimmed)) {
      seen++;
      return line.replace(/(version\s*=\s*")[^"]+(")/, `$1${version}$2`);
    }
    return line;
  });
  if (seen !== 1) throw new Error(`expected exactly one [package] version, found ${seen}`);
  return out.join(eol);
}

function readSource(source, repoRoot = REPO_ROOT) {
  const file = path.join(repoRoot, source.file);
  if (!existsSync(file)) return { ...source, version: null, missing: true };
  const text = readFileSync(file, "utf8");
  const version = source.kind === "cargo" ? parseCargoVersion(text) : parseJsonVersion(text);
  return { ...source, version };
}

export function readVersions(repoRoot = REPO_ROOT) {
  return VERSION_SOURCES.map((s) => readSource(s, repoRoot));
}

// --- checking --------------------------------------------------------------

/**
 * Pure, so every failure mode is testable without a repository that has it:
 * a missing declaration, a disagreement, and a version the policy's format
 * does not admit are three different problems and are reported as three.
 */
export function checkVersions(sources) {
  const problems = [];
  for (const s of sources) {
    if (s.version === null || s.version === undefined) problems.push(`${s.file}: no version declared`);
    else if (!parseVersion(s.version)) problems.push(`${s.file}: "${s.version}" is not a policy version (MAJOR.MINOR.PATCH[-${CHANNELS.join("|")}.N])`);
  }
  const declared = sources.filter((s) => s.version);
  const distinct = [...new Set(declared.map((s) => s.version))];
  if (distinct.length > 1) {
    problems.push(`versions disagree: ${declared.map((s) => `${s.file}=${s.version}`).join(", ")}`);
  }
  return { sources, distinct, version: distinct.length === 1 ? distinct[0] : null, agree: distinct.length <= 1, problems };
}

// --- setting ---------------------------------------------------------------

/**
 * Decide the whole rewrite before performing any of it.
 *
 * A half-applied bump is worse than a refused one: it leaves the repository in
 * exactly the disagreeing state P9-D calls a release defect, and it does so
 * silently. So this returns either every write or no write.
 */
export function planSet(next, repoRoot = REPO_ROOT) {
  const parsed = parseVersion(next);
  const problems = [];
  if (!parsed) problems.push(`"${next}" is not a policy version (MAJOR.MINOR.PATCH[-${CHANNELS.join("|")}.N])`);

  const writes = [];
  const sources = readVersions(repoRoot);
  for (const s of sources) {
    if (s.missing) {
      problems.push(`${s.file}: file not found`);
      continue;
    }
    const file = path.join(repoRoot, s.file);
    const before = readFileSync(file, "utf8");
    try {
      const after = s.kind === "cargo" ? setCargoVersion(before, next) : setJsonVersion(before, next);
      if (after !== before) writes.push({ file, rel: s.file, text: after, from: s.version });
    } catch (e) {
      problems.push(`${s.file}: ${e.message}`);
    }
  }

  const current = checkVersions(sources);
  return { next, parsed, current, writes, problems };
}

export function applySet(plan) {
  if (plan.problems.length) throw new Error("refusing to write: " + plan.problems.join("; "));
  for (const w of plan.writes) writeFileSync(w.file, w.text, "utf8");
  return plan.writes.map((w) => w.rel);
}

// --- CLI -------------------------------------------------------------------

function render(check) {
  const lines = ["H.A.A. Nexus product version", ""];
  for (const s of check.sources) {
    lines.push(`  ${s.label.padEnd(26)}  ${s.version ?? "none"}${s.shipping ? "" : "   (private, workspace:*)"}`);
  }
  lines.push("");
  lines.push(`  agree                       ${check.agree ? "yes" : "no"}`);
  lines.push(`  policy format               ${check.problems.some((p) => p.includes("policy version")) ? "no" : "yes"}`);
  for (const p of check.problems) lines.push(`  PROBLEM                     ${p}`);
  return lines.join("\n");
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const asJson = process.argv.includes("--json");
  const command = args[0] ?? "check";

  if (command === "set") {
    const plan = planSet(args[1]);
    if (plan.problems.length) {
      console.error("REFUSED - nothing was written");
      for (const p of plan.problems) console.error("  " + p);
      process.exit(1);
    }
    const written = applySet(plan);
    console.log(`SET ${plan.current.version ?? "(mixed)"} -> ${plan.next}`);
    for (const rel of written) console.log("  wrote  " + rel);
    if (!written.length) console.log("  (every source already declared it)");
    console.log("\nNext, per docs/RELEASE_POLICY.md: run the gates, commit as `release: v" + plan.next + "`, then the owner tags.");
  } else if (command === "check" || command === "show") {
    const check = checkVersions(readVersions());
    console.log(asJson ? JSON.stringify(check, null, 2) : render(check));
    process.exit(command === "check" && check.problems.length ? 1 : 0);
  } else {
    console.error(`unknown command: ${command}\nusage: version.mjs [check|show|set <version>] [--json]`);
    process.exit(2);
  }
}
