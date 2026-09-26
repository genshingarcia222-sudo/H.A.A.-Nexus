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
task_id: NEXUS-SYNC-002
task_name: "Canonical cross-device session registry"
owner: DEVICE-01
status: COMPLETE
started_at: 2026-09-26T12:10:18.742Z
last_update: 2026-09-26T13:11:31.676Z
stale_after_hours: 12
expected_scope: "Establish a Git-backed canonical registry of development sessions in .nexus, with deterministic global session identity, per-device attachment, bidirectional discovery and explicit conflict detection. Tooling and .nexus only; no application code, no decision resolved."
affected_areas: ".nexus/, tools/nexus-sync/, docs/, CHANGELOG.md"
branch: main
claim_commit: 42f1856fef2bb580a254bfae55fd2c538919008e
last_commit: 3d85c93f4a768005bf75579e236bb98c68c77c8f
handoff_required: no
handoff_to: none
next_action: "DEVICE-02 attaches to S-phases-building and runs the C-02 sweep; DEVICE-01 waits on owner decisions D15, D16, D13, D14."
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
