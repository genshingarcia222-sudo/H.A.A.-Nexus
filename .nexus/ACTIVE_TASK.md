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
task_id: NEXUS-SYNC-001
task_name: Establish the distributed workstation sync and recovery protocol
owner: DEVICE-01
status: COMPLETE
started_at: 2026-09-21T03:35:47Z
last_update: 2026-09-23T13:58:21.629Z
stale_after_hours: 12
expected_scope: "Add .nexus/ state, tools/nexus-sync, protocol docs; integrate CLAUDE.md, README, CHANGELOG, .gitignore. No application behaviour change."
affected_areas: ".nexus/, tools/nexus-sync/, CLAUDE.md, README.md, CHANGELOG.md, .gitignore, package.json"
branch: main
claim_commit: 865d31e8c6883898e4dab272b71b9ddb3a0a5e9b
last_commit: 16c9a2f5e7f3746e8604a4fd726ea0850f1c9d46
handoff_required: no
handoff_to: none
next_action: "DEVICE-02: git pull --ff-only, then nexus-sync init-device DEVICE-02 and nexus-sync start"
```

## Ownership history

Append-only. Rows are added by `nexus-sync`; never edit or delete an old row.
Timestamps are UTC.

| When (UTC) | Event | Device | Task | Detail |
|---|---|---|---|---|
| 2026-09-21T03:35:47Z | CLAIM | DEVICE-01 | NEXUS-SYNC-001 | bootstrap of the sync protocol, recorded by hand because the tooling did not exist yet |
| 2026-09-23T13:58:21.629Z | RELEASE COMPLETE | DEVICE-01 | NEXUS-SYNC-001 | complete |
