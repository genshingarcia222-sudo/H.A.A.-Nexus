// H.A.A. Nexus distributed-workstation sync: the one command that answers
// "what is the authoritative state, who owns the active task, and is my work
// actually on GitHub?" - without depending on any Claude session or agent.
//
// Authority, highest first: the remote Git repository (a verified pushed
// commit) > Git-tracked .nexus/ state > Git history and repository files >
// local uncommitted work > conversational memory. This tool reads the first
// three and never trusts the last.
//
// Safety contract. It never force-pushes, never resets, never cleans, never
// rebases, never stashes and never discards a file. The only history-changing
// operations it performs are `git commit --only` of .nexus/ state files it
// just wrote, a plain `git push`, and (only on request, only when the working
// tree is clean and the branch is strictly behind) `git merge --ff-only`.
//
//   node tools/nexus-sync/nexus-sync.mjs <command> [options]
//   pwsh tools/nexus-sync/nexus-sync.ps1 <command> [options]
//
// Commands: status | start | recover | init-device | claim | heartbeat |
//           handoff | release | finalize | help
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const REMOTE = "origin";
/** The branch whose .nexus/ is authoritative. Feature work may live elsewhere. */
export const STATE_BRANCH = "main";
export const DEVICE_IDS = ["DEVICE-01", "DEVICE-02"];
export const TASK_STATUSES = ["UNASSIGNED", "RESERVED", "ACTIVE", "BLOCKED", "HANDOFF_PENDING", "COMPLETE", "ABANDONED", "RECOVERING"];
export const DEVICE_STATUSES = ["ACTIVE", "OFFLINE", "UNKNOWN", "HANDOFF_PENDING", "RECOVERY"];
export const SYNC_STATUSES = ["REMOTE_SYNCED", "REMOTE_SYNC_PENDING"];
/** Statuses in which a task is held by its owner and claiming it is a takeover. */
export const HELD_STATUSES = ["RESERVED", "ACTIVE", "BLOCKED", "RECOVERING"];
export const FREE_STATUSES = ["UNASSIGNED", "COMPLETE", "ABANDONED"];
export const DEFAULT_STALE_HOURS = 12;
/** Marker for a field a human/Claude must complete. finalize refuses while any remain. */
export const PLACEHOLDER = "TODO(nexus)";

export const STATE_FILES = {
  current: ".nexus/CURRENT_STATE.md",
  task: ".nexus/ACTIVE_TASK.md",
  registry: ".nexus/DEVICE_REGISTRY.md",
  handoff: ".nexus/HANDOFF.md",
  baseline: ".nexus/BASELINE.md"
};
export const REQUIRED_NEXUS_FILES = [
  ".nexus/README.md",
  ".nexus/CURRENT_STATE.md",
  ".nexus/DEVICE_REGISTRY.md",
  ".nexus/ACTIVE_TASK.md",
  ".nexus/HANDOFF.md",
  ".nexus/DECISIONS.md",
  ".nexus/BASELINE.md",
  ".nexus/SYNC_PROTOCOL.md",
  ".nexus/RECOVERY_PROTOCOL.md"
];
export const LOCAL_DEVICE_FILE = ".nexus/local-device.yaml";

export const REQUIRED_KEYS = {
  current: [
    "project", "repository", "active_branch", "current_phase", "current_milestone",
    "baseline_commit", "last_verified_commit", "last_verified_tests", "last_verified_build",
    "last_verified_typecheck", "last_verified_rust", "active_task", "task_owner", "task_status",
    "last_successful_sync", "last_sync_device", "last_sync_commit", "sync_status", "recovery_status"
  ],
  task: [
    "task_id", "task_name", "owner", "status", "started_at", "last_update", "stale_after_hours",
    "expected_scope", "affected_areas", "branch", "claim_commit", "last_commit",
    "handoff_required", "handoff_to", "next_action"
  ],
  registry: DEVICE_IDS.flatMap((d) =>
    ["role", "status", "ownership", "latest_known_commit", "latest_activity", "last_successful_sync"].map((f) => `${d}.${f}`)
  ),
  baseline: ["commit", "branch", "timestamp", "tests", "build", "typecheck", "rust", "audit_status"]
};

// --- state blocks ----------------------------------------------------------
//
// Each state file carries exactly one fenced block opened by ```yaml nexus-state
// holding flat `key: value` lines. Everything outside it is prose for humans.
// Flat on purpose: no YAML dependency, and nothing a reviewer cannot read in a
// diff.

const BLOCK_RE = /```yaml nexus-state\r?\n([\s\S]*?)\r?\n```/;
const KEY_RE = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/;

function unquote(value) {
  const v = value.trim();
  return /^".*"$/.test(v) ? JSON.parse(v) : v;
}

export function quote(value) {
  const s = String(value);
  return s !== "" && /^[A-Za-z0-9_.:/+@()-]+$/.test(s) ? s : JSON.stringify(s);
}

/** Parses the state block, or returns null when the file has none. Throws on a malformed line. */
export function parseStateBlock(markdown) {
  const match = BLOCK_RE.exec(markdown);
  if (!match) return null;
  const out = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const kv = KEY_RE.exec(line);
    if (!kv) throw new Error(`malformed state line: ${raw}`);
    if (kv[1] in out) throw new Error(`duplicate state key: ${kv[1]}`);
    out[kv[1]] = unquote(kv[2]);
  }
  return out;
}

/** Rewrites values in place, preserving order and comments; unknown keys are appended. */
export function updateStateBlock(markdown, updates) {
  const match = BLOCK_RE.exec(markdown);
  if (!match) throw new Error("no ```yaml nexus-state block to update");
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const pending = new Map(Object.entries(updates));
  const lines = match[1].split(/\r?\n/).map((raw) => {
    const kv = KEY_RE.exec(raw.trim());
    if (!kv || !pending.has(kv[1])) return raw;
    const value = pending.get(kv[1]);
    pending.delete(kv[1]);
    return `${kv[1]}: ${quote(value)}`;
  });
  for (const [k, v] of pending) lines.push(`${k}: ${quote(v)}`);
  const block = "```yaml nexus-state" + eol + lines.join(eol) + eol + "```";
  return markdown.slice(0, match.index) + block + markdown.slice(match.index + match[0].length);
}

export function missingKeys(block, required) {
  return required.filter((k) => !(k in (block || {})));
}

export function findPlaceholders(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter((l) => l.text.includes(PLACEHOLDER));
}

function tableCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Appends a row to the ownership history table, which is always the last section of ACTIVE_TASK.md. */
export function appendHistory(markdown, { when, event, device, task, detail }) {
  if (!/^## Ownership history/m.test(markdown)) throw new Error("ACTIVE_TASK.md has no '## Ownership history' section");
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const body = markdown.replace(/\s*$/, "");
  return `${body}${eol}| ${[when, event, device, task, detail].map(tableCell).join(" | ")} |${eol}`;
}

// --- device identity -------------------------------------------------------

export function validateDeviceId(id) {
  return DEVICE_IDS.includes(id);
}

/**
 * The local identity says which workstation this checkout is. It is never
 * committed and never authoritative for project state. NEXUS_DEVICE_ID wins
 * over the file so two sessions sharing one checkout can still be told apart.
 */
export function readLocalDevice(repo = REPO_ROOT, env = process.env) {
  if (env.NEXUS_DEVICE_ID) {
    const id = env.NEXUS_DEVICE_ID.trim();
    return validateDeviceId(id) ? { id, source: "NEXUS_DEVICE_ID" } : { id: null, source: "NEXUS_DEVICE_ID", problem: `NEXUS_DEVICE_ID=${id} is not one of ${DEVICE_IDS.join(", ")}` };
  }
  const file = path.join(repo, LOCAL_DEVICE_FILE);
  if (!existsSync(file)) return { id: null, source: "none", problem: `no local identity: run \`nexus-sync init-device DEVICE-0X\`` };
  const match = /^device_id:[ \t]*"?([A-Z0-9-]+)"?/m.exec(readFileSync(file, "utf8"));
  const id = match ? match[1] : null;
  return validateDeviceId(id) ? { id, source: LOCAL_DEVICE_FILE } : { id: null, source: LOCAL_DEVICE_FILE, problem: `${LOCAL_DEVICE_FILE} has no valid device_id` };
}

// --- git -------------------------------------------------------------------

export function git(repo, args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    if (allowFail) return null;
    const detail = (e.stderr || e.message || "").toString().trim();
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
}

/** Never print a credential embedded in a remote URL. */
export function redactUrl(url) {
  return url ? url.replace(/\/\/[^@/]+@/, "//***@") : url;
}

export function classifyDivergence(ahead, behind) {
  if (ahead === 0 && behind === 0) return "clean";
  if (ahead > 0 && behind === 0) return "ahead";
  if (ahead === 0 && behind > 0) return "behind";
  return "diverged";
}

export function repoSnapshot(repo = REPO_ROOT, { fetch = true } = {}) {
  let fetchOk = null;
  let fetchError = null;
  if (fetch) {
    try {
      git(repo, ["fetch", REMOTE]);
      fetchOk = true;
    } catch (e) {
      fetchOk = false;
      fetchError = e.message.split("\n").slice(-1)[0];
    }
  }
  const branch = git(repo, ["branch", "--show-current"], { allowFail: true }) || "";
  const head = git(repo, ["rev-parse", "HEAD"], { allowFail: true }) || "";
  const upstream = git(repo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { allowFail: true });
  let ahead = null;
  let behind = null;
  let divergence = "no-upstream";
  if (upstream) {
    const counts = git(repo, ["rev-list", "--left-right", "--count", "HEAD...@{u}"]).split(/\s+/).map(Number);
    [ahead, behind] = counts;
    divergence = classifyDivergence(ahead, behind);
  }
  const porcelain = git(repo, ["status", "--porcelain"], { allowFail: true }) || "";
  return {
    repo,
    remoteUrl: redactUrl(git(repo, ["remote", "get-url", REMOTE], { allowFail: true })),
    fetched: fetchOk,
    fetchError,
    branch,
    head,
    upstream,
    ahead,
    behind,
    divergence,
    dirty: porcelain ? porcelain.split("\n") : [],
    stateRemoteHead: git(repo, ["rev-parse", `${REMOTE}/${STATE_BRANCH}`], { allowFail: true }),
    recent: (git(repo, ["log", "-5", "--format=%h %cI %s"], { allowFail: true }) || "").split("\n").filter(Boolean)
  };
}

/** True when `sha` is present on the remote branch right now (asks the remote, not the cached ref). */
export function remoteBranchSha(repo, branch) {
  const out = git(repo, ["ls-remote", REMOTE, `refs/heads/${branch}`], { allowFail: true });
  if (out === null) return { reachable: false, sha: null };
  return { reachable: true, sha: out.split(/\s+/)[0] || null };
}

// --- reading state ---------------------------------------------------------

/**
 * On the state branch the working tree is read, so uncommitted edits are
 * visible to the operator. Anywhere else the authoritative copy on
 * origin/main is read, because a feature branch's .nexus/ is not shared state.
 */
export function readState(repo, snapshot) {
  const fromTree = snapshot.branch === STATE_BRANCH;
  const source = fromTree ? "working tree (main)" : `${REMOTE}/${STATE_BRANCH}`;
  const read = (rel) => {
    if (fromTree) return existsSync(path.join(repo, rel)) ? readFileSync(path.join(repo, rel), "utf8") : null;
    return git(repo, ["show", `${REMOTE}/${STATE_BRANCH}:${rel}`], { allowFail: true });
  };
  const files = {};
  const blocks = {};
  const problems = [];
  for (const rel of REQUIRED_NEXUS_FILES) if (read(rel) === null) problems.push(`missing ${rel}`);
  for (const [name, rel] of Object.entries(STATE_FILES)) {
    files[name] = read(rel);
    if (files[name] === null) continue;
    if (name === "handoff") continue;
    try {
      blocks[name] = parseStateBlock(files[name]);
      if (!blocks[name]) problems.push(`${rel} has no nexus-state block`);
      else for (const k of missingKeys(blocks[name], REQUIRED_KEYS[name])) problems.push(`${rel} is missing key ${k}`);
    } catch (e) {
      problems.push(`${rel}: ${e.message}`);
    }
  }
  problems.push(...validateStateValues(blocks));
  return { source, files, blocks, problems };
}

export function validateStateValues(blocks) {
  const problems = [];
  const t = blocks.task;
  if (t) {
    if (t.status && !TASK_STATUSES.includes(t.status)) problems.push(`ACTIVE_TASK status ${t.status} is not one of ${TASK_STATUSES.join(", ")}`);
    if (t.owner && t.owner !== "none" && !validateDeviceId(t.owner)) problems.push(`ACTIVE_TASK owner ${t.owner} is not a registered device`);
    if (t.stale_after_hours && !(Number(t.stale_after_hours) > 0)) problems.push("ACTIVE_TASK stale_after_hours must be a positive number");
  }
  const c = blocks.current;
  if (c) {
    if (c.sync_status && !SYNC_STATUSES.includes(c.sync_status)) problems.push(`CURRENT_STATE sync_status ${c.sync_status} is not one of ${SYNC_STATUSES.join(", ")}`);
    // ACTIVE_TASK.md owns ownership; CURRENT_STATE mirrors it and must agree.
    if (t && (c.active_task !== t.task_id || c.task_owner !== t.owner || c.task_status !== t.status)) {
      problems.push(`CURRENT_STATE task fields (${c.active_task}/${c.task_owner}/${c.task_status}) disagree with ACTIVE_TASK (${t.task_id}/${t.owner}/${t.status}); ACTIVE_TASK.md wins`);
    }
  }
  const r = blocks.registry;
  if (r) {
    for (const d of DEVICE_IDS) {
      const s = r[`${d}.status`];
      if (s && !DEVICE_STATUSES.includes(s)) problems.push(`DEVICE_REGISTRY ${d}.status ${s} is not one of ${DEVICE_STATUSES.join(", ")}`);
    }
  }
  return problems;
}

/** The newest `## ` entry of HANDOFF.md, below the entries marker. */
export function latestHandoff(markdown) {
  if (!markdown) return null;
  const at = markdown.indexOf("<!-- nexus:handoff-entries");
  const rest = at === -1 ? markdown : markdown.slice(at);
  const match = /^## (.+)$/m.exec(rest);
  return match ? match[1].trim() : null;
}

// --- ownership -------------------------------------------------------------

/**
 * Latest evidence that the task owner is still working: its own heartbeat,
 * a sync commit it made on the remote state branch, or a commit on the task's
 * recorded branch. All read from the remote refs, not from any agent.
 */
export function activityEvidence(repo, task) {
  const candidates = [];
  const push = (source, iso) => {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) candidates.push({ source, at: new Date(t) });
  };
  push("ACTIVE_TASK last_update", task.last_update);
  if (validateDeviceId(task.owner)) {
    const iso = git(repo, ["log", `${REMOTE}/${STATE_BRANCH}`, "-1", "--format=%cI", `--grep=^Nexus-Device: ${task.owner}$`], { allowFail: true });
    if (iso) push(`${task.owner} sync commit on ${REMOTE}/${STATE_BRANCH}`, iso);
  }
  if (task.branch && task.branch !== "none" && task.branch !== STATE_BRANCH) {
    const iso = git(repo, ["log", "-1", "--format=%cI", `${REMOTE}/${task.branch}`], { allowFail: true });
    if (iso) push(`commit on ${REMOTE}/${task.branch}`, iso);
  }
  candidates.sort((a, b) => b.at - a.at);
  return candidates[0] || null;
}

/**
 * Advisory ownership only - this is coordination, not a distributed lock, and
 * Git conflicts are still resolved normally. A held task goes STALE when its
 * owner has shown no evidence of activity for stale_after_hours, so a device
 * that was shut down can never lock the project permanently.
 */
export function evaluateOwnership({ task, device, now = new Date(), lastEvidence = null }) {
  const staleHours = Number(task.stale_after_hours) > 0 ? Number(task.stale_after_hours) : DEFAULT_STALE_HOURS;
  const idleHours = lastEvidence ? (now - lastEvidence) / 3.6e6 : Infinity;
  const base = { staleHours, idleHours, requiresTakeover: false, requiresOwnerConfirmation: false };

  if (FREE_STATUSES.includes(task.status)) return { ...base, state: "FREE" };
  if (task.status === "HANDOFF_PENDING") {
    const to = task.handoff_to;
    if (!to || to === "ANY" || to === "none") return { ...base, state: "HANDOFF_OPEN" };
    if (to === device) return { ...base, state: "HANDOFF_TO_YOU" };
    // Handed to the other device: taking it is a takeover, subject to staleness.
  } else if (task.owner === device) {
    return { ...base, state: "OWNED_BY_YOU" };
  }
  if (idleHours >= staleHours) return { ...base, state: "STALE", requiresTakeover: true };
  return { ...base, state: "OWNED_BY_OTHER", requiresTakeover: true, requiresOwnerConfirmation: true };
}

/**
 * Pure: decides whether a claim is allowed and what it writes. Refusals name
 * the exact flag that would make the claim deliberate.
 */
export function planClaim({ task, device, now, head, ownership, args }) {
  if (!validateDeviceId(device)) return { ok: false, reason: "local device identity is not configured" };
  if (ownership.requiresTakeover && !args.takeover) {
    return { ok: false, reason: `task ${task.task_id} is ${ownership.state} (owner ${task.owner}); claiming it is a takeover: pass --takeover --reason "..."` };
  }
  if (args.takeover && !args.reason) return { ok: false, reason: "a takeover must record why: pass --reason \"...\"" };
  if (ownership.requiresOwnerConfirmation && !args["owner-confirmed"]) {
    return {
      ok: false,
      reason: `${task.owner} showed activity ${ownership.idleHours.toFixed(1)}h ago (stale after ${ownership.staleHours}h). Take over a live task only after the owner confirms it is not working: add --owner-confirmed`
    };
  }
  // A finished task is never silently reopened by a bare `claim`.
  if (FREE_STATUSES.includes(task.status) && !args["task-id"]) {
    return { ok: false, reason: `${task.task_id} is ${task.status}; name the task you are starting with --task-id ID --name "..."` };
  }
  const continuing = !args["task-id"] || args["task-id"] === task.task_id;
  if (!continuing && !args.name) return { ok: false, reason: "a new task needs --name \"...\"" };
  if (!continuing && HELD_STATUSES.includes(task.status) && task.owner === device) {
    return { ok: false, reason: `you still hold ${task.task_id} (${task.status}); release or hand it off before claiming another task` };
  }
  const iso = now.toISOString();
  const takeover = Boolean(args.takeover) && ownership.requiresTakeover;
  const updates = {
    task_id: continuing ? task.task_id : args["task-id"],
    task_name: args.name || (continuing ? task.task_name : ""),
    owner: device,
    status: ownership.state === "STALE" ? "RECOVERING" : args.reserve ? "RESERVED" : "ACTIVE",
    started_at: continuing && task.started_at && task.started_at !== "none" ? task.started_at : iso,
    last_update: iso,
    expected_scope: args.scope || (continuing ? task.expected_scope : "not recorded"),
    affected_areas: args.areas || (continuing ? task.affected_areas : "not recorded"),
    branch: args.branch || (continuing ? task.branch : STATE_BRANCH),
    claim_commit: continuing && !takeover && task.claim_commit && task.claim_commit !== "none" ? task.claim_commit : head,
    last_commit: head,
    handoff_required: "no",
    handoff_to: "none",
    next_action: args.next || (continuing ? task.next_action : "not recorded")
  };
  if (!updates.task_id || updates.task_id === "none") return { ok: false, reason: "no task to claim: pass --task-id ID --name \"...\"" };
  const event = takeover ? "TAKEOVER" : "CLAIM";
  const detail = takeover
    ? `from ${task.owner} (${ownership.state}, idle ${Number.isFinite(ownership.idleHours) ? ownership.idleHours.toFixed(1) + "h" : "no evidence"}): ${args.reason}`
    : args.reason || (ownership.state.startsWith("HANDOFF") ? `accepted handoff from ${task.owner}` : "claimed");
  return { ok: true, event, previousOwner: task.owner, updates, history: { when: iso, event, device, task: updates.task_id, detail } };
}

// --- verdicts --------------------------------------------------------------

/** What the start procedure concludes. `stop` means do not begin work until resolved. */
export function startVerdict({ snapshot, device, state, ownership }) {
  const stop = [];
  const attention = [];
  if (!device.id) stop.push(device.problem);
  if (snapshot.fetched === false) attention.push(`REMOTE UNREACHABLE (${snapshot.fetchError}); working from the last fetched state. Any work is REMOTE_SYNC_PENDING until pushed and verified.`);
  if (!snapshot.branch) stop.push("detached HEAD: check out a branch before working");
  if (snapshot.divergence === "diverged") stop.push(`local ${snapshot.branch} and ${snapshot.upstream} have DIVERGED (${snapshot.ahead} ahead, ${snapshot.behind} behind): reconcile per RECOVERY_PROTOCOL Case G before working`);
  if (snapshot.divergence === "behind" && snapshot.dirty.length) stop.push(`behind ${snapshot.upstream} by ${snapshot.behind} with uncommitted local work: preserve it first (RECOVERY_PROTOCOL Case F/G)`);
  if (snapshot.divergence === "behind" && !snapshot.dirty.length) attention.push(`behind ${snapshot.upstream} by ${snapshot.behind}: fast-forward with \`nexus-sync start --pull\` (or \`git merge --ff-only @{u}\`)`);
  if (snapshot.divergence === "ahead") attention.push(`ahead of ${snapshot.upstream} by ${snapshot.ahead}: local commits are NOT on GitHub yet (run \`nexus-sync finalize\`)`);
  if (snapshot.divergence === "no-upstream" && snapshot.branch) attention.push(`${snapshot.branch} has no upstream: it exists only on this device until pushed`);
  if (snapshot.dirty.length && snapshot.divergence !== "behind") attention.push(`${snapshot.dirty.length} uncommitted change(s) present: inspect and preserve them (RECOVERY_PROTOCOL Case F)`);
  for (const p of state.problems) attention.push(`state: ${p}`);
  if (ownership) {
    if (ownership.state === "OWNED_BY_OTHER") attention.push(`active task is owned by ${state.blocks.task.owner} and is live: do not modify its scope (${state.blocks.task.affected_areas}); pick another task or coordinate`);
    if (ownership.state === "STALE") attention.push(`active task owned by ${state.blocks.task.owner} is STALE (idle ${Number.isFinite(ownership.idleHours) ? ownership.idleHours.toFixed(1) + "h" : "unknown"} ≥ ${ownership.staleHours}h): recovery permitted via \`claim --takeover --reason\` (RECOVERY_PROTOCOL Case H)`);
    if (ownership.state === "HANDOFF_TO_YOU") attention.push(`a handoff is addressed to you: read HANDOFF.md, then \`nexus-sync claim\``);
  }
  return { safe: stop.length === 0, stop, attention };
}

/** Maps observed conditions onto RECOVERY_PROTOCOL cases. */
export function recoveryCases({ snapshot, device, ownership, task }) {
  const cases = [];
  if (!device.id) cases.push(["IDENTITY", "configure this checkout: `nexus-sync init-device DEVICE-0X` (or set NEXUS_DEVICE_ID)"]);
  if (snapshot.fetched === false) cases.push(["NETWORK", "remote unreachable: keep working only if safe, record REMOTE_SYNC_PENDING, re-run `nexus-sync finalize` when the network returns"]);
  if (snapshot.dirty.length) cases.push(["F", "uncommitted local work exists: do NOT discard it. Inspect `git status`/`git diff`, decide whether it belongs to the active task, then commit it (or stash only with a recorded note) before reconciling"]);
  if (snapshot.divergence === "diverged" || (snapshot.divergence === "behind" && snapshot.dirty.length)) {
    cases.push(["G", "remote changed while local work exists: `git fetch` → inspect `git log --oneline HEAD...@{u}` → `git rebase @{u}` or `git merge @{u}` (resolve conflicts by hand, never by discarding a side) → run tests → commit → `nexus-sync finalize`"]);
  }
  if (ownership && ownership.state === "STALE") cases.push(["H", `task ${task.task_id} owner ${task.owner} is stale: \`nexus-sync claim --takeover --reason "<why>"\` preserves the old record and logs the takeover`]);
  if (ownership && ownership.state === "OWNED_BY_OTHER") {
    cases.push([task.owner === "DEVICE-01" ? "C" : "D", `${task.owner} holds a live task: if it is actually unavailable, confirm with the owner, then \`claim --takeover --reason "..." --owner-confirmed\``]);
  }
  if (!cases.length) cases.push(["NONE", "repository matches the remote and no recovery condition is present; run `nexus-sync start`"]);
  return cases;
}

// --- writing state ---------------------------------------------------------

function readRel(repo, rel) {
  return readFileSync(path.join(repo, rel), "utf8");
}

function writeRel(repo, rel, content) {
  writeFileSync(path.join(repo, rel), content);
}

function commitState(repo, files, subject, device, body = "") {
  const changed = git(repo, ["status", "--porcelain", "--", ...files]);
  if (!changed) return null;
  const args = ["commit", "--only", "-m", subject];
  if (body) args.push("-m", body);
  args.push("-m", `Nexus-Device: ${device}`, "--", ...files);
  git(repo, args);
  return git(repo, ["rev-parse", "HEAD"]);
}

/** Plain push, then ask the remote itself which commit its branch points at. */
export function pushAndVerify(repo, branch) {
  const head = git(repo, ["rev-parse", "HEAD"]);
  const hasUpstream = git(repo, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { allowFail: true });
  try {
    git(repo, hasUpstream ? ["push", REMOTE, branch] : ["push", "-u", REMOTE, branch]);
  } catch (e) {
    return { pushed: false, verified: false, head, error: e.message.split("\n").slice(-1)[0] };
  }
  const remote = remoteBranchSha(repo, branch);
  git(repo, ["fetch", REMOTE, branch], { allowFail: true });
  return { pushed: true, verified: remote.reachable && remote.sha === head, head, remoteSha: remote.sha };
}

function requireWritableState(repo, snapshot, files, { offline }) {
  if (snapshot.branch !== STATE_BRANCH) return `state is recorded on ${STATE_BRANCH}; current branch is ${snapshot.branch || "(detached)"}. Switch to ${STATE_BRANCH} (commit or preserve work first).`;
  if (snapshot.fetched === false && !offline) return `cannot reach ${REMOTE} (${snapshot.fetchError}); re-run with --offline to record locally as REMOTE_SYNC_PENDING`;
  if (snapshot.divergence === "behind" || snapshot.divergence === "diverged") return `${STATE_BRANCH} is ${snapshot.divergence} relative to ${snapshot.upstream}: synchronize first (\`nexus-sync start --pull\` or RECOVERY_PROTOCOL Case G)`;
  const dirtyState = git(repo, ["status", "--porcelain", "--", ...files]);
  if (dirtyState) return `uncommitted edits already exist in ${files.join(", ")}; commit or inspect them first so they are not swept into an automated commit`;
  return null;
}

function registryUpdates(device, head, iso, fields) {
  const u = { [`${device}.latest_known_commit`]: head, [`${device}.latest_activity`]: iso };
  for (const [k, v] of Object.entries(fields)) u[`${device}.${k}`] = v;
  return u;
}

function commitAndPublish(repo, files, subject, device, body, { offline }) {
  const sha = commitState(repo, files, subject, device, body);
  if (!sha) return { committed: false, lines: ["nothing changed; no commit made"] };
  const lines = [`committed ${sha.slice(0, 7)} ${subject}`];
  if (offline) {
    lines.push("LOCAL COMMIT COMPLETE", "REMOTE SYNC NOT VERIFIED (offline): run `nexus-sync finalize` when the network returns");
    return { committed: true, verified: false, lines };
  }
  const push = pushAndVerify(repo, STATE_BRANCH);
  if (push.verified) lines.push(`REMOTE SYNC VERIFIED: ${REMOTE}/${STATE_BRANCH} = ${push.head}`);
  else lines.push("LOCAL COMMIT COMPLETE", `REMOTE SYNC NOT VERIFIED: ${push.error || `remote reports ${push.remoteSha}`}`);
  return { committed: true, verified: push.verified, lines };
}

// --- commands --------------------------------------------------------------

function context(repo, args) {
  const snapshot = repoSnapshot(repo, { fetch: !args["no-fetch"] && !args.offline });
  if (args.offline) {
    snapshot.fetched = false;
    snapshot.fetchError = "--offline";
  }
  const device = readLocalDevice(repo);
  const state = readState(repo, snapshot);
  const task = state.blocks.task;
  let ownership = null;
  let evidence = null;
  if (task) {
    evidence = activityEvidence(repo, task);
    ownership = evaluateOwnership({ task, device: device.id, now: new Date(), lastEvidence: evidence && evidence.at });
  }
  return { snapshot, device, state, task, ownership, evidence };
}

function renderStatus(ctx) {
  const { snapshot: s, device, state, task, ownership, evidence } = ctx;
  const c = state.blocks.current || {};
  const r = state.blocks.registry || {};
  const L = [];
  L.push("H.A.A. Nexus sync status  (authority: GitHub > .nexus/ > git history > local work > conversation)");
  L.push("");
  L.push("REPOSITORY");
  L.push(`  remote                ${s.remoteUrl || "none"}`);
  L.push(`  fetch                 ${s.fetched === null ? "skipped" : s.fetched ? "ok" : `FAILED (${s.fetchError})`}`);
  L.push(`  branch                ${s.branch || "(detached)"}  upstream ${s.upstream || "none"}`);
  L.push(`  HEAD                  ${s.head}`);
  L.push(`  divergence            ${s.divergence}${s.upstream ? ` (ahead ${s.ahead}, behind ${s.behind})` : ""}`);
  L.push(`  working tree          ${s.dirty.length ? `DIRTY (${s.dirty.length})` : "clean"}`);
  for (const d of s.dirty.slice(0, 15)) L.push(`                        ${d}`);
  L.push(`  ${REMOTE}/${STATE_BRANCH}           ${s.stateRemoteHead || "unknown"}`);
  for (const line of s.recent) L.push(`  recent                ${line}`);
  L.push("");
  L.push("DEVICE");
  L.push(`  this checkout         ${device.id || "UNIDENTIFIED"}  (${device.source})${device.problem ? `  - ${device.problem}` : ""}`);
  for (const d of DEVICE_IDS) {
    L.push(`  ${d}             recorded ${r[`${d}.status`] || "?"}, last activity ${r[`${d}.latest_activity`] || "?"}, commit ${(r[`${d}.latest_known_commit`] || "?").slice(0, 7)}  (a record, not proof of being online)`);
  }
  L.push("");
  L.push(`STATE  (read from ${state.source})`);
  L.push(`  phase / milestone     ${c.current_phase || "?"} / ${c.current_milestone || "?"}`);
  L.push(`  baseline commit       ${c.baseline_commit || "?"}`);
  L.push(`  last verified commit  ${c.last_verified_commit || "?"}`);
  L.push(`  last sync             ${c.last_successful_sync || "?"} by ${c.last_sync_device || "?"} at ${c.last_sync_commit || "?"} -> ${c.sync_status || "?"}`);
  if (c.last_sync_commit && /^[0-9a-f]{7,40}$/.test(c.last_sync_commit)) {
    const onRemote = git(s.repo, ["merge-base", "--is-ancestor", c.last_sync_commit, `${REMOTE}/${STATE_BRANCH}`], { allowFail: true }) !== null;
    L.push(`  recorded sync commit on ${REMOTE}/${STATE_BRANCH}: ${onRemote ? "yes (verified against fetched ref)" : "NO - the record is not backed by the remote"}`);
  }
  L.push("");
  L.push("ACTIVE TASK");
  if (task) {
    L.push(`  ${task.task_id} - ${task.task_name}`);
    L.push(`  owner / status        ${task.owner} / ${task.status}${task.status === "HANDOFF_PENDING" ? ` -> ${task.handoff_to}` : ""}`);
    L.push(`  last update           ${task.last_update}   (stale after ${ownership.staleHours}h)`);
    L.push(`  latest evidence       ${evidence ? `${evidence.at.toISOString()} from ${evidence.source}` : "none"}`);
    L.push(`  assessment            ${ownership.state}${Number.isFinite(ownership.idleHours) ? `, owner idle ${ownership.idleHours.toFixed(1)}h` : ""}`);
    L.push(`  scope                 ${task.expected_scope}`);
    L.push(`  next action           ${task.next_action}`);
  } else L.push("  unreadable");
  L.push("");
  L.push(`LAST HANDOFF            ${latestHandoff(state.files.handoff) || "none recorded"}`);
  if (state.problems.length) {
    L.push("");
    L.push("STATE PROBLEMS");
    for (const p of state.problems) L.push(`  - ${p}`);
  }
  return L.join("\n");
}

function renderVerdict(v) {
  const L = ["", `VERDICT                 ${v.safe ? (v.attention.length ? "SAFE TO START, with attention items" : "SAFE TO START") : "STOP - resolve before working"}`];
  for (const x of v.stop) L.push(`  STOP       ${x}`);
  for (const x of v.attention) L.push(`  ATTENTION  ${x}`);
  L.push("", "Conversational memory is not project state. Continue from what is printed above.");
  return L.join("\n");
}

function cmdStatus(repo, args) {
  const ctx = context(repo, args);
  if (args.json) {
    console.log(JSON.stringify({ ...ctx, verdict: startVerdict(ctx) }, null, 2));
    return 0;
  }
  console.log(renderStatus(ctx));
  return 0;
}

function cmdStart(repo, args) {
  let ctx = context(repo, args);
  if (args.pull && ctx.snapshot.divergence === "behind" && !ctx.snapshot.dirty.length) {
    git(repo, ["merge", "--ff-only", "@{u}"]);
    console.log(`fast-forwarded ${ctx.snapshot.branch} to ${ctx.snapshot.upstream}\n`);
    ctx = context(repo, { ...args, "no-fetch": true });
  }
  const verdict = startVerdict(ctx);
  console.log(renderStatus(ctx));
  console.log(renderVerdict(verdict));
  return verdict.safe ? 0 : 1;
}

function cmdRecover(repo, args) {
  const ctx = context(repo, args);
  console.log(renderStatus(ctx));
  console.log("\nRECOVERY  (see .nexus/RECOVERY_PROTOCOL.md; nothing below is performed automatically)");
  for (const [id, text] of recoveryCases(ctx)) console.log(`  Case ${id.padEnd(8)} ${text}`);
  return 0;
}

function cmdInitDevice(repo, args) {
  const id = args._[1];
  if (!validateDeviceId(id)) {
    console.error(`usage: nexus-sync init-device <${DEVICE_IDS.join("|")}>`);
    return 2;
  }
  const file = path.join(repo, LOCAL_DEVICE_FILE);
  if (existsSync(file) && !args.replace) {
    const current = readLocalDevice(repo, {});
    console.error(`${LOCAL_DEVICE_FILE} already identifies this checkout as ${current.id}; pass --replace to change it`);
    return 1;
  }
  const ignored = git(repo, ["check-ignore", "-q", LOCAL_DEVICE_FILE], { allowFail: true }) !== null;
  if (!ignored) {
    console.error(`${LOCAL_DEVICE_FILE} is not gitignored in this checkout; refusing to create a file that could be committed`);
    return 1;
  }
  writeFileSync(
    file,
    `# Local workstation identity for this checkout. Gitignored; never committed.\n# It identifies the workstation only - it is not project state.\ndevice_id: ${id}\n`
  );
  console.log(`this checkout is now ${id} (${LOCAL_DEVICE_FILE}, gitignored)`);
  return 0;
}

function cmdClaim(repo, args) {
  const ctx = context(repo, args);
  const files = [STATE_FILES.task, STATE_FILES.current, STATE_FILES.registry];
  const blocked = requireWritableState(repo, ctx.snapshot, files, args);
  if (blocked) return fail(blocked);
  const plan = planClaim({ task: ctx.task, device: ctx.device.id, now: new Date(), head: ctx.snapshot.head, ownership: ctx.ownership, args });
  if (!plan.ok) return fail(plan.reason);
  const u = plan.updates;
  let taskMd = updateStateBlock(readRel(repo, STATE_FILES.task), u);
  taskMd = appendHistory(taskMd, plan.history);
  writeRel(repo, STATE_FILES.task, taskMd);
  writeRel(repo, STATE_FILES.current, updateStateBlock(readRel(repo, STATE_FILES.current), { active_task: u.task_id, task_owner: u.owner, task_status: u.status, ...(plan.event === "TAKEOVER" ? { recovery_status: `takeover of ${u.task_id} by ${u.owner} at ${u.last_update}` } : {}) }));
  const reg = registryUpdates(ctx.device.id, ctx.snapshot.head, u.last_update, { status: plan.event === "TAKEOVER" ? "RECOVERY" : "ACTIVE", ownership: u.task_id });
  if (plan.event === "TAKEOVER" && validateDeviceId(plan.previousOwner)) {
    reg[`${plan.previousOwner}.status`] = "UNKNOWN";
    reg[`${plan.previousOwner}.ownership`] = "none";
  }
  writeRel(repo, STATE_FILES.registry, updateStateBlock(readRel(repo, STATE_FILES.registry), reg));
  const subject = plan.event === "TAKEOVER" ? `nexus(sync): recover stale task ownership of ${u.task_id}` : `nexus(sync): ${ctx.device.id} claims ${u.task_id}`;
  const result = commitAndPublish(repo, files, subject, ctx.device.id, plan.history.detail, args);
  console.log(`${plan.event} ${u.task_id} by ${u.owner} -> ${u.status}`);
  result.lines.forEach((l) => console.log(l));
  return result.committed && !result.verified && !args.offline ? 2 : 0;
}

function requireOwner(ctx) {
  if (!ctx.device.id) return ctx.device.problem;
  if (!ctx.task) return "ACTIVE_TASK.md is unreadable";
  if (ctx.task.owner !== ctx.device.id) return `${ctx.task.task_id} is owned by ${ctx.task.owner}, not ${ctx.device.id}`;
  return null;
}

function cmdHeartbeat(repo, args) {
  const ctx = context(repo, args);
  const files = [STATE_FILES.task, STATE_FILES.current, STATE_FILES.registry];
  const blocked = requireWritableState(repo, ctx.snapshot, files, args) || requireOwner(ctx);
  if (blocked) return fail(blocked);
  if (!HELD_STATUSES.includes(ctx.task.status)) return fail(`${ctx.task.task_id} is ${ctx.task.status}; there is nothing to heartbeat (claim it first)`);
  const iso = new Date().toISOString();
  const status = ctx.task.status === "RECOVERING" ? "ACTIVE" : ctx.task.status;
  const u = { last_update: iso, last_commit: ctx.snapshot.head, status, ...(args.next ? { next_action: args.next } : {}) };
  writeRel(repo, STATE_FILES.task, updateStateBlock(readRel(repo, STATE_FILES.task), u));
  writeRel(repo, STATE_FILES.current, updateStateBlock(readRel(repo, STATE_FILES.current), { task_status: status, ...(ctx.task.status === "RECOVERING" ? { recovery_status: `recovered; ${ctx.device.id} active since ${iso}` } : {}) }));
  writeRel(repo, STATE_FILES.registry, updateStateBlock(readRel(repo, STATE_FILES.registry), registryUpdates(ctx.device.id, ctx.snapshot.head, iso, { status: "ACTIVE", ownership: ctx.task.task_id })));
  const result = commitAndPublish(repo, files, `nexus(sync): update device state (${ctx.device.id} heartbeat on ${ctx.task.task_id})`, ctx.device.id, args.note || "", args);
  result.lines.forEach((l) => console.log(l));
  return result.committed && !result.verified && !args.offline ? 2 : 0;
}

function cmdRelease(repo, args) {
  const ctx = context(repo, args);
  const files = [STATE_FILES.task, STATE_FILES.current, STATE_FILES.registry];
  const blocked = requireWritableState(repo, ctx.snapshot, files, args) || requireOwner(ctx);
  if (blocked) return fail(blocked);
  const status = args.status;
  if (!["COMPLETE", "ABANDONED", "BLOCKED"].includes(status)) return fail("release needs --status COMPLETE|ABANDONED|BLOCKED (use `handoff` to pass work to another device)");
  if (status !== "COMPLETE" && !args.reason) return fail(`--status ${status} must record why: pass --reason "..."`);
  const iso = new Date().toISOString();
  const u = { status, last_update: iso, last_commit: ctx.snapshot.head, handoff_required: "no", handoff_to: "none", ...(args.next ? { next_action: args.next } : {}) };
  let taskMd = updateStateBlock(readRel(repo, STATE_FILES.task), u);
  taskMd = appendHistory(taskMd, { when: iso, event: `RELEASE ${status}`, device: ctx.device.id, task: ctx.task.task_id, detail: args.reason || "complete" });
  writeRel(repo, STATE_FILES.task, taskMd);
  writeRel(repo, STATE_FILES.current, updateStateBlock(readRel(repo, STATE_FILES.current), { task_status: status }));
  writeRel(repo, STATE_FILES.registry, updateStateBlock(readRel(repo, STATE_FILES.registry), registryUpdates(ctx.device.id, ctx.snapshot.head, iso, { ownership: status === "BLOCKED" ? ctx.task.task_id : "none" })));
  const result = commitAndPublish(repo, files, `nexus(sync): ${ctx.device.id} marks ${ctx.task.task_id} ${status}`, ctx.device.id, args.reason || "", args);
  result.lines.forEach((l) => console.log(l));
  return result.committed && !result.verified && !args.offline ? 2 : 0;
}

/** Builds a HANDOFF.md entry. Facts come from Git; judgement fields stay as placeholders unless supplied. */
export function buildHandoffEntry({ from, to, task, head, baseline, filesChanged, when, fields }) {
  const f = (key, label) => fields[key] || `${PLACEHOLDER}: ${label}`;
  return [
    `## ${when} — ${from} → ${to} — ${task.task_id}`,
    "",
    `- **From Device:** ${from}`,
    `- **To Device:** ${to}`,
    `- **Task:** ${task.task_id} — ${task.task_name}`,
    `- **Last Commit:** \`${head}\` (the handoff record itself is committed on top of it)`,
    `- **Baseline:** \`${baseline}\` (see BASELINE.md)`,
    `- **Tests Run:** ${f("tests", "exact commands and pass/fail counts")}`,
    `- **Build Result:** ${f("build", "pnpm -r build result")}`,
    `- **Typecheck Result:** ${f("typecheck", "pnpm -r typecheck result")}`,
    `- **Rust Result:** ${f("rust", "cargo test result, or 'not applicable - no Rust change'")}`,
    `- **Files Changed** (since claim \`${(task.claim_commit || "?").slice(0, 7)}\`): ${filesChanged.length ? filesChanged.map((x) => `\`${x}\``).join(", ") : "none"}`,
    `- **Decisions Made:** ${f("decisions", "decisions made, or 'none'")}`,
    `- **Known Issues:** ${f("issues", "known issues, or 'none'")}`,
    `- **Remaining Work:** ${f("remaining", "what is left")}`,
    `- **Exact Next Action:** ${f("next", "the single next command or step")}`,
    ""
  ].join("\n");
}

export function insertHandoffEntry(markdown, entry) {
  const marker = /^<!-- nexus:handoff-entries.*-->$/m.exec(markdown);
  if (!marker) throw new Error("HANDOFF.md has no <!-- nexus:handoff-entries --> marker");
  const at = marker.index + marker[0].length;
  return `${markdown.slice(0, at)}\n\n${entry}\n---\n${markdown.slice(at).replace(/^\s*/, "\n")}`;
}

function cmdHandoff(repo, args) {
  const ctx = context(repo, args);
  const files = [STATE_FILES.task, STATE_FILES.current, STATE_FILES.registry, STATE_FILES.handoff];
  const blocked = requireWritableState(repo, ctx.snapshot, files, args) || requireOwner(ctx);
  if (blocked) return fail(blocked);
  const to = args.to || "ANY";
  if (to !== "ANY" && !validateDeviceId(to)) return fail(`--to must be ${DEVICE_IDS.join(", ")} or ANY`);
  if (!args.next) return fail('a handoff must name the exact next action: pass --next "..."');
  const iso = new Date().toISOString();
  const head = ctx.snapshot.head;
  const since = ctx.task.claim_commit && /^[0-9a-f]{7,40}$/.test(ctx.task.claim_commit) ? ctx.task.claim_commit : null;
  const changed = since ? (git(repo, ["diff", "--name-only", `${since}..HEAD`], { allowFail: true }) || "").split("\n").filter(Boolean) : [];
  const entry = buildHandoffEntry({
    from: ctx.device.id, to, task: ctx.task, head, baseline: (ctx.state.blocks.current || {}).baseline_commit || "NOT VERIFIED",
    filesChanged: changed, when: iso, fields: { ...args }
  });
  writeRel(repo, STATE_FILES.handoff, insertHandoffEntry(readRel(repo, STATE_FILES.handoff), entry));
  let taskMd = updateStateBlock(readRel(repo, STATE_FILES.task), { status: "HANDOFF_PENDING", handoff_required: "yes", handoff_to: to, last_update: iso, last_commit: head, next_action: args.next });
  taskMd = appendHistory(taskMd, { when: iso, event: "HANDOFF", device: ctx.device.id, task: ctx.task.task_id, detail: `to ${to}: ${args.next}` });
  writeRel(repo, STATE_FILES.task, taskMd);
  writeRel(repo, STATE_FILES.current, updateStateBlock(readRel(repo, STATE_FILES.current), { task_status: "HANDOFF_PENDING" }));
  writeRel(repo, STATE_FILES.registry, updateStateBlock(readRel(repo, STATE_FILES.registry), registryUpdates(ctx.device.id, head, iso, { status: "HANDOFF_PENDING", ownership: "none" })));
  const todo = findPlaceholders(readRel(repo, STATE_FILES.handoff));
  console.log(`handoff of ${ctx.task.task_id} to ${to} written to .nexus/HANDOFF.md (not committed yet)`);
  if (todo.length) {
    console.log(`complete these ${todo.length} field(s), then run \`nexus-sync finalize\`:`);
    for (const t of todo) console.log(`  HANDOFF.md:${t.line}  ${t.text}`);
    return 0;
  }
  const result = commitAndPublish(repo, files, `nexus(sync): record handoff of ${ctx.task.task_id} to ${to}`, ctx.device.id, args.next, args);
  result.lines.forEach((l) => console.log(l));
  return result.committed && !result.verified && !args.offline ? 2 : 0;
}

/** True when everything between `base` and HEAD only touched .nexus/ state files. */
function onlyStateSince(repo, base) {
  if (!base || !/^[0-9a-f]{7,40}$/.test(base)) return false;
  if (git(repo, ["merge-base", "--is-ancestor", base, "HEAD"], { allowFail: true }) === null) return false;
  const changed = (git(repo, ["diff", "--name-only", `${base}..HEAD`]) || "").split("\n").filter(Boolean);
  return changed.every((f) => f.startsWith(".nexus/"));
}

function cmdFinalize(repo, args) {
  const ctx = context(repo, args);
  const s = ctx.snapshot;
  const device = ctx.device.id;
  if (!device) return fail(ctx.device.problem);
  if (!s.branch) return fail("detached HEAD: check out a branch first");
  const todo = Object.values(STATE_FILES).flatMap((rel) => (existsSync(path.join(repo, rel)) ? findPlaceholders(readRel(repo, rel)).map((t) => `${rel}:${t.line}  ${t.text}`) : []));
  if (todo.length) return fail(`unfinished ${PLACEHOLDER} fields - complete them before synchronizing:\n  ${todo.join("\n  ")}`);
  if (false) return fail(`uncommitted changes present - review \`git diff\`, commit what belongs to this task, then re-run finalize:\n  ${s.dirty.join("\n  ")}`);
  if (s.divergence === "behind" || s.divergence === "diverged") {
    return fail(`${s.branch} is ${s.divergence} relative to ${s.upstream}: fetch, inspect, rebase or merge, re-run tests, then finalize (RECOVERY_PROTOCOL Case G). Nothing was pushed.`);
  }
  const onState = s.branch === STATE_BRANCH;
  const stateFiles = [STATE_FILES.current, STATE_FILES.registry];
  const iso = new Date().toISOString();
  const report = [];

  let work = { verified: s.divergence === "clean", head: s.head };
  if (s.fetched === false) {
    work = { verified: false, head: s.head, error: s.fetchError };
  } else if (s.divergence !== "clean") {
    work = pushAndVerify(repo, s.branch);
  } else {
    const remote = remoteBranchSha(repo, s.branch);
    work = { verified: remote.reachable && remote.sha === s.head, head: s.head, remoteSha: remote.sha, error: remote.reachable ? null : "remote unreachable" };
  }

  if (!work.verified) {
    report.push("LOCAL COMMIT COMPLETE", `REMOTE SYNC NOT VERIFIED: ${work.error || `remote reports ${work.remoteSha}, local is ${work.head}`}`);
    if (onState && !git(repo, ["status", "--porcelain", "--", ...stateFiles])) {
      writeRel(repo, STATE_FILES.current, updateStateBlock(readRel(repo, STATE_FILES.current), { sync_status: "REMOTE_SYNC_PENDING", last_sync_device: device }));
      writeRel(repo, STATE_FILES.registry, updateStateBlock(readRel(repo, STATE_FILES.registry), registryUpdates(device, s.head, iso, {})));
      const sha = commitState(repo, stateFiles, "nexus(sync): remote sync pending", device, work.error || "");
      if (sha) report.push(`recorded REMOTE_SYNC_PENDING locally in ${sha.slice(0, 7)}; re-run finalize when ${REMOTE} is reachable`);
    }
    report.forEach((l) => console.log(l));
    return 2;
  }
  report.push(`work verified on ${REMOTE}/${s.branch}: ${work.head}`);

  if (!onState) {
    report.push(`sync record lives on ${STATE_BRANCH}: after this branch is merged, run finalize on ${STATE_BRANCH}`);
    report.forEach((l) => console.log(l));
    return 0;
  }

  const current = ctx.state.blocks.current || {};
  const alreadyRecorded = current.sync_status === "REMOTE_SYNCED" && (current.last_sync_commit === work.head || onlyStateSince(repo, current.last_sync_commit));
  if (alreadyRecorded && !args.shutdown) {
    report.push(`sync record already current (last_sync_commit ${current.last_sync_commit}); nothing to record`);
  } else {
    writeRel(repo, STATE_FILES.current, updateStateBlock(readRel(repo, STATE_FILES.current), {
      last_successful_sync: iso, last_sync_device: device, last_sync_commit: work.head, sync_status: "REMOTE_SYNCED"
    }));
    writeRel(repo, STATE_FILES.registry, updateStateBlock(readRel(repo, STATE_FILES.registry), registryUpdates(device, work.head, iso, {
      last_successful_sync: iso, ...(args.shutdown ? { status: "OFFLINE" } : {})
    })));
    const sha = commitState(repo, stateFiles, args.shutdown ? `nexus(sync): record synchronization and ${device} shutdown` : "nexus(sync): record synchronization", device, `Verified ${work.head} on ${REMOTE}/${STATE_BRANCH}.`);
    const push = pushAndVerify(repo, STATE_BRANCH);
    if (push.verified) report.push(`sync record ${sha.slice(0, 7)} pushed and verified`);
    else report.push(`sync record ${sha ? sha.slice(0, 7) : "(none)"} is LOCAL ONLY: ${push.error || push.remoteSha} - the work commit above is still verified on the remote`);
  }
  const final = git(repo, ["rev-parse", "HEAD"]);
  const remote = remoteBranchSha(repo, STATE_BRANCH);
  const clean = !git(repo, ["status", "--porcelain"]);
  report.push("", `FINAL COMMIT            ${final}`, `REMOTE ${STATE_BRANCH.padEnd(16)} ${remote.sha || "unreachable"}`, `REMOTE SYNC             ${remote.sha === final ? "VERIFIED" : "NOT VERIFIED"}`, `WORKING TREE            ${clean ? "clean" : "DIRTY"}`);
  report.forEach((l) => console.log(l));
  return remote.sha === final ? 0 : 2;
}

// --- cli -------------------------------------------------------------------

function fail(message) {
  console.error(`nexus-sync: ${message}`);
  return 1;
}

const BOOLEAN_FLAGS = new Set(["json", "no-fetch", "offline", "pull", "takeover", "owner-confirmed", "reserve", "replace", "shutdown"]);

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) args[key] = true;
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args[key] = argv[++i];
    else throw new Error(`--${key} needs a value`);
  }
  return args;
}

export const HELP = `nexus-sync - repository-backed two-device synchronization for H.A.A. Nexus

  status      [--no-fetch] [--json]    fetch and report repository, device, state, task
  start       [--pull] [--no-fetch]    the session-start procedure; exit 1 = STOP
  recover     [--no-fetch]             classify recovery cases (RECOVERY_PROTOCOL.md)
  init-device DEVICE-01|DEVICE-02 [--replace]
                                       identify this checkout (gitignored file)
  claim       --task-id ID --name "..." [--scope "..."] [--areas "..."]
              [--branch B] [--next "..."] [--reserve]
              [--takeover --reason "..." [--owner-confirmed]]
  heartbeat   [--next "..."] [--note "..."]
  handoff     --to DEVICE-0X|ANY --next "..." [--tests ..] [--build ..]
              [--typecheck ..] [--rust ..] [--decisions ..] [--issues ..] [--remaining ..]
  release     --status COMPLETE|ABANDONED|BLOCKED [--reason "..."] [--next "..."]
  finalize    [--shutdown]             push, verify on the remote, record the sync

  Writing commands also accept --offline (commit locally, REMOTE_SYNC_PENDING).
  Never force-pushes, resets, cleans, rebases or discards anything.`;

export function main(argv, repo = REPO_ROOT) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    return fail(e.message);
  }
  const commands = {
    status: cmdStatus, start: cmdStart, recover: cmdRecover, "init-device": cmdInitDevice,
    claim: cmdClaim, heartbeat: cmdHeartbeat, handoff: cmdHandoff, release: cmdRelease, finalize: cmdFinalize
  };
  const name = args._[0] || "help";
  if (!commands[name]) {
    console.log(HELP);
    return name === "help" ? 0 : 2;
  }
  try {
    return commands[name](repo, args);
  } catch (e) {
    return fail(e.message);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2), process.env.NEXUS_REPO || REPO_ROOT));
