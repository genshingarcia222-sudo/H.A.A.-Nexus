# Sync Protocol

This is **the** synchronization lifecycle for Nexus. There is no other. Every
session on every device follows it, whether a person or a Claude session is
driving. It never depends on another session, agent or device being reachable.

```
START → FETCH → STATUS CHECK → DETECT LOCAL CHANGES → READ CURRENT STATE
      → DETERMINE TASK OWNERSHIP → VERIFY BASELINE → WORK → TEST
      → UPDATE CHANGELOG → UPDATE .nexus STATE → COMMIT → PUSH
      → VERIFY REMOTE → RECORD SYNCHRONIZATION
```

`nexus-sync` = `node tools/nexus-sync/nexus-sync.mjs` (or `tools\nexus-sync\nexus-sync.ps1`).

## Session start: START → VERIFY BASELINE

Run `nexus-sync start`. It performs steps 1–13 below and prints a verdict. Exit
code **1 = STOP**.

| # | Step | How |
|---|---|---|
| 1 | Identify the repository | `git remote get-url origin` (credentials in URLs are redacted) |
| 2 | Identify the logical device | `NEXUS_DEVICE_ID`, else `.nexus/local-device.yaml`. **Missing = STOP** |
| 3 | FETCH | `git fetch origin`. A failure is reported as REMOTE UNREACHABLE; work may continue only if safe, and it is `REMOTE_SYNC_PENDING` |
| 4 | STATUS CHECK | `git status --porcelain` |
| 5 | Determine the branch | `git branch --show-current`. **Detached = STOP** |
| 6 | Determine divergence | `clean` / `ahead` / `behind` / `diverged` against the upstream. **diverged = STOP**; behind with local changes = STOP; behind and clean → `start --pull` fast-forwards |
| 7 | Inspect recent commits | last five, printed |
| 8 | READ CURRENT STATE | `.nexus/CURRENT_STATE.md`: from the working tree on `main`, from `origin/main` elsewhere |
| 9 | Read ACTIVE_TASK | `.nexus/ACTIVE_TASK.md` |
| 10 | Read HANDOFF | newest entry of `.nexus/HANDOFF.md` |
| 11 | VERIFY BASELINE | `baseline_commit` / `last_verified_commit` are shown; the recorded sync commit is checked against `origin/main` |
| 12 | DETECT LOCAL CHANGES | uncommitted entries are listed; they are **never** discarded (RECOVERY_PROTOCOL Case F) |
| 13 | DETERMINE TASK OWNERSHIP | `FREE`, `OWNED_BY_YOU`, `HANDOFF_TO_YOU`, `HANDOFF_OPEN`, `OWNED_BY_OTHER` (live — do not touch its scope) or `STALE` (recovery permitted) |
| 14 | Continue only when state is understood | a Claude session states what it found before editing anything |

**Memory rule.** A session never treats what it remembers from an earlier
conversation as authoritative. If memory and the repository disagree, the
repository is right, and the memory is what gets corrected.

Then claim the work: `nexus-sync claim --task-id ... --name ...`. This commits
and pushes the claim at once. If you are continuing a task you already own, run
`heartbeat` instead.

## WORK → TEST

Work normally, in small commits, following `CLAUDE.md`. During long work, run
`nexus-sync heartbeat` at natural checkpoints, so the other device can see the
task is alive (see ACTIVE_TASK.md, staleness).

TEST means the checks relevant to the change, at minimum:

| Change touches | Run |
|---|---|
| any TypeScript | `pnpm -r test`, `pnpm -r typecheck` |
| anything shipped | `pnpm -r build` |
| `apps/desktop/src-tauri` | `cargo test` (and `cargo check --all-targets`) |
| `tools/preflight`, `tools/nexus-sync` | `pnpm preflight:test`, `pnpm nexus-sync:test` |
| `.nexus/` | `pnpm nexus-sync:test` (it validates the real state files) |

Use `npx --yes pnpm@9 …` where `pnpm` is not on PATH.

## Finalization: UPDATE CHANGELOG → RECORD SYNCHRONIZATION

Before calling any meaningful task complete:

1. Run the applicable tests, typecheck, build and Rust checks (above).
2. **UPDATE CHANGELOG.** Add a new entry at the top of `CHANGELOG.md` in the
   existing style: a `## Title (date)` heading, what changed, why, what was
   verified, and what was not.
3. **UPDATE .nexus STATE.**
   - `CURRENT_STATE.md`: phase/milestone if changed, `last_verified_*`,
     pending work, known issues.
   - `BASELINE.md`: append a history entry and update the block **if a new
     baseline was verified**.
   - `HANDOFF.md`: via `nexus-sync handoff`, when another device should continue.
   - `ACTIVE_TASK.md` and `DEVICE_REGISTRY.md`: via `release` / `handoff`.
     Never edit them by hand except to repair a malformed file.
   - `DECISIONS.md`: for any new process decision. Product decisions go to
     `docs/DECISION_REGISTER.md`.
4. Inspect `git diff`. No secrets, and nothing unrelated.
5. **COMMIT**, in the repository's style (`feat(...)`, `docs:`, `nexus(sync): ...`).
6. `nexus-sync release --status COMPLETE` (or `handoff`, or keep the claim).
   This is itself committed and pushed.
7. `nexus-sync finalize` performs the rest:
   - it refuses if placeholder markers remain, the tree is dirty, or the branch
     is behind/diverged;
   - **PUSH**: plain `git push`, never forced;
   - **VERIFY REMOTE**: `git ls-remote` must report exactly the local HEAD;
   - **RECORD SYNCHRONIZATION**: writes `last_successful_sync`,
     `last_sync_device`, `last_sync_commit`, `sync_status: REMOTE_SYNCED` and
     the device's registry record, then commits, pushes and verifies again;
   - it prints the final commit SHA, the remote SHA and whether the tree is clean.
8. Report the exact final commit SHA.

## What "synchronized" means

A claim of synchronization is valid only when **all** of these hold:
the local state was validated, `.nexus/` was updated, the change was committed,
the commit was pushed, and the remote was verified to point at it.

| `finalize` prints | Meaning |
|---|---|
| `REMOTE SYNC VERIFIED` | the remote branch is exactly this commit; the device may shut down |
| `LOCAL COMMIT COMPLETE` + `REMOTE SYNC NOT VERIFIED` | the work exists **only on this device**; `sync_status` is recorded as `REMOTE_SYNC_PENDING` |

A local commit is not synchronization. Neither is a file existing locally, a
configured second device, or an agent appearing in a tool listing.

## Network failure

If GitHub is unreachable, the writing commands refuse, unless you pass
`--offline`, which commits locally and says `REMOTE SYNC NOT VERIFIED`.
`finalize` records `REMOTE_SYNC_PENDING`. When the network returns: fetch,
reconcile, test, commit, `finalize`. Only then is the state `REMOTE_SYNCED`.

## Concurrency

Two devices may work at the same time on **different** tasks. Before
beginning, read `ACTIVE_TASK.md`. If another device owns the task, do not
touch its scope. To take it over, synchronize first, then
`claim --takeover --reason "..."`. The record keeps the previous owner and the
reason. Only one task is tracked at a time. A second concurrent task on the
other device is coordinated through its branch and commits, and should be
claimed once the first is released.

Every push is a plain push. If it is rejected because the remote moved, the
tool stops. Follow RECOVERY_PROTOCOL Case G.
