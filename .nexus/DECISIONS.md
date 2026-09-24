# Decisions

Two kinds of decision, kept in two places on purpose.

- **Product and architecture decisions** (D1–D12, A2–A12) live in
  [`docs/DECISION_REGISTER.md`](../docs/DECISION_REGISTER.md) and
  [`docs/PHASE_8_3_ASSESSMENT_MODE.md`](../docs/PHASE_8_3_ASSESSMENT_MODE.md),
  with their evidence and options. They are **not** copied here, because two
  copies of a decision drift apart. `pnpm preflight` validates that register.
  D12 is recorded only on `origin/feat/training-question-bank`.
- **Synchronization, process and recovery decisions** (the `N-` series) live
  below, in the same shape as the register's resolved entries.

Snapshot of product decisions at `865d31e`, for orientation only (the register
is authoritative): **resolved**: D1 (Assessment = Pro), D2 (principle), D3,
D4, D5, D6, D7, D11. **Open**: D8, D9, D10, A2, A7, A9, A12, and D12 on its branch.

Entries are appended and never rewritten. A superseded decision gets
`Superseded By`, and its text stays.

---

## N-001 — GitHub is the single source of truth; `.nexus/` is project memory

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | Two workstations and short-lived Claude sessions had been coordinating through conversation and a branch-local file bus. Session loss, device shutdown or an unreachable agent could strand state. |
| **Decision** | The verified pushed commit on `origin` is authoritative. Git-tracked `.nexus/` on `main` is the operational memory. Git history is disaster recovery. Conversation, sessions, agents and device reachability are never state. Authority order: remote > `.nexus/` > history/files > local uncommitted > conversation. |
| **Reason** | Only the remote survives every failure case: both devices off, session lost, fresh clone. |
| **Impact** | Every meaningful change must end committed, pushed and verified, with `.nexus/` and `CHANGELOG.md` updated. "Synchronized" means remote-verified, nothing less. |
| **Affected Components** | `.nexus/`, `CLAUDE.md`, all development workflow |
| **Superseded By** | — |

## N-002 — Authoritative state lives on `main`

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | State needs one place both devices read. Feature branches are private until merged. |
| **Decision** | `.nexus/` on `main` is authoritative. On any other branch, `nexus-sync` reads state from `origin/main`, and writing commands (`claim`, `heartbeat`, `handoff`, `release`, the `finalize` sync record) run only on `main`. Feature work may live on branches, and the task records the branch name. |
| **Reason** | It matches the repository's existing practice: direct commits to `main` alongside PR merges. It also avoids inventing a branching model. |
| **Impact** | Claims and handoffs are small `nexus(sync):` commits on `main`. |
| **Affected Components** | `tools/nexus-sync` |
| **Superseded By** | — |

## N-003 — Task ownership is advisory, with a 12-hour staleness threshold

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | Two devices must not unknowingly claim the same work. A shut-down owner must never lock the project. This is not a consensus system. |
| **Decision** | `ACTIVE_TASK.md` records one owner. A held task goes STALE after `stale_after_hours: 12` with no evidence from the remote (heartbeat, `Nexus-Device:` trailer commit, or task-branch commit). A stale task may be taken over with a recorded reason; a live one also needs `--owner-confirmed`. A takeover keeps all history and marks the task `RECOVERING` until the first heartbeat. |
| **Reason** | Twelve hours is longer than a working session plus a long build, and short enough that a device lost mid-task does not block the other for more than half a day. |
| **Impact** | Devices should `handoff` or `release` before an overnight shutdown. |
| **Affected Components** | `.nexus/ACTIVE_TASK.md`, `tools/nexus-sync` |
| **Superseded By** | — |

## N-004 — Local device identity is per checkout, overridable per session

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | The legacy bus records that the two devices once shared one checkout. It happened again during the bootstrap itself: another session switched branches in, and committed from, the checkout this work was running in (CHANGELOG, 2026-09-22). |
| **Decision** | `.nexus/local-device.yaml` (gitignored) holds only `device_id`. `NEXUS_DEVICE_ID` overrides it for a shell. No hostnames, users or credentials are committed. |
| **Reason** | A committed identity would be wrong on the other device, and a shared checkout needs a per-session override. |
| **Impact** | Each checkout runs `init-device` once. Each live session gets its own worktree or clone; two sessions never share one working tree. |
| **Affected Components** | `.gitignore`, `tools/nexus-sync` |
| **Superseded By** | — |

## N-005 — Sync tooling is zero-dependency Node with a PowerShell entry point

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | The primary environment is Windows. The repository's existing tooling (`tools/preflight`) is zero-dependency Node tested with `node:assert`. |
| **Decision** | `tools/nexus-sync/nexus-sync.mjs` holds all logic. `nexus-sync.ps1` is the Windows entry point and delegates to it. Tests run against real temporary Git repositories with a bare remote. |
| **Reason** | One implementation, tested once, runnable anywhere Node ≥ 20 is (already required by `package.json`). Logic duplicated in two languages would drift. |
| **Impact** | `node tools/nexus-sync/nexus-sync.test.mjs` is part of validation. |
| **Affected Components** | `tools/nexus-sync`, `package.json` |
| **Superseded By** | — |

## N-006 — The tooling never destroys data

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | Synchronization tools are where "just reset it" shortcuts creep in. |
| **Decision** | No force-push, reset, clean, rebase, stash or file deletion, ever. Automated commits use `git commit --only` on `.nexus/` files the tool just wrote, and refuse if those files already have uncommitted edits. The only merge is `--ff-only`, and only on explicit `start --pull` with a clean tree. Divergence and conflicts stop the tool and hand control to the operator. |
| **Reason** | Rules 1 and 21 of the sync mandate. Silently discarding another device's work is the failure this system exists to prevent. |
| **Impact** | Reconciliation (RECOVERY_PROTOCOL Case G) is always a deliberate human/Claude action. |
| **Affected Components** | `tools/nexus-sync` |
| **Superseded By** | — |

## N-007 — The legacy `.claude/sync/` bus is preserved, not migrated

| | |
|---|---|
| **Date** | 2026-09-21 |
| **Context** | `.claude/sync/DEVICE1_TO_DEVICE2.md` and `DEVICE2_TO_DEVICE1.md` exist only on the unmerged `feat/training-question-bank`, whose merge into `main` is an escalated owner decision. |
| **Decision** | Leave that branch and its bus untouched. New handoffs go to `.nexus/HANDOFF.md`, which points at the bus as history. |
| **Reason** | Copying its contents to `main` would pre-empt the owner's merge decision and create a second copy of a record. |
| **Impact** | When the branch is merged or retired, its bus becomes plain history. |
| **Affected Components** | `.nexus/HANDOFF.md`, `.nexus/DEVICE_REGISTRY.md` |
| **Superseded By** | — |
