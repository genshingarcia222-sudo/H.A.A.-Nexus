# Recovery Protocol

How to continue Nexus after anything disappears. `nexus-sync recover` reports
which of these cases apply to the current checkout. It **performs none of
them**. Recovery is always a deliberate step.

**Acceptance criterion.** Given only a fresh clone of GitHub, an operator can:
configure the device identity → read `CURRENT_STATE.md`, `ACTIVE_TASK.md`,
`HANDOFF.md` → inspect the latest verified commit → run `nexus-sync start` →
continue. No previous Claude session is needed. Every case below reduces to
that.

**Never, in any case:** `git reset --hard`, `git clean`, `git push --force`,
deleting unknown files, rewriting pushed history, or discarding another
device's work to make a conflict go away.

---

## Case A — A device was shut down

**What survives:** everything that device pushed and verified. **What does
not:** anything it never pushed.

1. On any device: `git fetch origin`, then `nexus-sync start`.
2. Read `CURRENT_STATE.md` `last_sync_commit` / `sync_status`, and `status`'s
   line confirming whether that commit is on `origin/main`.
3. If the shut-down device held the active task, see Case C/D.
4. When the device comes back, it runs `nexus-sync start` before anything
   else. If it is behind, `start --pull`. If it holds unpushed or uncommitted
   work, see Cases F and G.

A device shut down straight after `finalize` printed `REMOTE SYNC VERIFIED` has
left no gap at all.

## Case B — The Claude session was lost

Treat conversational state as gone, and as never having been authoritative.

1. The new session reads `CLAUDE.md`, which directs it to `.nexus/`.
2. Reconstruct the picture from, in this order: the remote (`git fetch`) →
   `.nexus/` → `git log` → `CHANGELOG.md` → the source tree → a fresh test run.
3. `nexus-sync start`. If `ACTIVE_TASK.md` names this device as owner, the
   lost session's task is this session's task. Continue from `next_action` and
   the newest `HANDOFF.md` entry.
4. Uncommitted edits left by the lost session: Case F.

Missing conversation history is not missing project history.

## Case C — DEVICE-01 is unavailable

DEVICE-02 may assume the work.

1. On DEVICE-02: `nexus-sync start` (fetches the latest remote state).
2. Evaluate `ACTIVE_TASK.md`:
   - task `FREE`, or `HANDOFF_PENDING` to DEVICE-02/ANY → `claim` normally;
   - `STALE` (DEVICE-01 silent ≥ `stale_after_hours`) →
     `claim --takeover --reason "DEVICE-01 unavailable since ..."`;
   - still live (< threshold) → wait, or once the owner confirms DEVICE-01 is
     not working: `claim --takeover --reason "..." --owner-confirmed`.
3. Continue from the latest remote state and the task's `next_action`. Work
   DEVICE-01 never pushed is not available, so do not try to reconstruct it
   from memory.

An unreachable DEVICE-01, or no DEVICE-01 agent in `ListAgents`, does **not**
block DEVICE-02.

## Case D — DEVICE-02 is unavailable

DEVICE-01 continues, by the same steps as Case C with the roles swapped.
DEVICE-02's normal role as auditor does not make it a prerequisite for
DEVICE-01's work.

## Case E — Both devices are unavailable

The repository is sufficient on its own. On any new machine or clone:

1. `git clone https://github.com/genshingarcia222-sudo/H.A.A.-Nexus.git`
2. `corepack enable; pnpm install` (or `npx --yes pnpm@9 install`)
3. `nexus-sync init-device DEVICE-01` (or `DEVICE-02`), taking the identity
   of the device it replaces.
4. `nexus-sync start`, then read `CURRENT_STATE.md`, `ACTIVE_TASK.md` and `HANDOFF.md`.
5. Re-verify the baseline: the test, typecheck, build and Rust commands in
   `BASELINE.md`. If they disagree with the recorded baseline, the fresh run
   wins, and the disagreement is recorded.
6. Take over the task if it is stale (Case H), and continue.

## Case F — Local modifications exist but are not committed

**Do not discard them.**

1. `git status` and `git diff`. Read what the changes are.
2. Decide whether they belong to the active task (ACTIVE_TASK scope/areas)
   and whether they are complete and safe.
3. Belongs, and safe → test, then commit.
   Belongs, but unfinished → commit to a work-in-progress branch
   (`git switch -c wip/<task>`; `git commit`; `git push -u origin wip/<task>`),
   and record the branch in the task or the handoff.
   Unknown origin → leave it untouched, record it in `CURRENT_STATE.md` known
   issues, and ask the owner.
4. Only after that, reconcile with the remote (Case G if needed).

`git stash` is allowed only when it is recorded, meaning the stash message
names the task and the HANDOFF/CURRENT_STATE records that it exists. A stash
cannot be pushed, so it is invisible to the other device.

## Case G — The remote changed while local work exists

**Do not overwrite either side.**

1. `git fetch origin`
2. Inspect both sides: `git log --oneline --left-right HEAD...@{u}`, then
   `git diff HEAD...@{u}`.
3. Make local work committed first (Case F).
4. Reconcile using the repository's normal workflow: `git rebase @{u}` for
   linear local work, or `git merge @{u}`. Resolve every conflict by hand. For
   `.nexus/` conflicts: keep **all** ownership-history rows from both sides
   (the table is append-only), keep the newer handoff entries from both sides,
   and let the most recent verified facts win in the state blocks.
5. Re-run the tests. A merge can break what both sides tested separately.
6. Commit, then `nexus-sync finalize`.

The tools refuse to push while a branch is behind or diverged. That refusal is
the point.

## Case H — The previous task owner disappeared

A stale `ACTIVE` never locks the project permanently.

1. `nexus-sync status` shows the task's latest evidence of activity and whether
   it is `STALE` (no evidence for `stale_after_hours`, 12 h by default).
2. If stale: `nexus-sync claim --takeover --reason "<why>"`. This:
   - keeps the previous owner's record: the ownership-history row is appended, never replaced;
   - marks the task `RECOVERING` and the previous owner `UNKNOWN`;
   - records `recovery_status` in `CURRENT_STATE.md`;
   - commits and pushes immediately.
3. Look for the vanished owner's pushed work: its task branch (`branch` in
   ACTIVE_TASK), `wip/*` branches, and `git log origin/main --grep "Nexus-Device:"`.
   Continue from it.
4. The first `nexus-sync heartbeat` confirms the recovery. The task returns to
   `ACTIVE` and `recovery_status` records completion.
5. If the previous owner reappears, it runs `start`, sees it is no longer the
   owner, and reconciles any unpushed work via Cases F and G. Its work is merged,
   not thrown away.

## Network failure (not a lettered case)

Work may continue locally if safe. Writing commands need `--offline`;
`finalize` records `REMOTE_SYNC_PENDING`. After connectivity returns: fetch,
reconcile, test, commit, `finalize`. Only then is the state `REMOTE_SYNCED`.
