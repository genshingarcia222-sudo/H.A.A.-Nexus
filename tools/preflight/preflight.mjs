// H.A.A. Nexus preflight: one command that answers "what state is this
// repository actually in, and what is blocking it?"
//
// Observability only. It reads; it never edits a decision, never resolves one,
// never touches the repository, and never prints a secret value. Its findings
// are inputs to a human decision, not a substitute for one.
//
//   node tools/preflight/preflight.mjs           human-readable report
//   node tools/preflight/preflight.mjs --json    machine-readable
//
// Exit code is 0 unless the decision register itself is malformed, which is a
// defect in the record rather than a blocked decision.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The one definition of what a releasable version looks like lives with the
// release tool (D16). Importing it keeps preflight and `version.mjs` from
// drifting into two different ideas of the same policy rule. Still zero
// dependencies: it is a sibling module in this repository.
import { parseVersion } from "../release/version.mjs";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// --- repository ------------------------------------------------------------

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

export function repoState() {
  const status = git(["status", "--short"]);
  const head = git(["rev-parse", "HEAD"]);
  const remote = git(["rev-parse", "origin/main"]);
  return {
    branch: git(["branch", "--show-current"]),
    head,
    originMain: remote,
    // Not fetched here: preflight must not reach the network. This compares
    // the last known remote ref, and says so.
    remoteIsLastFetched: true,
    inSyncWithLastFetchedRemote: Boolean(head) && head === remote,
    clean: status === "",
    dirtyEntries: status === "" ? 0 : status.split("\n").length
  };
}

// --- decision register -----------------------------------------------------

const RESOLVED_MARKERS = [/\*\*resolved\b/i, /\*\*implemented\b/i, /^decision:/im];
/**
 * A decision can also stop being a decision. A6 was closed on 2026-10-04 not by
 * being answered but because D8 removed the question, and that is a third
 * outcome: nothing was implemented and nothing is blocked. Reporting it as
 * "resolved" would overstate what was built; reporting it as "blocked" would be
 * false. Checked before the other two, so the heading wins over any wording in
 * the body.
 */
const SUPERSEDED_MARKERS = [/\*\*closed as superseded\b/i, /\*\*superseded\b/i];
const BLOCKED_MARKERS = [/\*\*blocked work:\*\*/i, /\*\*blocked because:\*\*/i, /\*\*decision required/i, /^\*\*options/im];

/**
 * Parses the register into one entry per decision heading.
 *
 * Headings look like `## D1 — Which tier includes Assessment mode?`. A heading
 * without a recognisable decision id (the roadmap and summary sections) is
 * ignored rather than reported as malformed.
 */
export function parseRegister(markdown) {
  const entries = [];
  const problems = [];
  const sections = markdown.split(/^## /m).slice(1);

  for (const section of sections) {
    const heading = section.split("\n")[0].trim();
    const idMatch = /^([DA]\d+(?:\s*[–-]\s*[DA]?\d+)?)\b/.exec(heading);
    if (!idMatch) continue;
    const id = idMatch[1].replace(/\s+/g, "");
    const body = section.slice(heading.length);

    const superseded = SUPERSEDED_MARKERS.some((re) => re.test(body));
    const resolved = !superseded && RESOLVED_MARKERS.some((re) => re.test(body));
    const blocked = !superseded && BLOCKED_MARKERS.some((re) => re.test(body));

    // A range heading (D3–D9) is a pointer to another document, not a decision
    // record of its own, so it is not required to carry blocker evidence.
    const isRange = /[–-]/.test(idMatch[1]) && !/^[DA]\d+$/.test(id);

    if (!resolved && !blocked && !superseded && !isRange) {
      problems.push(`${id}: neither blocked nor resolved - no blocker, options or decision recorded`);
    }
    if (resolved && blocked) {
      problems.push(`${id}: marked both resolved and blocked`);
    }

    const status = superseded ? "superseded" : resolved ? "resolved" : isRange ? "pointer" : "blocked";
    entries.push({ id, heading, status });
  }

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) problems.push(`${entry.id}: duplicate decision id`);
    seen.add(entry.id);
  }

  // Every document the register points at must exist, or the record is stale.
  for (const link of markdown.matchAll(/`(docs\/[A-Za-z0-9_\-.]+\.md)`|\((docs\/[A-Za-z0-9_\-.]+\.md)\)/g)) {
    const target = link[1] || link[2];
    if (!existsSync(path.join(REPO_ROOT, target))) problems.push(`broken reference: ${target}`);
  }

  return { entries, problems };
}

export function decisionState() {
  const file = path.join(REPO_ROOT, "docs/DECISION_REGISTER.md");
  if (!existsSync(file)) {
    return { entries: [], problems: ["docs/DECISION_REGISTER.md is missing"], present: false };
  }
  return { ...parseRegister(readFileSync(file, "utf8")), present: true };
}

// --- scenario content ------------------------------------------------------

function scenarioFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return scenarioFiles(full);
    return entry.endsWith(".json") ? [full] : [];
  });
}

/**
 * Structural readiness only. Schema validity, sourceFact tracing and the
 * content-hash drift gate are already enforced by the content-QA suite in
 * nexus-core; repeating them here would mean two sources of truth.
 */
export function scenarioReadiness() {
  const files = scenarioFiles(path.join(REPO_ROOT, "content/scenarios"));
  const byDifficulty = {};
  const keys = new Map();
  const problems = [];

  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      problems.push(`${path.relative(REPO_ROOT, file)}: not valid JSON`);
      continue;
    }
    const key = `${parsed.scenarioId}@${parsed.version}`;
    if (keys.has(key)) {
      problems.push(`duplicate scenario ${key} in ${path.relative(REPO_ROOT, file)} and ${keys.get(key)}`);
    }
    keys.set(key, path.relative(REPO_ROOT, file));
    const d = parsed.difficulty;
    byDifficulty[d] = (byDifficulty[d] || 0) + 1;
  }

  const missingBands = [1, 2, 3, 4, 5, 6].filter((d) => !byDifficulty[d]);
  return { count: files.length, byDifficulty, missingBands, problems };
}

// --- competency domains ----------------------------------------------------

function countArrayEntries(source, marker) {
  const at = source.indexOf(marker);
  if (at === -1) return null;
  const open = source.indexOf("[", at);
  const close = source.indexOf("]", open);
  if (open === -1 || close === -1) return null;
  return (source.slice(open, close).match(/"/g) || []).length / 2;
}

/**
 * A2 is closed (2026-10-04). There is no longer a mismatch to measure, because
 * there is no longer a second list: `competencyDomains` was removed from
 * `NexusModule`, and the domains live once in nexus-core as
 * `COMPETENCY_DOMAINS`, guarded by `satisfies` against `ScoringWeights`.
 *
 * The check is kept rather than deleted, for the reason A9's was: a check that
 * quietly disappears reads as "the problem went away". It now reports the one
 * source and fails if a competing declaration reappears.
 */
export function competencyReadiness() {
  const modules = path.join(REPO_ROOT, "apps/desktop/src/modules.ts");
  const types = path.join(REPO_ROOT, "packages/nexus-core/src/scenario-engine/types.ts");
  const registry = existsSync(modules) ? countArrayEntries(readFileSync(modules, "utf8"), "competencyDomains") : null;
  const canonical = existsSync(types) ? countArrayEntries(readFileSync(types, "utf8"), "COMPETENCY_DOMAINS") : null;
  const problems = [];
  if (registry !== null) {
    problems.push(`apps/desktop/src/modules.ts declares competencyDomains again (${registry} entries) - A2 removed it`);
  }
  if (canonical === null) {
    problems.push("packages/nexus-core/src/scenario-engine/types.ts no longer exports COMPETENCY_DOMAINS");
  }
  return { registryDomains: registry, canonicalDomains: canonical, singleSource: problems.length === 0, problems };
}

// --- scenario schema version (A9) ------------------------------------------

/**
 * A9 is closed (2026-10-04): `scenarioSchemaVersion` was removed rather than
 * given an invented value, so there is no longer a placeholder to report.
 *
 * This still reports, because a silent disappearance would read as "the problem
 * went away". It now asserts the opposite thing: that the field has *not* come
 * back without the compatibility policy A9 required.
 */
export function schemaVersionReadiness() {
  const modules = path.join(REPO_ROOT, "apps/desktop/src/modules.ts");
  if (!existsSync(modules)) return { declared: null, placeholder: false, resolved: true };
  const match = /scenarioSchemaVersion:\s*"([^"]+)"/.exec(readFileSync(modules, "utf8"));
  const declared = match ? match[1] : null;
  return { declared, placeholder: declared === "0.0.0-unbuilt", resolved: declared === null };
}

// --- providers -------------------------------------------------------------

function onPath(binary) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [binary], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Provider readiness without ever revealing a credential.
 *
 * Only the *names* of configured variables are reported, plus a mode derived
 * from a key prefix. No value is printed, returned or logged.
 */
export function providerReadiness(env = process.env) {
  const paymongoVars = Object.keys(env).filter((k) => /^PAYMONGO_/i.test(k));
  const key = env.PAYMONGO_SECRET_KEY || env.PAYMONGO_PUBLIC_KEY || "";
  const mode = !key ? "unconfigured" : /^sk_test|^pk_test/.test(key) ? "test" : /^sk_live|^pk_live/.test(key) ? "live" : "unknown";

  return {
    tunnel: {
      cloudflared: onPath("cloudflared"),
      tailscale: onPath("tailscale"),
      ngrok: onPath("ngrok"),
      anyInstalled: onPath("cloudflared") || onPath("tailscale") || onPath("ngrok")
    },
    paymongo: {
      configuredVariableNames: paymongoVars.sort(),
      mode
    }
  };
}

// --- version parity (P9-D) -------------------------------------------------

function jsonVersion(rel) {
  const file = path.join(REPO_ROOT, rel);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

/**
 * The `version` of a Cargo.toml's `[package]` table.
 *
 * Read by walking tables rather than with one regex, because dependency
 * tables carry their own `version` keys (`rusqlite = { version = "0.31" }`)
 * and a file-wide match would sometimes return one of those instead.
 */
export function parseCargoPackageVersion(text) {
  let table = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const header = /^\[([^\]]+)\]$/.exec(trimmed);
    if (header) {
      table = header[1];
      continue;
    }
    if (table !== "package") continue;
    const match = /^version\s*=\s*"([^"]+)"/.exec(trimmed);
    if (match) return match[1];
  }
  return null;
}

function cargoPackageVersion(rel) {
  const file = path.join(REPO_ROOT, rel);
  if (!existsSync(file)) return null;
  return parseCargoPackageVersion(readFileSync(file, "utf8"));
}

/**
 * Whether a set of declared versions agrees. Pure, so the disagreement and
 * missing-version paths are testable without a repository that has them.
 */
export function parseVersionParity(sources) {
  const problems = [];
  for (const source of sources) {
    if (source.version === null || source.version === undefined) {
      problems.push(`${source.file}: no version declared`);
    } else if (!parseVersion(source.version)) {
      // Agreement alone was the pre-D16 check. Six files agreeing on "1.0" is
      // still not releasable, because the installer's version field cannot
      // carry it - so the format the release policy admits is checked here too.
      problems.push(`${source.file}: "${source.version}" is not a releasable version (docs/RELEASE_POLICY.md)`);
    }
  }

  const declared = sources.filter((s) => s.version !== null && s.version !== undefined);
  const distinct = [...new Set(declared.map((s) => s.version))];
  if (distinct.length > 1) {
    problems.push(`versions disagree: ${declared.map((s) => `${s.file}=${s.version}`).join(", ")}`);
  }

  return {
    sources,
    distinct,
    agree: problems.length === 0,
    policyFormat: sources.every((s) => s.version && parseVersion(s.version)),
    problems
  };
}

/**
 * The four places this product declares its version, and whether they agree.
 *
 * Phase 9 item P9-D records that nothing enforced agreement between them
 * (docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md §4). A disagreement ships an
 * installer whose advertised version does not match the binary inside it,
 * which is a release defect rather than a style preference — so it is measured
 * here instead of being left to a checklist someone has to remember.
 *
 * This reports parity; it does not choose a versioning scheme. Which scheme
 * the project adopts, how releases are cut and what channels exist is decision
 * **D16**, which is open. Nothing here presumes an answer to it.
 */
export function versionParity() {
  return parseVersionParity([
    { label: "root package.json", file: "package.json", version: jsonVersion("package.json") },
    { label: "desktop package.json", file: "apps/desktop/package.json", version: jsonVersion("apps/desktop/package.json") },
    { label: "tauri.conf.json", file: "apps/desktop/src-tauri/tauri.conf.json", version: jsonVersion("apps/desktop/src-tauri/tauri.conf.json") },
    { label: "Cargo.toml [package]", file: "apps/desktop/src-tauri/Cargo.toml", version: cargoPackageVersion("apps/desktop/src-tauri/Cargo.toml") }
  ]);
}

// --- report ----------------------------------------------------------------

export function collect() {
  return {
    repository: repoState(),
    decisions: decisionState(),
    scenarios: scenarioReadiness(),
    competency: competencyReadiness(),
    schemaVersion: schemaVersionReadiness(),
    versionParity: versionParity(),
    providers: providerReadiness()
  };
}

function render(r) {
  const lines = [];
  const yn = (b) => (b ? "yes" : "no");

  lines.push("H.A.A. Nexus preflight");
  lines.push("");
  lines.push("REPOSITORY");
  lines.push(`  branch                ${r.repository.branch}`);
  lines.push(`  HEAD                  ${r.repository.head.slice(0, 7)}`);
  lines.push(`  matches origin/main   ${yn(r.repository.inSyncWithLastFetchedRemote)} (last fetched ref, not re-fetched)`);
  lines.push(`  working tree clean    ${yn(r.repository.clean)}${r.repository.clean ? "" : ` (${r.repository.dirtyEntries} entries)`}`);

  lines.push("");
  lines.push("DECISIONS");
  const blocked = r.decisions.entries.filter((e) => e.status === "blocked");
  const resolved = r.decisions.entries.filter((e) => e.status === "resolved");
  const superseded = r.decisions.entries.filter((e) => e.status === "superseded");
  lines.push(`  recorded              ${r.decisions.entries.length}`);
  lines.push(`  blocked               ${blocked.length}${blocked.length ? `  (${blocked.map((e) => e.id).join(", ")})` : ""}`);
  lines.push(`  resolved              ${resolved.length}${resolved.length ? `  (${resolved.map((e) => e.id).join(", ")})` : ""}`);
  lines.push(`  superseded            ${superseded.length}${superseded.length ? `  (${superseded.map((e) => e.id).join(", ")})` : ""}`);
  for (const p of r.decisions.problems) lines.push(`  PROBLEM               ${p}`);

  lines.push("");
  lines.push("SCENARIOS");
  lines.push(`  packages              ${r.scenarios.count}`);
  lines.push(
    `  by difficulty         ${Object.entries(r.scenarios.byDifficulty).map(([d, n]) => `D${d}:${n}`).join("  ") || "none"}`
  );
  lines.push(`  difficulty bands with no content   ${r.scenarios.missingBands.map((d) => `D${d}`).join(", ") || "none"}`);
  for (const p of r.scenarios.problems) lines.push(`  PROBLEM               ${p}`);

  lines.push("");
  lines.push("COMPETENCY (A2 - closed 2026-10-04)");
  lines.push(`  canonical domains     ${r.competency.canonicalDomains ?? "unknown"}  (nexus-core COMPETENCY_DOMAINS, the only declaration)`);
  lines.push(`  single source         ${yn(r.competency.singleSource)}`);
  for (const p of r.competency.problems) lines.push(`  PROBLEM               ${p}`);

  lines.push("");
  lines.push("SCENARIO SCHEMA VERSION (A9 - closed 2026-10-04)");
  lines.push(`  declared              ${r.schemaVersion.declared ?? "none (field removed)"}`);
  if (!r.schemaVersion.resolved) {
    lines.push(`  PROBLEM               the field is back as "${r.schemaVersion.declared}" - A9 requires a compatibility policy with it`);
  }

  lines.push("");
  lines.push("VERSION PARITY (P9-D)");
  for (const source of r.versionParity.sources) {
    lines.push(`  ${source.label.padEnd(20)}  ${source.version ?? "none"}`);
  }
  lines.push(`  agree                 ${yn(r.versionParity.agree)}`);
  lines.push(`  releasable format     ${yn(r.versionParity.policyFormat)}  (docs/RELEASE_POLICY.md)`);
  for (const p of r.versionParity.problems) lines.push(`  PROBLEM               ${p}`);

  lines.push("");
  lines.push("PROVIDERS");
  lines.push(`  tunnel installed      ${yn(r.providers.tunnel.anyInstalled)} (cloudflared ${yn(r.providers.tunnel.cloudflared)}, tailscale ${yn(r.providers.tunnel.tailscale)}, ngrok ${yn(r.providers.tunnel.ngrok)})`);
  lines.push(`  PayMongo mode         ${r.providers.paymongo.mode}`);
  lines.push(
    `  PayMongo variables    ${r.providers.paymongo.configuredVariableNames.join(", ") || "none"}  (names only; values are never read out)`
  );

  return lines.join("\n");
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const report = collect();
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : render(report));
  // Only a malformed register is an error: a blocked decision is the normal
  // state of this project and must not fail a preflight run.
  process.exit(report.decisions.problems.length > 0 ? 1 : 0);
}
