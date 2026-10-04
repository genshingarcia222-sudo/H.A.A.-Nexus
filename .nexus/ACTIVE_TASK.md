# Active Task

**Advisory coordination, not a distributed lock.** This record exists so the two
devices do not *unknowingly* work on the same thing. It cannot prevent a
conflict. Git merge and rebase conflicts are still resolved normally, by hand,
without discarding either side.

Read this before starting any task (SYNC_PROTOCOL step "DETERMINE TASK
OWNERSHIP"). Change it only through `nexus-sync claim | heartbeat | handoff |
release`. Those commands commit and push immediately, because a claim that
exists only on one device coordinates nothing.

## Status vocabulary

| Status | Held? | Meaning |
|---|---|---|
| `UNASSIGNED` | no | no task recorded |
| `RESERVED` | yes | claimed, work not started (`claim --reserve`) |
| `ACTIVE` | yes | owner is working on it |
| `BLOCKED` | yes | owner holds it but is waiting on a decision/input (`release --status BLOCKED --reason`) |
| `HANDOFF_PENDING` | no | owner handed it to `handoff_to` (or `ANY`); the recipient claims it without a takeover |
| `COMPLETE` | no | done; a new task needs `claim --task-id ... --name ...` |
| `ABANDONED` | no | stopped deliberately, with a reason in the history |
| `RECOVERING` | yes | taken over from a stale owner; the first `heartbeat` confirms it as `ACTIVE` |

## Staleness: why a shut-down device cannot lock the project

A held task is **STALE** when its owner has shown no evidence of activity for
`stale_after_hours` (**12 hours**). Evidence is the newest of:

1. `last_update` in this file (set by `claim`, `heartbeat`, `handoff`, `release`);
2. a commit on `origin/main` carrying the trailer `Nexus-Device: <owner>`;
3. a commit on `origin/<branch>` when the task records a feature branch.

All three are read from the remote, not from any agent or session. Twelve
hours covers a normal working day plus an unattended build, but not an
overnight shutdown. A device that is off overnight should `handoff` or
`release` before it shuts down (see `README.md`, "Normal shutdown").

| Owner state | What another device may do |
|---|---|
| live (evidence < 12 h) | nothing without the owner: `claim --takeover --reason "..." --owner-confirmed` |
| STALE (evidence ≥ 12 h) | `claim --takeover --reason "..."` |

A takeover never erases anything. The previous owner's record stays in the
history below, the takeover and its reason are appended, the previous owner is
marked `UNKNOWN` in `DEVICE_REGISTRY.md`, and the task becomes `RECOVERING`. The
threshold is repository state (`stale_after_hours`), so changing it is a
reviewed commit.

```yaml nexus-state
task_id: P10-003
task_name: "A2 resolution, and truthful dispositions for the accessClasses gap, D17 and A7"
owner: DEVICE-01
status: ACTIVE
started_at: 2026-10-04T07:36:07.530Z
last_update: 2026-10-04T07:36:07.530Z
stale_after_hours: 12
expected_scope: "Cheap, decision-critical work only, under a YELLOW budget state. A2: resolve by removing the dead competencyDomains field and replacing the duplicated domain list with one exported source in nexus-core, guarded at type level so it cannot drift from CategoryScores again. Then truthful dispositions for the accessClasses/D4 gap, D17 and A7 as far as evidence safely allows. Expensive operations - the 432-record migration and CMS ICD-10 ingestion - are gated out: section 10 requires GREEN and the session is in the caution band."
affected_areas: "packages/nexus-core/, apps/desktop/, tools/preflight/, docs/, CHANGELOG.md, .nexus/"
branch: main
claim_commit: 5ba1c8bd908d774ac2b41c97fb4874658dba14fa
last_commit: 5ba1c8bd908d774ac2b41c97fb4874658dba14fa
handoff_required: no
handoff_to: none
next_action: "not recorded"
```

## Ownership history

Append-only. Rows are added by `nexus-sync`; never edit or delete an old row.
Timestamps are UTC.

| When (UTC) | Event | Device | Task | Detail |
|---|---|---|---|---|
| 2026-09-21T03:35:47Z | CLAIM | DEVICE-01 | NEXUS-SYNC-001 | bootstrap of the sync protocol, recorded by hand because the tooling did not exist yet |
| 2026-09-23T13:58:21.629Z | RELEASE COMPLETE | DEVICE-01 | NEXUS-SYNC-001 | complete |
| 2026-09-26T00:42:04.345Z | CLAIM | DEVICE-02 | P9-001 | claimed |
| 2026-09-26T00:47:54.651Z | HANDOFF | DEVICE-02 | P9-001 | to DEVICE-01: Resolve D15 first (it decides whether P9-A is a merge or a code change), then D16 and P9-D which need no credential. D13 then P9-B/P9-E. D14 then P9-C last, because D14 is entangled with the open D10. |
| 2026-09-26T01:12:07.319Z | CLAIM | DEVICE-01 | P9-001 | accepted handoff from DEVICE-02 |
| 2026-09-26T01:12:18.314Z | RELEASE COMPLETE | DEVICE-01 | P9-001 | Specification authored by DEVICE-02 and merged to main in PR #13 (merge commit 39dbd06); the task's recorded scope is finished. No Phase 9 implementation was in its scope. |
| 2026-09-26T01:13:50.833Z | CLAIM | DEVICE-01 | P9-002 | claimed |
| 2026-09-26T01:30:20.834Z | RELEASE BLOCKED | DEVICE-01 | P9-002 | Both DEVICE-01 lane items are gated on open owner decisions: P9-A on D15 (merge feat/training-question-bank, whose tip fixes it, or reimplement on main) and P9-B on D13 (a purchased code-signing credential). Neither may be implemented without converting an open decision into implementation authority. The lane delivered measured evidence instead; see docs/PHASE_9_DEVICE01_VALIDATION.md. Phase 9 as a whole cannot close: P9-C is gated on D14 (itself entangled with the open D10), the policy half of P9-D on D16, and P9-E on D13 plus an unrecorded legal identity. |
| 2026-09-26T12:09:31.679Z | RELEASE COMPLETE | DEVICE-01 | P9-002 | Recorded scope was classification and validation of P9-A and P9-B, delivered in docs/PHASE_9_DEVICE01_VALIDATION.md. Both items remain unimplemented and blocked by D15 and D13; that blockage is tracked as decisions in docs/DECISION_REGISTER.md and in docs/PHASES_BUILDING_CONTROL.md, not as a held task. |
| 2026-09-26T12:10:18.742Z | CLAIM | DEVICE-01 | NEXUS-SYNC-002 | claimed |
| 2026-09-26T13:11:31.676Z | RELEASE COMPLETE | DEVICE-01 | NEXUS-SYNC-002 | Canonical session registry delivered: .nexus/SESSION_REGISTRY.md, nexus-sync session register\|attach\|update\|list, N-008, protocol step 14, and the A-G scenarios. nexus-sync 81/81, preflight 25/25, nexus-core 390/390, desktop 228/228. |
| 2026-09-26T15:14:19.418Z | CLAIM | DEVICE-01 | P9-003 | claimed |
| 2026-09-26T15:26:15.833Z | RELEASE COMPLETE | DEVICE-01 | P9-003 | PR #18 and #19 integrated against the control-plane gate; PR #3 re-reconciled at 082fa95 and left unmerged (D15); governance reconciled at P9-2026-09-26-003; baseline B-003 recorded at 796c5e0. Measured: nexus-core 390/390, desktop 228/228, preflight 25/25, nexus-sync 81/81, build and typecheck clean, cargo test 55/55. |
| 2026-09-27T00:08:00.965Z | CLAIM | DEVICE-01 | P9-004 | claimed |
| 2026-09-27T00:39:35.599Z | RELEASE COMPLETE | DEVICE-01 | P9-004 | D15 executed with full pre-merge validation and recorded; Assessment closed-book boundary hardened with mutation-verified tests and confirmed live in the running app; catch-all route defect found by the route walk and fixed; ledger, Windows-readiness classification and baseline B-004 recorded; D17 and D18 opened rather than answered. |
| 2026-09-30T23:06:32.858Z | CLAIM | DEVICE-01 | P9-005 | claimed |
| 2026-09-30T23:25:30.457Z | RELEASE COMPLETE | DEVICE-01 | P9-005 | D16 resolved under the owner's standing authorization and implemented: docs/RELEASE_POLICY.md, tools/release/version.mjs (25 tests), the preflight format rule, the version display in Settings, and the release profile measured rather than assumed. P9-D satisfied. Baseline B-005 at fba3544. cargo fmt --check had been failing on main since the D15 merge and is fixed at 33b7398. |
| 2026-09-30T23:27:46.110Z | CLAIM | DEVICE-01 | P9-006 | claimed |
| 2026-09-30T23:40:22.263Z | RELEASE COMPLETE | DEVICE-01 | P9-006 | D8 resolved under the owner's standing authorization and implemented: an interrupted practice or simulation attempt is continued into a new attempt carrying its draft and its measured time, never resumed in place. Assessment excluded by mayContinueFromDraft, keeping D6 intact. Two defects fixed: the autosaved clock was zero, and the Dashboard offered to continue the live attempt. nexus-core 796/796, desktop 317/317, cargo 70/70. |
| 2026-09-30T23:40:59.163Z | CLAIM | DEVICE-01 | P9-007 | claimed |
| 2026-09-30T23:49:17.161Z | RELEASE COMPLETE | DEVICE-01 | P9-007 | D9 resolved under the owner's standing authorization and implemented: a failed evaluation is recorded as evaluation_failed with its draft and timings, surfaced as a recoverable error, retryable on the attempt's own recorded time, and counts toward nothing until scored. Assessment boundaries D2/D4 unchanged and tested in both directions. Baseline B-006 at 0c09e36. |
| 2026-09-30T23:50:28.277Z | CLAIM | DEVICE-01 | P9-008 | claimed |
| 2026-09-30T23:54:16.491Z | RELEASE COMPLETE | DEVICE-01 | P9-008 | CI created (.github/workflows/ci.yml) running the release-policy gates; AWAITING ENVIRONMENT VALIDATION - no hosted runner has executed it, and the Windows job is the uncertain part. D10 NOT resolved and closing it declined: cloud persistence needs a provider account and an account model that do not exist, and browser-local would contradict the Business Model Spec. Delivered the unblocked half - the learner-state classification, the competency-accumulator and entitlement consequences, and a labelled recommendation. |
| 2026-10-01T05:22:27.623Z | RELEASE COMPLETE | DEVICE-01 | P9-008 | complete |
| 2026-10-01T05:22:45.293Z | RELEASE COMPLETE | DEVICE-01 | P9-008 | Finalization verified for the 2026-10-01 cycle: origin/main 61540b1, tree clean, control plane P9-2026-10-01-001, D16/D8/D9 recorded RESOLVED and independently classified so by preflight, D10 still classified blocked, CI run 36793771261 at df5dae9 recorded as evidence in six places, DEVICE-02's record untouched (UNKNOWN / NOT VERIFIED from its own commit trailer). The only gap was this record's own next_action, which read 'not recorded'. |
| 2026-10-02T11:14:03.750Z | CLAIM | DEVICE-01 | P9-009 | claimed |
| 2026-10-02T11:35:15.187Z | RELEASE COMPLETE | DEVICE-01 | P9-009 | complete |
| 2026-10-04T06:58:40.405Z | CLAIM | DEVICE-01 | P10-001 | claimed |
| 2026-10-04T07:05:45.406Z | RELEASE COMPLETE | DEVICE-01 | P10-001 | D18 resolved under standing authorization: contract B canonical, migration map produced, 432 records NOT migrated and PR #21 NOT merged. Stale control-plane facts reconciled and a device-activity detection defect recorded. Commit ac8cae2. |
| 2026-10-04T07:05:50.860Z | CLAIM | DEVICE-01 | P10-002 | claimed |
| 2026-10-04T07:14:49.218Z | RELEASE COMPLETE | DEVICE-01 | P10-002 | A9 resolved by removing the dead scenarioSchemaVersion field (compatibility already carried by the Zod gate, the per-scenario content version and the content-hash gate); A6 closed as superseded by D8 with no code written; preflight learned a third outcome, superseded, because A6 is neither resolved nor blocked. Baseline B-008 at ff3a12d. nexus-core 804/804, desktop 330/330, preflight 30/30, cargo 70/70 with clippy clean. |
| 2026-10-04T07:36:07.530Z | CLAIM | DEVICE-01 | P10-003 | claimed |
