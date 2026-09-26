// Tests for the distributed-workstation sync tool.
//
// Plain Node with node:assert, like tools/preflight, so the tool stays
// dependency-free: `node tools/nexus-sync/nexus-sync.test.mjs`.
//
// Three layers:
//   1. pure logic - state blocks, divergence, ownership, staleness, claims;
//   2. the REAL .nexus/ files in this repository - present, parseable,
//      complete, consistent, placeholder-free, secret-free, identity ignored;
//   3. end-to-end scenarios against real temporary Git repositories with a
//      bare "GitHub" remote and two device clones: claim, takeover of a stale
//      owner, divergence refusal, local-work preservation, handoff, finalize
//      with remote verification, fresh-clone recovery and network failure;
//   4. bidirectional session discovery (A-G): either device registers, the
//      other discovers it from Git alone, no duplicates, and a real
//      disagreement is refused rather than silently merged.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REPO_ROOT, REQUIRED_NEXUS_FILES, REQUIRED_KEYS, STATE_FILES, PLACEHOLDER, DEVICE_IDS,
  parseStateBlock, updateStateBlock, missingKeys, findPlaceholders, appendHistory, classifyDivergence,
  evaluateOwnership, planClaim, validateStateValues, redactUrl, parseArgs, readLocalDevice,
  latestHandoff, buildHandoffEntry, insertHandoffEntry, startVerdict, recoveryCases, activityEvidence, onStateBranch, pushTarget, main,
  sessionId, parseSessions, planSessionRegister, planSessionUpdate, SESSION_HISTORY_SECTION, SESSION_STATUSES
} from "./nexus-sync.mjs";

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

console.log("nexus-sync tests\n");

// --- 1. pure logic ----------------------------------------------------------

console.log("state blocks");

const SAMPLE = ["# Title", "", "prose", "", "```yaml nexus-state", "# comment", "a: 1", 'b: "two words"', "c: 2026-09-21T03:35:47Z", "```", "", "tail"].join("\n");

test("parses flat keys, quoted values, timestamps and ignores comments", () => {
  assert.deepEqual(parseStateBlock(SAMPLE), { a: "1", b: "two words", c: "2026-09-21T03:35:47Z" });
});

test("returns null when a file has no state block", () => {
  assert.equal(parseStateBlock("# nothing here"), null);
});

test("rejects a malformed line and a duplicate key rather than guessing", () => {
  assert.throws(() => parseStateBlock("```yaml nexus-state\nnot a pair\n```"), /malformed/);
  assert.throws(() => parseStateBlock("```yaml nexus-state\na: 1\na: 2\n```"), /duplicate/);
});

test("updates values in place, keeps order, comments and prose, appends new keys", () => {
  const out = updateStateBlock(SAMPLE, { b: "changed | with pipe", d: "new" });
  assert.deepEqual(parseStateBlock(out), { a: "1", b: "changed | with pipe", c: "2026-09-21T03:35:47Z", d: "new" });
  assert.ok(out.startsWith("# Title\n\nprose"));
  assert.ok(out.endsWith("```\n\ntail"));
  assert.ok(out.includes("# comment"));
});

test("round-trips values that need quoting", () => {
  const tricky = 'He said "no" # not a comment: really';
  assert.equal(parseStateBlock(updateStateBlock(SAMPLE, { a: tricky })).a, tricky);
  assert.equal(parseStateBlock(updateStateBlock(SAMPLE, { a: "" })).a, "");
});

test("preserves CRLF line endings", () => {
  const crlf = SAMPLE.replace(/\n/g, "\r\n");
  const out = updateStateBlock(crlf, { a: "9" });
  assert.equal(parseStateBlock(out).a, "9");
  assert.ok(!/[^\r]\n/.test(out), "a bare LF was introduced");
});

test("reports missing keys and placeholders", () => {
  assert.deepEqual(missingKeys({ a: 1 }, ["a", "b"]), ["b"]);
  assert.deepEqual(findPlaceholders(`ok\n- x: ${PLACEHOLDER}: fill\n`).map((p) => p.line), [2]);
});

test("appends ownership history rows and escapes table pipes", () => {
  const md = "x\n\n## Ownership history\n\n| h |\n|---|\n| r1 |\n";
  const out = appendHistory(md, { when: "t", event: "CLAIM", device: "DEVICE-01", task: "T", detail: "a|b" });
  assert.ok(out.endsWith("| t | CLAIM | DEVICE-01 | T | a\\|b |\n"));
  assert.ok(out.includes("| r1 |"), "an existing row was lost");
  assert.throws(() => appendHistory("no section", { when: 1, event: 2, device: 3, task: 4, detail: 5 }), /Ownership history/);
});

console.log("\nrepository and identity");

test("classifies clean / ahead / behind / diverged", () => {
  assert.equal(classifyDivergence(0, 0), "clean");
  assert.equal(classifyDivergence(2, 0), "ahead");
  assert.equal(classifyDivergence(0, 3), "behind");
  assert.equal(classifyDivergence(1, 1), "diverged");
});

test("the state branch is main, or any branch tracking origin/main, and publishes to main", () => {
  assert.equal(onStateBranch({ branch: "main", upstream: "origin/main" }), true);
  assert.equal(onStateBranch({ branch: "nexus/session", upstream: "origin/main" }), true);
  assert.equal(onStateBranch({ branch: "feat/x", upstream: "origin/feat/x" }), false);
  assert.equal(onStateBranch({ branch: "feat/x", upstream: null }), false);
  assert.equal(onStateBranch({ branch: "", upstream: "origin/main" }), false);
  assert.equal(pushTarget({ branch: "nexus/session", upstream: "origin/main" }), "main");
  assert.equal(pushTarget({ branch: "feat/x", upstream: null }), "feat/x");
});

test("never prints credentials embedded in a remote URL", () => {
  assert.equal(redactUrl("https://user:ghp_secret@github.com/o/r.git"), "https://***@github.com/o/r.git");
  assert.equal(redactUrl("https://github.com/o/r.git"), "https://github.com/o/r.git");
});

test("NEXUS_DEVICE_ID overrides the file and is validated", () => {
  assert.deepEqual(readLocalDevice(REPO_ROOT, { NEXUS_DEVICE_ID: "DEVICE-02" }), { id: "DEVICE-02", source: "NEXUS_DEVICE_ID" });
  assert.equal(readLocalDevice(REPO_ROOT, { NEXUS_DEVICE_ID: "DEVICE-9" }).id, null);
});

test("parses flags, values and positional arguments", () => {
  assert.deepEqual(parseArgs(["claim", "--task-id", "T", "--takeover", "--reason", "gone"]), { _: ["claim"], "task-id": "T", takeover: true, reason: "gone" });
  assert.throws(() => parseArgs(["claim", "--name"]), /needs a value/);
});

console.log("\nownership and staleness");

const NOW = new Date("2026-09-21T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3.6e6);
const held = (over = {}) => ({ task_id: "T", task_name: "n", owner: "DEVICE-01", status: "ACTIVE", stale_after_hours: "12", claim_commit: "abc1234", ...over });

test("a finished or unassigned task is free", () => {
  for (const status of ["UNASSIGNED", "COMPLETE", "ABANDONED"]) {
    assert.equal(evaluateOwnership({ task: held({ status }), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(1) }).state, "FREE");
  }
});

test("the owner sees its own task as OWNED_BY_YOU", () => {
  assert.equal(evaluateOwnership({ task: held(), device: "DEVICE-01", now: NOW, lastEvidence: hoursAgo(100) }).state, "OWNED_BY_YOU");
});

test("a live task owned by the other device needs takeover AND owner confirmation", () => {
  const o = evaluateOwnership({ task: held(), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(2) });
  assert.equal(o.state, "OWNED_BY_OTHER");
  assert.equal(o.requiresTakeover, true);
  assert.equal(o.requiresOwnerConfirmation, true);
});

test("a held task goes STALE at the threshold, so a shut-down owner cannot deadlock the project", () => {
  for (const status of ["ACTIVE", "RESERVED", "BLOCKED", "RECOVERING"]) {
    const o = evaluateOwnership({ task: held({ status }), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(12) });
    assert.equal(o.state, "STALE", status);
    assert.equal(o.requiresOwnerConfirmation, false);
  }
  assert.equal(evaluateOwnership({ task: held(), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(11.9) }).state, "OWNED_BY_OTHER");
});

test("no evidence at all counts as stale, never as a permanent lock", () => {
  assert.equal(evaluateOwnership({ task: held(), device: "DEVICE-02", now: NOW, lastEvidence: null }).state, "STALE");
});

test("the threshold is repository state and falls back safely when invalid", () => {
  assert.equal(evaluateOwnership({ task: held({ stale_after_hours: "1" }), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(2) }).state, "STALE");
  assert.equal(evaluateOwnership({ task: held({ stale_after_hours: "junk" }), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(2) }).staleHours, 12);
});

test("a handoff addressed to you, or to ANY, is claimable without a takeover", () => {
  assert.equal(evaluateOwnership({ task: held({ status: "HANDOFF_PENDING", handoff_to: "DEVICE-02" }), device: "DEVICE-02", now: NOW, lastEvidence: hoursAgo(1) }).state, "HANDOFF_TO_YOU");
  assert.equal(evaluateOwnership({ task: held({ status: "HANDOFF_PENDING", handoff_to: "ANY" }), device: "DEVICE-01", now: NOW, lastEvidence: hoursAgo(1) }).state, "HANDOFF_OPEN");
});

test("a handoff addressed to the other device is a takeover for anyone else", () => {
  const o = evaluateOwnership({ task: held({ status: "HANDOFF_PENDING", handoff_to: "DEVICE-02" }), device: "DEVICE-01", now: NOW, lastEvidence: hoursAgo(1) });
  assert.equal(o.requiresTakeover, true);
});

console.log("\nclaim planning");

const plan = (task, device, args, lastEvidence = hoursAgo(1)) =>
  planClaim({ task, device, now: NOW, head: "fff0000", ownership: evaluateOwnership({ task, device, now: NOW, lastEvidence }), args });

test("refuses to claim without a device identity", () => {
  assert.equal(plan(held({ status: "COMPLETE" }), null, { "task-id": "N", name: "x" }).ok, false);
});

test("a bare claim never reopens a finished task", () => {
  assert.match(plan(held({ status: "COMPLETE" }), "DEVICE-01", {}).reason, /--task-id/);
});

test("claims a free task as ACTIVE with a history row", () => {
  const p = plan(held({ status: "COMPLETE" }), "DEVICE-02", { "task-id": "N", name: "New work", scope: "s" });
  assert.equal(p.ok, true);
  assert.equal(p.event, "CLAIM");
  assert.equal(p.updates.owner, "DEVICE-02");
  assert.equal(p.updates.status, "ACTIVE");
  assert.equal(p.updates.claim_commit, "fff0000");
  assert.equal(p.updates.started_at, NOW.toISOString());
});

test("refuses a silent claim over another device's task and names the flag", () => {
  const p = plan(held(), "DEVICE-02", {});
  assert.equal(p.ok, false);
  assert.match(p.reason, /--takeover --reason/);
});

test("a takeover must record a reason", () => {
  assert.match(plan(held(), "DEVICE-02", { takeover: true }, hoursAgo(20)).reason, /--reason/);
});

test("a live owner can be taken over only with explicit owner confirmation", () => {
  assert.match(plan(held(), "DEVICE-02", { takeover: true, reason: "r" }).reason, /--owner-confirmed/);
  const p = plan(held(), "DEVICE-02", { takeover: true, reason: "owner said stop", "owner-confirmed": true });
  assert.equal(p.ok, true);
  assert.equal(p.event, "TAKEOVER");
  assert.equal(p.updates.status, "ACTIVE");
});

test("a stale takeover preserves the task, records the reason and enters RECOVERING", () => {
  const p = plan(held({ started_at: "2026-09-20T00:00:00Z" }), "DEVICE-02", { takeover: true, reason: "DEVICE-01 lost" }, hoursAgo(30));
  assert.equal(p.ok, true);
  assert.equal(p.event, "TAKEOVER");
  assert.equal(p.previousOwner, "DEVICE-01");
  assert.equal(p.updates.task_id, "T");
  assert.equal(p.updates.status, "RECOVERING");
  assert.equal(p.updates.started_at, "2026-09-20T00:00:00Z");
  assert.match(p.history.detail, /from DEVICE-01 \(STALE, idle 30\.0h\): DEVICE-01 lost/);
});

test("accepting a handoff keeps the original claim commit for the files-changed trail", () => {
  const p = plan(held({ status: "HANDOFF_PENDING", handoff_to: "DEVICE-02" }), "DEVICE-02", {});
  assert.equal(p.ok, true);
  assert.equal(p.event, "CLAIM");
  assert.equal(p.updates.claim_commit, "abc1234");
  assert.match(p.history.detail, /accepted handoff/);
});

test("the owner cannot silently abandon a held task by claiming another", () => {
  assert.match(plan(held(), "DEVICE-01", { "task-id": "OTHER", name: "x" }).reason, /release or hand it off/);
});

console.log("\nverdicts and recovery classification");

const snap = (over = {}) => ({ fetched: true, branch: "main", upstream: "origin/main", ahead: 0, behind: 0, divergence: "clean", dirty: [], ...over });
const okState = { problems: [], blocks: { task: held() } };

test("start STOPs when there is no identity, a divergence, or behind-with-local-work", () => {
  assert.equal(startVerdict({ snapshot: snap(), device: { id: null, problem: "x" }, state: okState, ownership: null }).safe, false);
  assert.equal(startVerdict({ snapshot: snap({ divergence: "diverged", ahead: 1, behind: 1 }), device: { id: "DEVICE-01" }, state: okState, ownership: null }).safe, false);
  assert.equal(startVerdict({ snapshot: snap({ divergence: "behind", behind: 2, dirty: [" M a"] }), device: { id: "DEVICE-01" }, state: okState, ownership: null }).safe, false);
});

test("an unreachable remote or peer is an attention item, never a stop", () => {
  const v = startVerdict({ snapshot: snap({ fetched: false, fetchError: "offline" }), device: { id: "DEVICE-02" }, state: okState, ownership: { state: "STALE", idleHours: 40, staleHours: 12 } });
  assert.equal(v.safe, true);
  assert.ok(v.attention.some((a) => /REMOTE UNREACHABLE/.test(a)));
  assert.ok(v.attention.some((a) => /STALE/.test(a)));
});

test("recovery maps conditions onto protocol cases F, G, H and C/D", () => {
  const ids = (s, o, t = held()) => recoveryCases({ snapshot: s, device: { id: "DEVICE-02" }, ownership: o, task: t }).map((c) => c[0]);
  assert.deepEqual(ids(snap({ dirty: [" M x"], divergence: "diverged" }), null), ["F", "G"]);
  assert.deepEqual(ids(snap(), { state: "STALE" }), ["H"]);
  assert.deepEqual(ids(snap(), { state: "OWNED_BY_OTHER" }), ["C"]);
  assert.deepEqual(ids(snap(), { state: "OWNED_BY_OTHER" }, held({ owner: "DEVICE-02" })), ["D"]);
  assert.deepEqual(ids(snap(), { state: "FREE" }), ["NONE"]);
});

test("handoff entries carry every required field and mark judgement fields", () => {
  const entry = buildHandoffEntry({ from: "DEVICE-01", to: "DEVICE-02", task: held(), head: "h", baseline: "b", filesChanged: ["a.ts"], when: "t", fields: { next: "do x" } });
  for (const f of ["From Device", "To Device", "Task", "Last Commit", "Baseline", "Tests Run", "Build Result", "Typecheck Result", "Rust Result", "Files Changed", "Decisions Made", "Known Issues", "Remaining Work", "Exact Next Action"]) {
    assert.ok(entry.includes(`**${f}`), `missing ${f}`);
  }
  assert.ok(entry.includes("do x"));
  assert.equal(findPlaceholders(entry).length, 7);
  const md = insertHandoffEntry("# H\n\n<!-- nexus:handoff-entries x -->\n\n## older\n", entry);
  assert.equal(latestHandoff(md), "t — DEVICE-01 → DEVICE-02 — T");
  assert.ok(md.includes("## older"), "an older entry was lost");
});

// --- 2. the real .nexus/ files -------------------------------------------------

console.log("\nthis repository's .nexus/ state");

const rel = (p) => path.join(REPO_ROOT, p);

test("every required .nexus file exists", () => {
  for (const f of REQUIRED_NEXUS_FILES) assert.ok(existsSync(rel(f)), `missing ${f}`);
});

test("every state file has a complete, valid state block", () => {
  const blocks = {};
  for (const [name, file] of Object.entries(STATE_FILES)) {
    if (name === "handoff") continue;
    blocks[name] = parseStateBlock(readFileSync(rel(file), "utf8"));
    assert.ok(blocks[name], `${file} has no state block`);
    assert.deepEqual(missingKeys(blocks[name], REQUIRED_KEYS[name]), [], file);
  }
  assert.deepEqual(validateStateValues(blocks), []);
});

test("no state file carries an unfinished placeholder", () => {
  for (const file of Object.values(STATE_FILES)) assert.deepEqual(findPlaceholders(readFileSync(rel(file), "utf8")), [], file);
});

test("the handoff log has its insertion marker and a latest entry", () => {
  const md = readFileSync(rel(STATE_FILES.handoff), "utf8");
  assert.match(md, /^<!-- nexus:handoff-entries.*-->$/m);
  assert.ok(latestHandoff(md));
});

test("ownership history is the last section of ACTIVE_TASK.md and has rows", () => {
  const md = readFileSync(rel(STATE_FILES.task), "utf8");
  const at = md.indexOf("## Ownership history");
  assert.ok(at > 0);
  assert.ok(!/^## /m.test(md.slice(at + 3)), "a section follows the history table");
  assert.ok((md.slice(at).match(/^\| 20\d\d-/gm) || []).length >= 1);
});

test("the registry names exactly DEVICE-01 and DEVICE-02 and claims neither is online", () => {
  const block = parseStateBlock(readFileSync(rel(STATE_FILES.registry), "utf8"));
  const ids = new Set(Object.keys(block).map((k) => k.split(".")[0]));
  assert.deepEqual([...ids].sort(), DEVICE_IDS);
  assert.ok(!Object.values(block).some((v) => /online/i.test(v)));
});

test("the local identity file is gitignored and the template is valid", () => {
  execFileSync("git", ["check-ignore", "-q", ".nexus/local-device.yaml"], { cwd: REPO_ROOT });
  assert.match(readFileSync(rel(".nexus/local-device.example.yaml"), "utf8"), /^device_id: DEVICE-0[12]$/m);
});

test("no secret-shaped values in .nexus/ or tools/nexus-sync/", () => {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", ".nexus", "tools/nexus-sync"], { cwd: REPO_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const secret = /(sk|pk)_(live|test)_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|password\s*[:=]\s*\S{4,}/;
  for (const f of files.filter((f) => !f.endsWith("nexus-sync.test.mjs"))) {
    assert.ok(!secret.test(readFileSync(rel(f), "utf8")), `secret-shaped value in ${f}`);
  }
});

console.log("\nsessions: derived identity and conflict rules");

const SNOW = new Date("2026-09-26T12:00:00.000Z");
const SHEAD = "a".repeat(40);

test("a session id is derived from its name, so both devices derive the same one", () => {
  assert.equal(sessionId("PHASES BUILDING"), "S-phases-building");
  // Case, spacing and punctuation are exactly the variations two devices differ on.
  assert.equal(sessionId("Phases Building"), sessionId("PHASES BUILDING"));
  assert.equal(sessionId("  phases   building!  "), sessionId("PHASES BUILDING"));
  assert.equal(sessionId("Phase 9 / packaging"), "S-phase-9-packaging");
  assert.equal(sessionId("   "), null);
  assert.equal(sessionId(""), null);
  assert.ok(!sessionId("x".repeat(80)).endsWith("-"), "a truncated slug must not end in a separator");
});

test("the registry groups shared fields and per-device attachments", () => {
  const s = parseSessions({
    registry_version: "2",
    "S-a.name": "A",
    "S-a.status": "ACTIVE",
    "S-a.DEVICE-01.last_seen": "t1",
    "S-a.DEVICE-02.last_seen": "t2",
    "S-b.name": "B",
    unrelated: "x"
  });
  assert.deepEqual(Object.keys(s).sort(), ["S-a", "S-b"]);
  assert.deepEqual(s["S-a"].shared, { name: "A", status: "ACTIVE" });
  assert.deepEqual(Object.keys(s["S-a"].devices).sort(), ["DEVICE-01", "DEVICE-02"]);
  assert.equal(s["S-a"].devices["DEVICE-02"].last_seen, "t2");
});

const REGISTERED = parseSessions({
  "S-phases-building.name": "PHASES BUILDING",
  "S-phases-building.role": "orchestrator",
  "S-phases-building.status": "ACTIVE",
  "S-phases-building.next_action": "hold",
  "S-phases-building.created_by": "DEVICE-01",
  "S-phases-building.updated_by": "DEVICE-01",
  "S-phases-building.updated_at": "2026-09-26T11:00:00.000Z",
  "S-phases-building.revision": "3",
  "S-phases-building.DEVICE-01.attached_at": "2026-09-26T10:00:00.000Z"
});

test("registering a session that exists attaches this device instead of duplicating it", () => {
  const plan = planSessionRegister({ sessions: REGISTERED, registry: { registry_version: "1" }, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { name: "Phases Building" } });
  assert.ok(plan.ok, plan.reason);
  assert.equal(plan.event, "ATTACH");
  // Only DEVICE-02's own lines are written: no shared field, no registry_version.
  assert.deepEqual(Object.keys(plan.updates).sort(), [
    "S-phases-building.DEVICE-02.attached_at",
    "S-phases-building.DEVICE-02.last_seen",
    "S-phases-building.DEVICE-02.last_seen_commit"
  ]);
});

test("re-registering keeps the first attachment time, so a restart does not rewrite history", () => {
  const plan = planSessionRegister({ sessions: REGISTERED, registry: {}, id: "S-phases-building", device: "DEVICE-01", now: SNOW, head: SHEAD, args: {} });
  assert.equal(plan.updates["S-phases-building.DEVICE-01.attached_at"], "2026-09-26T10:00:00.000Z");
  assert.equal(plan.updates["S-phases-building.DEVICE-01.last_seen"], SNOW.toISOString());
});

test("register refuses to change a shared field, and attach refuses an unknown session", () => {
  const shared = planSessionRegister({ sessions: REGISTERED, registry: {}, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { status: "IDLE" } });
  assert.equal(shared.ok, false);
  assert.match(shared.reason, /session update/);
  const unknown = planSessionRegister({ sessions: {}, registry: {}, id: "S-nope", device: "DEVICE-02", now: SNOW, head: SHEAD, attachOnly: true, args: {} });
  assert.equal(unknown.ok, false);
  assert.match(unknown.reason, /not registered yet/);
  const unnamed = planSessionRegister({ sessions: {}, registry: {}, id: null, device: "DEVICE-02", now: SNOW, head: SHEAD, args: {} });
  assert.equal(unnamed.ok, false);
  assert.match(unnamed.reason, /name the session/);
});

test("a new session bumps the registry version and records its creator", () => {
  const plan = planSessionRegister({ sessions: {}, registry: { registry_version: "4" }, id: "S-new-work", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { name: "New work", role: "audit" } });
  assert.ok(plan.ok, plan.reason);
  assert.equal(plan.event, "REGISTER");
  assert.equal(plan.updates.registry_version, "5");
  assert.equal(plan.updates["S-new-work.created_by"], "DEVICE-02");
  assert.equal(plan.updates["S-new-work.revision"], "1");
  assert.equal(plan.updates["S-new-work.status"], "ACTIVE");
});

test("an update bumps the revision and records who changed it", () => {
  const plan = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-01", now: SNOW, head: SHEAD, args: { next: "resolve D15" } });
  assert.ok(plan.ok, plan.reason);
  assert.equal(plan.event, "UPDATE");
  assert.equal(plan.updates["S-phases-building.revision"], "4");
  assert.equal(plan.updates["S-phases-building.next_action"], "resolve D15");
  assert.equal(plan.updates["S-phases-building.updated_by"], "DEVICE-01");
});

test("--expect-revision refuses a stale write and names the device that moved it", () => {
  const plan = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { status: "IDLE", "expect-revision": "2" } });
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /revision 3, not 2/);
  assert.match(plan.reason, /DEVICE-01/);
});

test("overwriting the other device's shared value is refused, never last-write-wins", () => {
  const blocked = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { status: "IDLE" } });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /--supersede/);
  const unreasoned = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { status: "IDLE", supersede: true } });
  assert.equal(unreasoned.ok, false);
  assert.match(unreasoned.reason, /--reason/);
  const done = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { status: "IDLE", supersede: true, reason: "DEVICE-01 is off" } });
  assert.ok(done.ok, done.reason);
  assert.equal(done.event, "SUPERSEDE");
  // The replaced value survives in the audit row rather than only in a diff.
  assert.match(done.history.detail, /ACTIVE/);
  assert.match(done.history.detail, /DEVICE-01 is off/);
});

test("a device may set a shared field the other device never recorded, with no ceremony", () => {
  const plan = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-02", now: SNOW, head: SHEAD, args: { "control-version": "P9-2026-09-26-001" } });
  assert.ok(plan.ok, plan.reason);
  assert.equal(plan.event, "UPDATE");
});

test("renaming is refused because identity is derived from the name", () => {
  const plan = planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-01", now: SNOW, head: SHEAD, args: { name: "Something else", status: "IDLE" } });
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /renaming would change identity/);
});

test("an invalid status and a non-derivable id are reported as state problems", () => {
  assert.equal(planSessionUpdate({ sessions: REGISTERED, id: "S-phases-building", device: "DEVICE-01", now: SNOW, head: SHEAD, args: { status: "BUSY" } }).ok, false);
  const problems = validateStateValues({ sessions: { registry_version: "1", "S-a.name": "Totally different", "S-a.status": "RUNNING", "S-a.DEVICE-09.last_seen": "t" } });
  assert.equal(problems.filter((p) => /SESSION_REGISTRY/.test(p)).length, 3, problems.join(" | "));
  assert.ok(SESSION_STATUSES.includes("ACTIVE"));
});

test("the registration history is append-only and lands in its own section", () => {
  const md = "x\n\n" + SESSION_HISTORY_SECTION + "\n\n| h |\n|---|\n| r1 |\n";
  const out = appendHistory(md, { when: "t", event: "REGISTER", device: "DEVICE-01", task: "S-a", detail: "d" }, SESSION_HISTORY_SECTION);
  assert.ok(out.includes("| r1 |"), "an existing row was lost");
  assert.ok(out.endsWith("| t | REGISTER | DEVICE-01 | S-a | d |\n"));
});

// --- 3. end-to-end against real repositories ------------------------------------

console.log("\nend-to-end: two devices, one bare remote");

const tmp = mkdtempSync(path.join(os.tmpdir(), "nexus-sync-test-"));

// Every end-to-end git call and tool run must target a directory inside the
// temp sandbox. An undefined directory would otherwise fall back to the
// process cwd or REPO_ROOT - the real checkout - and a scenario that commits,
// pushes or re-points `origin` would do it to the real repository.
function sandboxed(dir) {
  if (!dir || !path.resolve(dir).startsWith(path.resolve(tmp) + path.sep)) {
    throw new Error(`refusing to operate outside the test sandbox: ${dir}`);
  }
  return dir;
}
const g = (cwd, ...args) =>
  execFileSync("git", args, { cwd: cwd === tmp ? tmp : sandboxed(cwd), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const bare = path.join(tmp, "github.git");

function run(repo, device, ...argv) {
  sandboxed(repo);
  const saved = { log: console.log, error: console.error, env: process.env.NEXUS_DEVICE_ID };
  const out = [];
  console.log = (...a) => out.push(a.join(" "));
  console.error = (...a) => out.push(a.join(" "));
  if (device) process.env.NEXUS_DEVICE_ID = device;
  else delete process.env.NEXUS_DEVICE_ID;
  try {
    return { code: main(argv, repo), out: out.join("\n") };
  } finally {
    console.log = saved.log;
    console.error = saved.error;
    if (saved.env === undefined) delete process.env.NEXUS_DEVICE_ID;
    else process.env.NEXUS_DEVICE_ID = saved.env;
  }
}

function cloneAs(name) {
  const dir = path.join(tmp, name);
  g(tmp, "clone", "-q", bare, dir);
  g(dir, "config", "user.name", `test ${name}`);
  g(dir, "config", "user.email", `${name}@example.invalid`);
  g(dir, "config", "commit.gpgsign", "false");
  return dir;
}

const remoteFile = (file) => g(bare, "show", `main:${file}`);
const remoteBlock = (file) => parseStateBlock(remoteFile(file));
const remoteHead = () => g(bare, "rev-parse", "main");

let dev1, dev2, dev3;
let setupOk = false;
try {
  g(tmp, "init", "-q", "--bare", "-b", "main", bare);
  const seed = cloneAs("seed");
  mkdirSync(path.join(seed, ".nexus"));
  for (const f of REQUIRED_NEXUS_FILES.concat(".nexus/local-device.example.yaml")) copyFileSync(rel(f), path.join(seed, f));
  // A finished seed task, and a threshold of about one second so staleness can
  // be exercised for real rather than only in the pure tests.
  const taskFile = path.join(seed, STATE_FILES.task);
  writeFileSync(taskFile, updateStateBlock(readFileSync(taskFile, "utf8"), { task_id: "SEED-0", status: "COMPLETE", owner: "DEVICE-01", stale_after_hours: "0.0003" }));
  const curFile = path.join(seed, STATE_FILES.current);
  writeFileSync(curFile, updateStateBlock(readFileSync(curFile, "utf8"), { active_task: "SEED-0", task_owner: "DEVICE-01", task_status: "COMPLETE", sync_status: "REMOTE_SYNC_PENDING" }));
  // The real registry carries real sessions and real history rows; the
  // scenarios below must start from an empty one.
  const regFile = path.join(seed, STATE_FILES.sessions);
  const regMd = readFileSync(regFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => !/^S-[a-z0-9-]+\./.test(l.trim()) && !/^\| 20\d\d-/.test(l.trim()))
    .join("\n");
  writeFileSync(regFile, updateStateBlock(regMd, { registry_version: "0" }));
  writeFileSync(path.join(seed, ".gitignore"), ".nexus/local-device.yaml\n");
  writeFileSync(path.join(seed, "app.txt"), "v1\n");
  g(seed, "add", "-A");
  g(seed, "commit", "-q", "-m", "seed");
  g(seed, "push", "-q", "origin", "main");
  dev1 = cloneAs("device1");
  dev2 = cloneAs("device2");
  setupOk = true;
} catch (e) {
  failures.push(`e2e setup: ${e.message}`);
  console.log("  FAIL  e2e setup - " + e.message);
}

if (setupOk) {
  test("init-device writes a gitignored identity and refuses to overwrite it silently", () => {
    assert.equal(run(dev1, null, "init-device", "DEVICE-01").code, 0);
    assert.equal(readLocalDevice(dev1, {}).id, "DEVICE-01");
    assert.equal(g(dev1, "status", "--porcelain"), "", "identity file is not ignored");
    assert.equal(run(dev1, null, "init-device", "DEVICE-02").code, 1);
    assert.equal(readLocalDevice(dev1, {}).id, "DEVICE-01");
  });

  test("init-device refuses when the identity file would not be gitignored", () => {
    const loose = path.join(tmp, "loose");
    g(tmp, "init", "-q", loose);
    mkdirSync(path.join(loose, ".nexus"));
    assert.equal(run(loose, null, "init-device", "DEVICE-01").code, 1);
    assert.ok(!existsSync(path.join(loose, ".nexus/local-device.yaml")));
  });

  test("DEVICE-01 claims a task: committed, pushed, and verified on the remote", () => {
    const r = run(dev1, "DEVICE-01", "claim", "--task-id", "T-1", "--name", "Build feature", "--scope", "app.txt", "--next", "edit app.txt");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /REMOTE SYNC VERIFIED/);
    assert.equal(remoteHead(), g(dev1, "rev-parse", "HEAD"));
    const t = remoteBlock(STATE_FILES.task);
    assert.equal(t.owner, "DEVICE-01");
    assert.equal(t.status, "ACTIVE");
    assert.equal(remoteBlock(STATE_FILES.current).active_task, "T-1");
    assert.equal(remoteBlock(STATE_FILES.registry)["DEVICE-01.status"], "ACTIVE");
    assert.match(g(bare, "log", "-1", "--format=%B", "main"), /^Nexus-Device: DEVICE-01$/m);
  });

  test("DEVICE-02 start fast-forwards and reports the live foreign task", () => {
    const r = run(dev2, "DEVICE-02", "start", "--pull");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /fast-forwarded/);
    assert.equal(g(dev2, "rev-parse", "HEAD"), remoteHead());
    assert.match(r.out, /T-1 - Build feature/);
    // Staleness must be judgeable from the remote alone: the owner's
    // `Nexus-Device:` trailer commit is found as evidence.
    const evidence = activityEvidence(dev2, { ...remoteBlock(STATE_FILES.task), last_update: "none" });
    assert.ok(evidence, "no activity evidence found on the remote");
    assert.match(evidence.source, /DEVICE-01 sync commit on origin\/main/);
  });

  test("DEVICE-02 cannot silently claim DEVICE-01's task", () => {
    const r = run(dev2, "DEVICE-02", "claim");
    assert.equal(r.code, 1);
    assert.match(r.out, /takeover/);
    assert.equal(remoteBlock(STATE_FILES.task).owner, "DEVICE-01");
  });

  test("DEVICE-01 goes silent; after the threshold DEVICE-02 recovers the stale task", () => {
    sleep(1500);
    const rec = run(dev2, "DEVICE-02", "recover");
    assert.match(rec.out, /Case H/);
    const r = run(dev2, "DEVICE-02", "claim", "--takeover", "--reason", "DEVICE-01 shut down");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /REMOTE SYNC VERIFIED/);
    const t = remoteBlock(STATE_FILES.task);
    assert.equal(t.owner, "DEVICE-02");
    assert.equal(t.status, "RECOVERING");
    assert.equal(t.task_id, "T-1");
    const history = remoteFile(STATE_FILES.task);
    assert.match(history, /\| CLAIM \| DEVICE-01 \| T-1 \|/, "the previous owner's record was lost");
    assert.match(history, /\| TAKEOVER \| DEVICE-02 \| T-1 \| from DEVICE-01 \(STALE/);
    const reg = remoteBlock(STATE_FILES.registry);
    assert.equal(reg["DEVICE-01.status"], "UNKNOWN");
    assert.equal(reg["DEVICE-02.status"], "RECOVERY");
    assert.match(remoteBlock(STATE_FILES.current).recovery_status, /takeover of T-1 by DEVICE-02/);
  });

  test("the first heartbeat confirms the recovery", () => {
    const r = run(dev2, "DEVICE-02", "heartbeat");
    assert.equal(r.code, 0, r.out);
    assert.equal(remoteBlock(STATE_FILES.task).status, "ACTIVE");
    assert.equal(remoteBlock(STATE_FILES.registry)["DEVICE-02.status"], "ACTIVE");
  });

  // The next two scenarios are deliberately separate: with a dirty tree AND a
  // divergence at once, either guard alone would satisfy the test.
  test("uncommitted work on an in-sync branch blocks finalize and is left untouched", () => {
    const scratch = path.join(dev2, "scratch.txt");
    writeFileSync(scratch, "half-finished\n");
    const before = remoteHead();
    const f = run(dev2, "DEVICE-02", "finalize");
    assert.equal(f.code, 1, f.out);
    assert.match(f.out, /uncommitted changes present/);
    assert.equal(remoteHead(), before, "finalize pushed or recorded with a dirty tree");
    assert.equal(readFileSync(scratch, "utf8"), "half-finished\n");
    rmSync(scratch);
  });

  test("DEVICE-01 returns with a committed local change: divergence stops start and finalize, nothing is pushed or lost", () => {
    writeFileSync(path.join(dev1, "app.txt"), "v2 from device 1\n");
    g(dev1, "commit", "-q", "-am", "device 1 work");
    const local = g(dev1, "rev-parse", "HEAD");
    const before = remoteHead();
    const s = run(dev1, "DEVICE-01", "start");
    assert.equal(s.code, 1);
    assert.match(s.out, /DIVERGED/);
    const f = run(dev1, "DEVICE-01", "finalize");
    assert.equal(f.code, 1, f.out);
    assert.match(f.out, /diverged/);
    assert.equal(remoteHead(), before, "finalize pushed while diverged");
    assert.equal(g(dev1, "rev-parse", "HEAD"), local, "the local commit was rewritten");
    writeFileSync(path.join(dev1, "notes.txt"), "uncommitted thought\n");
    assert.deepEqual(run(dev1, "DEVICE-01", "recover").out.match(/Case [FG]/g), ["Case F", "Case G"]);
    assert.equal(readFileSync(path.join(dev1, "notes.txt"), "utf8"), "uncommitted thought\n", "uncommitted work was touched");
    assert.equal(readFileSync(path.join(dev1, "app.txt"), "utf8"), "v2 from device 1\n");
  });

  test("a handoff with unfinished fields cannot be synchronized", () => {
    const r = run(dev2, "DEVICE-02", "handoff", "--to", "DEVICE-01", "--next", "review app.txt");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /complete these/);
    g(dev2, "commit", "-q", "-am", "handoff draft");
    const f = run(dev2, "DEVICE-02", "finalize");
    assert.equal(f.code, 1);
    assert.match(f.out, /TODO\(nexus\)/);
  });

  test("finalize pushes, verifies the remote, records the sync, and is idempotent", () => {
    const file = path.join(dev2, STATE_FILES.handoff);
    writeFileSync(file, readFileSync(file, "utf8").replace(/TODO\(nexus\): [^\n]*/g, "recorded"));
    g(dev2, "commit", "-q", "-am", "complete handoff");
    const work = g(dev2, "rev-parse", "HEAD");
    const r = run(dev2, "DEVICE-02", "finalize");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /REMOTE SYNC {13}VERIFIED/);
    const c = remoteBlock(STATE_FILES.current);
    assert.equal(c.sync_status, "REMOTE_SYNCED");
    assert.equal(c.last_sync_commit, work);
    assert.equal(c.last_sync_device, "DEVICE-02");
    assert.equal(remoteHead(), g(dev2, "rev-parse", "HEAD"));
    const again = run(dev2, "DEVICE-02", "finalize");
    assert.equal(again.code, 0);
    assert.match(again.out, /already current/);
    assert.equal(remoteHead(), g(dev2, "rev-parse", "HEAD"), "an idempotent finalize created a commit");
  });

  test("both devices gone: a fresh clone reconstructs state and accepts the handoff", () => {
    dev3 = cloneAs("fresh-clone");
    const s = run(dev3, "DEVICE-01", "start");
    assert.equal(s.code, 0, s.out);
    assert.match(s.out, /a handoff is addressed to you/);
    assert.match(s.out, /LAST HANDOFF .*DEVICE-02 → DEVICE-01 — T-1/);
    const c = run(dev3, "DEVICE-01", "claim");
    assert.equal(c.code, 0, c.out);
    assert.equal(remoteBlock(STATE_FILES.task).owner, "DEVICE-01");
    assert.match(remoteFile(STATE_FILES.task), /\| CLAIM \| DEVICE-01 \| T-1 \| accepted handoff from DEVICE-02 \|/);
  });

  test("a checkout that is behind cannot write state until it synchronizes", () => {
    // DEVICE-01's second checkout, then DEVICE-01 moves on from the first one.
    // Ownership is not in question here, so only the behind-guard can refuse.
    const second = cloneAs("device1-second-checkout");
    assert.equal(run(dev3, "DEVICE-01", "heartbeat").code, 0);
    const before = remoteHead();
    const h = run(second, "DEVICE-01", "heartbeat");
    assert.equal(h.code, 1, h.out);
    assert.match(h.out, /synchronize first/);
    assert.equal(remoteHead(), before);
    assert.equal(g(second, "status", "--porcelain"), "", "a refused write left edits behind");
  });

  test("network failure: writes refuse without --offline and finalize records REMOTE_SYNC_PENDING", () => {
    g(dev3, "remote", "set-url", "origin", path.join(tmp, "unreachable.git"));
    assert.equal(run(dev3, "DEVICE-01", "heartbeat").code, 1);
    writeFileSync(path.join(dev3, "app.txt"), "v3 offline\n");
    g(dev3, "commit", "-q", "-am", "offline work");
    const before = remoteHead();
    const f = run(dev3, "DEVICE-01", "finalize");
    assert.equal(f.code, 2, f.out);
    assert.match(f.out, /LOCAL COMMIT COMPLETE/);
    assert.match(f.out, /REMOTE SYNC NOT VERIFIED/);
    assert.equal(parseStateBlock(g(dev3, "show", `HEAD:${STATE_FILES.current}`)).sync_status, "REMOTE_SYNC_PENDING");
    assert.equal(remoteHead(), before);
  });

  test("network restored: finalize synchronizes and returns to REMOTE_SYNCED", () => {
    g(dev3, "remote", "set-url", "origin", bare);
    const r = run(dev3, "DEVICE-01", "finalize");
    assert.equal(r.code, 0, r.out);
    assert.equal(remoteBlock(STATE_FILES.current).sync_status, "REMOTE_SYNCED");
    assert.equal(g(bare, "show", "main:app.txt"), "v3 offline");
    assert.equal(remoteHead(), g(dev3, "rev-parse", "HEAD"));
  });

  test("a session worktree on its own branch tracking origin/main publishes state to main", () => {
    // `main` can be checked out in only one worktree, and every live session
    // gets its own (N-004), so this is the normal way to write state.
    const wt = cloneAs("session-worktree");
    g(wt, "switch", "-q", "-c", "session-1", "--track", "origin/main");
    const h = run(wt, "DEVICE-01", "heartbeat");
    assert.equal(h.code, 0, h.out);
    assert.equal(remoteHead(), g(wt, "rev-parse", "HEAD"));
    assert.equal(g(bare, "branch", "--list", "session-1"), "", "the session branch was published instead of main");
    writeFileSync(path.join(wt, "app.txt"), "v5 from a session worktree\n");
    g(wt, "commit", "-q", "-am", "worktree work");
    const work = g(wt, "rev-parse", "HEAD");
    const f = run(wt, "DEVICE-01", "finalize");
    assert.equal(f.code, 0, f.out);
    assert.equal(remoteHead(), g(wt, "rev-parse", "HEAD"));
    const c = remoteBlock(STATE_FILES.current);
    assert.equal(c.sync_status, "REMOTE_SYNCED");
    assert.equal(c.last_sync_commit, work);
    assert.equal(g(bare, "branch", "--list", "session-1"), "");
  });

  // --- 4. bidirectional session discovery: Tests A-G ----------------------
  //
  // Two fresh clones, so neither device has any local state from the scenarios
  // above: whatever they see about a session, they got from the remote.
  const s1 = cloneAs("session-device1");
  const s2 = cloneAs("session-device2");

  //
  // The defect these prove absent: a session registered on one device that the
  // other device cannot see. Each test asserts discovery through the canonical
  // mechanism only - the remote repository - never a copied file.

  test("A: DEVICE-01 registers a session and DEVICE-02 discovers it without being told", () => {
    const r = run(s1, "DEVICE-01", "session", "register", "--name", "PHASES BUILDING", "--role", "orchestrator", "--control-version", "P9-2026-09-26-001", "--next", "hold for owner decisions");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /REGISTER S-phases-building/);
    assert.match(r.out, /REMOTE SYNC VERIFIED/);
    const remote = parseSessions(remoteBlock(STATE_FILES.sessions));
    assert.equal(remote["S-phases-building"].shared.name, "PHASES BUILDING");
    assert.equal(remote["S-phases-building"].shared.created_by, "DEVICE-01");

    // DEVICE-02 is told nothing: no id, no name. Its ordinary session start
    // fetches and prints the session, which is what "discovery" has to mean.
    const seen = run(s2, "DEVICE-02", "start", "--pull");
    assert.match(seen.out, /SESSIONS/);
    assert.match(seen.out, /S-phases-building/);
    assert.match(seen.out, /this device NOT attached/);
    assert.match(seen.out, /P9-2026-09-26-001/);
  });

  test("B: DEVICE-02 registers a session and DEVICE-01 discovers it", () => {
    const r = run(s2, "DEVICE-02", "session", "register", "--name", "Docs accuracy sweep", "--role", "audit", "--next", "README counts");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /REGISTER S-docs-accuracy-sweep/);
    const seen = run(s1, "DEVICE-01", "start", "--pull");
    assert.match(seen.out, /S-docs-accuracy-sweep/);
    // Both sessions are visible from both devices: the registry is one list.
    assert.match(seen.out, /S-phases-building/);
    const remote = parseSessions(remoteBlock(STATE_FILES.sessions));
    assert.deepEqual(Object.keys(remote).sort(), ["S-docs-accuracy-sweep", "S-phases-building"]);
    assert.equal(remote["S-docs-accuracy-sweep"].shared.created_by, "DEVICE-02");
  });

  test("C: DEVICE-01 changes shared metadata and DEVICE-02 receives it without merging first", () => {
    const r = run(s1, "DEVICE-01", "session", "update", "--name", "PHASES BUILDING", "--next", "integrate PR 16", "--expect-revision", "1");
    assert.equal(r.code, 0, r.out);
    assert.equal(parseSessions(remoteBlock(STATE_FILES.sessions))["S-phases-building"].shared.revision, "2");
    // DEVICE-02's own branch is still behind: discovery reads the canonical
    // copy on the remote, which is the whole point - state written on one
    // device must never wait for the other device to import it.
    const seen = run(s2, "DEVICE-02", "session", "list");
    assert.notEqual(g(s2, "rev-parse", "HEAD"), remoteHead(), "DEVICE-02 had already merged; the test proves nothing");
    assert.match(seen.out, /integrate PR 16/);
    assert.match(seen.out, /last changed by DEVICE-01/);
    assert.match(seen.out, /canonical/);
    assert.match(seen.out, /differs from the canonical one/);
  });

  test("D: DEVICE-02 changes shared metadata and DEVICE-01 receives it", () => {
    // Writing still requires being in sync: reading is canonical, writing is careful.
    assert.equal(run(s2, "DEVICE-02", "start", "--pull").code, 0);
    const r = run(s2, "DEVICE-02", "session", "update", "--id", "S-docs-accuracy-sweep", "--status", "IDLE", "--next", "waiting on integration");
    assert.equal(r.code, 0, r.out);
    const seen = run(s1, "DEVICE-01", "session", "list");
    assert.match(seen.out, /waiting on integration/);
    const remote = parseSessions(remoteBlock(STATE_FILES.sessions))["S-docs-accuracy-sweep"];
    assert.equal(remote.shared.status, "IDLE");
    assert.equal(remote.shared.updated_by, "DEVICE-02");
  });

  test("E: re-registering after a restart attaches both devices and creates no duplicate", () => {
    const before = remoteBlock(STATE_FILES.sessions).registry_version;
    run(s1, "DEVICE-01", "start", "--pull");
    run(s2, "DEVICE-02", "start", "--pull");
    // DEVICE-02 types the name differently, as a second device naturally would.
    const again = run(s2, "DEVICE-02", "session", "register", "--name", "Phases Building");
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /ATTACH S-phases-building/);
    run(s1, "DEVICE-01", "start", "--pull");
    const re = run(s1, "DEVICE-01", "session", "register", "--name", "PHASES BUILDING");
    assert.equal(re.code, 0, re.out);
    assert.match(re.out, /ATTACH S-phases-building/);
    const remote = parseSessions(remoteBlock(STATE_FILES.sessions));
    assert.deepEqual(Object.keys(remote).sort(), ["S-docs-accuracy-sweep", "S-phases-building"], "a duplicate logical session appeared");
    assert.equal(remoteBlock(STATE_FILES.sessions).registry_version, before, "an attach must not bump the registry version");
    assert.deepEqual(Object.keys(remote["S-phases-building"].devices).sort(), ["DEVICE-01", "DEVICE-02"]);
    // A device that has never run before, on a machine with no local state,
    // still sees the same session: nothing is stored outside the repository.
    const fresh = cloneAs("device-fresh");
    const r = run(fresh, "DEVICE-02", "session", "list");
    assert.match(r.out, /S-phases-building/);
    assert.match(r.out, /PHASES BUILDING/);
  });

  test("F: near-simultaneous changes are detected, never silently lost, and converge", () => {
    // Both devices start from the same revision. DEVICE-01 lands first.
    run(s1, "DEVICE-01", "start", "--pull");
    const base = parseSessions(remoteBlock(STATE_FILES.sessions))["S-phases-building"].shared.revision;
    assert.equal(run(s1, "DEVICE-01", "session", "update", "--name", "PHASES BUILDING", "--status", "ACTIVE", "--next", "DEVICE-01 continues integration", "--expect-revision", base).code, 0);

    // DEVICE-02 still holds the old base. Its write is refused twice, for two
    // different reasons, and neither refusal loses DEVICE-01's change.
    const stale = run(s2, "DEVICE-02", "session", "update", "--name", "PHASES BUILDING", "--next", "DEVICE-02 takes over", "--expect-revision", base);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /(is behind|revision)/);

    run(s2, "DEVICE-02", "start", "--pull");
    const refused = run(s2, "DEVICE-02", "session", "update", "--name", "PHASES BUILDING", "--next", "DEVICE-02 takes over");
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /--supersede/);
    assert.equal(parseSessions(remoteBlock(STATE_FILES.sessions))["S-phases-building"].shared.next_action, "DEVICE-01 continues integration", "a refused write still changed the remote");

    // With the conflict acknowledged, the resolution is recorded, not implied.
    const resolved = run(s2, "DEVICE-02", "session", "update", "--name", "PHASES BUILDING", "--next", "DEVICE-02 takes over", "--supersede", "--reason", "DEVICE-01 handed integration over");
    assert.equal(resolved.code, 0, resolved.out);
    const md = remoteFile(STATE_FILES.sessions);
    assert.match(md, /SUPERSEDE/);
    assert.ok(md.includes("DEVICE-01 continues integration"), "the superseded value was not preserved in the history");
    assert.ok(md.includes("DEVICE-01 handed integration over"), "the reason was not recorded");

    // Convergence: after an ordinary synchronization both devices read one value.
    run(s1, "DEVICE-01", "start", "--pull");
    const one = run(s1, "DEVICE-01", "session", "list", "--json");
    const two = run(s2, "DEVICE-02", "session", "list", "--json");
    const pick = (out) => JSON.parse(out).sessions["S-phases-building"].shared;
    assert.equal(pick(one.out).next_action, "DEVICE-02 takes over");
    assert.deepEqual(pick(one.out), pick(two.out), "the devices did not converge");
  });

  test("G: one logical session, discoverable from either device, with no replacement copy", () => {
    const fromOne = JSON.parse(run(s1, "DEVICE-01", "session", "list", "--json").out);
    const fromTwo = JSON.parse(run(s2, "DEVICE-02", "session", "list", "--json").out);
    assert.deepEqual(Object.keys(fromOne.sessions).sort(), Object.keys(fromTwo.sessions).sort());
    assert.equal(fromOne.registry_version, fromTwo.registry_version);
    const s = fromOne.sessions["S-phases-building"];
    assert.equal(s.shared.name, "PHASES BUILDING");
    assert.equal(s.shared.created_by, "DEVICE-01");
    assert.deepEqual(Object.keys(s.devices).sort(), ["DEVICE-01", "DEVICE-02"]);
    // No conversation uuid, window or process id was ever written into shared state.
    assert.doesNotMatch(remoteFile(STATE_FILES.sessions), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  test("a CRLF working copy is not reported as differing from the canonical one", () => {
    // Git stores LF and checks CRLF out on Windows, so a byte comparison would
    // tell every Windows checkout that its registry is stale.
    const crlf = cloneAs("session-crlf");
    const rel = STATE_FILES.sessions;
    const file = path.join(crlf, rel);
    const lf = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    writeFileSync(file, lf.replace(/\n/g, "\r\n"));
    const quiet = run(crlf, "DEVICE-02", "session", "list");
    assert.match(quiet.out, /S-phases-building/);
    assert.doesNotMatch(quiet.out, /differs from the canonical one/);
    // A real content difference still reports.
    writeFileSync(file, lf.replace("registry_version:", "registry_version:  "));
    assert.match(run(crlf, "DEVICE-02", "session", "list").out, /differs from the canonical one/);
  });

  test("the tool never rewrote published history", () => {
    // Every commit ever pushed is still reachable from the remote branch.
    const all = g(bare, "rev-list", "--all").split("\n");
    const onMain = new Set(g(bare, "rev-list", "main").split("\n"));
    assert.deepEqual(all.filter((c) => !onMain.has(c)), []);
  });

  test("a push the remote does not end up holding is never reported as verified", () => {
    // The remote accepts the push, then its post-receive hook moves the branch
    // back - a push that "succeeded" but did not land. Only asking the remote
    // (ls-remote) can tell.
    const hook = path.join(bare, "hooks", "post-receive");
    writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do\n  case "$old" in 0000000000000000000000000000000000000000) ;; *) git update-ref "$ref" "$old" ;; esac\ndone\n', { mode: 0o755 });
    try {
      g(dev3, "fetch", "-q", "origin");
      g(dev3, "merge", "-q", "--ff-only", "origin/main");
      writeFileSync(path.join(dev3, "app.txt"), "v4 lost in transit\n");
      g(dev3, "commit", "-q", "-am", "work the remote drops");
      const before = remoteHead();
      const r = run(dev3, "DEVICE-01", "finalize");
      assert.equal(remoteHead(), before, "the hook did not run; this scenario proves nothing");
      assert.equal(r.code, 2, r.out);
      assert.match(r.out, /REMOTE SYNC NOT VERIFIED/);
      assert.doesNotMatch(r.out, /work verified on/);
    } finally {
      rmSync(hook);
    }
  });
}

try {
  rmSync(tmp, { recursive: true, force: true });
} catch {
  // A locked temp directory on Windows is not a test failure.
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
