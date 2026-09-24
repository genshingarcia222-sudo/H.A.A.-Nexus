# `.nexus/` — persistent Nexus project memory

This directory is the **operational memory of H.A.A. Nexus**: who is working on
what, what was last verified, what was handed off, and how to recover. It
exists so the project survives any device, any Claude session, and any
conversation disappearing without warning.

## The rules this directory encodes

- **The GitHub repository is authoritative.** The latest verified commit pushed
  to `origin` (`github.com/genshingarcia222-sudo/H.A.A.-Nexus`) is the project
  state. Nothing else is.
- **Claude sessions are not authoritative.** A session is a temporary worker.
  Conversational memory, session IDs, `ListAgents` output and agent reachability
  are never project state and never a synchronization channel.
- **Device availability is not authoritative.** A device listed in
  `DEVICE_REGISTRY.md` is a record, not proof it is online. An unreachable device
  still has whatever state it last pushed — and only that.
- **Session continuity is optional.** Every session starts from the repository,
  never from a remembered conversation.
- **All important project state is persisted here** (or in the canonical
  archive it points to: `CHANGELOG.md`, `docs/DECISION_REGISTER.md`, `docs/`).
  Nothing important may exist only in a chat.
- **Shutdown, reboot and restart cannot invalidate project state**, because the
  state is on the remote before a device is allowed to call its work
  synchronized.
- **Recovery starts from GitHub and Git history**, never from memory.

### Authority hierarchy

| Level | Source | Notes |
|---|---|---|
| 1 | Remote Git repository — a verified pushed commit | the only thing that counts as "synchronized" |
| 2 | Git-tracked `.nexus/` state | on `main`; a feature branch's copy is not shared state |
| 3 | Git history and repository files | disaster recovery |
| 4 | Local uncommitted work | preserved during reconciliation, never authoritative |
| 5 | Claude session state / conversational memory | never overrides 1–4 |

When two sources disagree, the higher level wins — except that local
uncommitted work (level 4) is **preserved** while it is reconciled, never
discarded to make a disagreement go away.

## Files

| File | Holds | Written by |
|---|---|---|
| [`CURRENT_STATE.md`](CURRENT_STATE.md) | phase, baseline, last verified results, sync record, recovery status | humans/Claude at finalization; `finalize` writes the sync fields |
| [`ACTIVE_TASK.md`](ACTIVE_TASK.md) | advisory task ownership + append-only ownership history | `claim`, `heartbeat`, `handoff`, `release` |
| [`HANDOFF.md`](HANDOFF.md) | handoff records, newest first | `handoff` (facts) + the operator (judgement fields) |
| [`DEVICE_REGISTRY.md`](DEVICE_REGISTRY.md) | DEVICE-01 / DEVICE-02 records | every writing command, for the acting device |
| [`BASELINE.md`](BASELINE.md) | latest verified baseline + preserved history | humans/Claude when a baseline is re-verified |
| [`DECISIONS.md`](DECISIONS.md) | sync/process decisions; index into the product decision register | humans/Claude |
| [`SYNC_PROTOCOL.md`](SYNC_PROTOCOL.md) | the one synchronization lifecycle | — |
| [`RECOVERY_PROTOCOL.md`](RECOVERY_PROTOCOL.md) | Cases A–H | — |
| `local-device.yaml` | **this checkout's** identity — gitignored, never committed | `init-device` |
| [`local-device.example.yaml`](local-device.example.yaml) | template for the above | — |

Each state file has exactly one fenced block tagged `yaml nexus-state`
containing flat `key: value` lines. That block is what the tooling parses;
everything around it is prose for people. Unknown values are written as
`NOT VERIFIED`, never invented.

## Tooling

`tools/nexus-sync/` implements the protocol. Any of these forms works:

```powershell
node tools/nexus-sync/nexus-sync.mjs status
.\tools\nexus-sync\nexus-sync.ps1 status        # Windows PowerShell wrapper
pnpm nexus-sync status                          # if pnpm is on PATH
```

It never force-pushes, resets, cleans, rebases, stashes or discards anything.
Its automated commits contain only `.nexus/` files it just wrote, are made with
`git commit --only`, and carry a `Nexus-Device: DEVICE-0X` trailer — that
trailer is how staleness is judged from the remote alone.

---

# How do I use Device 1 and Device 2 with Nexus?

## First device setup (or any fresh clone)

```powershell
git clone https://github.com/genshingarcia222-sudo/H.A.A.-Nexus.git
cd H.A.A.-Nexus
corepack enable; pnpm install          # or: npx --yes pnpm@9 install
node tools/nexus-sync/nexus-sync.mjs init-device DEVICE-01
node tools/nexus-sync/nexus-sync.mjs start
```

`init-device` writes `.nexus/local-device.yaml`, which is gitignored and refuses
to be created if it would not be. It says which workstation this checkout is;
it is **not** project state.

## Second device setup

Identical, with `init-device DEVICE-02`. Nothing needs to be copied between the
machines: everything the second device needs is on GitHub.

Two sessions sharing **one** checkout (this has happened before — see
`DECISIONS.md` N-004) cannot share one identity file. Give each session its own
identity with an environment variable, which overrides the file:

```powershell
$env:NEXUS_DEVICE_ID = "DEVICE-02"
```

Better still, give each device its own clone or worktree.

## Daily start

```powershell
node tools/nexus-sync/nexus-sync.mjs start          # add --pull to fast-forward a clean, behind branch
```

`start` fetches, classifies the branch (`clean`/`ahead`/`behind`/`diverged`),
checks the working tree, reads `CURRENT_STATE.md`, `ACTIVE_TASK.md` and the
latest `HANDOFF.md` entry, judges task ownership, and prints a verdict. Exit
code 1 means **STOP**: resolve what it names before working.

## Task claim

```powershell
node tools/nexus-sync/nexus-sync.mjs claim --task-id P8-D8 --name "Resolve D8 resume policy" `
  --scope "sessionStore resume path" --areas "apps/desktop/src/store, packages/nexus-core/src/simulation-engine" `
  --next "characterize current resume behaviour"
```

The claim is committed and pushed immediately — a claim that exists only on
one device coordinates nothing. Refresh it during long work with `heartbeat`.

## Task handoff

```powershell
node tools/nexus-sync/nexus-sync.mjs handoff --to DEVICE-02 --next "run the D8 characterization tests"
```

This writes a pre-filled entry to `HANDOFF.md` (commits, baseline and files
changed come from Git) and leaves the judgement fields marked `TODO(nexus)`.
Fill them in — tests run, results, decisions, known issues, remaining work — or
pass them as `--tests/--build/--typecheck/--rust/--decisions/--issues/--remaining`.
Commit, then `finalize`. `finalize` refuses while any marker remains.

The receiving device runs `start` (it will report `HANDOFF_TO_YOU`) and then
`claim` to accept.

## Normal shutdown

```powershell
# commit your work, then:
node tools/nexus-sync/nexus-sync.mjs release --status COMPLETE      # or handoff, or leave it claimed
node tools/nexus-sync/nexus-sync.mjs finalize --shutdown
```

A device may be switched off the moment `finalize` prints
`REMOTE SYNC VERIFIED`. If it prints `REMOTE SYNC NOT VERIFIED`, the work
exists only on this device — do not treat it as synchronized.

## Recovery after a crash

Nothing special: run `recover` to see which case applies, then `start`.
Uncommitted work left by the crash is shown, never discarded (Case F).

## Recovery after device loss

The surviving device runs `start`. If the lost device held the active task,
the task becomes `STALE` after `stale_after_hours` with no evidence of activity,
and the surviving device takes it over explicitly:

```powershell
node tools/nexus-sync/nexus-sync.mjs claim --takeover --reason "DEVICE-01 lost; continuing from last pushed state"
```

The previous owner's record is kept in the ownership history. Work the lost
device never pushed is gone with it — which is why `finalize` exists.

## Remote sync verification

`finalize` asks GitHub directly (`git ls-remote`) which commit the branch points
at and compares it with the local HEAD. Only an exact match is reported as
`REMOTE SYNC VERIFIED`. `status` also checks that `CURRENT_STATE.md`'s recorded
sync commit is actually present on `origin/main`.

## Conflict recovery

When local and remote have diverged, the tools stop and refuse to push. Follow
`RECOVERY_PROTOCOL.md` Case G: fetch, inspect both sides, rebase or merge by
hand, resolve every conflict without discarding either device's work, re-run
the tests, commit, `finalize`.
