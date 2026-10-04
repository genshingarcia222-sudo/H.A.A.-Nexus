# Device Registry

The two logical Nexus workstations. **A record here is not evidence that a
device is online.** `status` is what the device last *recorded* about itself (or
what a takeover recorded about it), and `latest_activity` says when. Only a
commit on the remote proves anything, and `nexus-sync status` shows the age of
every record.

No hostnames, usernames, IP addresses, credentials or tokens are stored here.
Which physical machine is which device is decided locally by
`.nexus/local-device.yaml` (gitignored); see `README.md`.

## Roles

| Device | Normal role | Expected responsibility |
|---|---|---|
| **DEVICE-01** | primary implementation workstation | implements increments, runs the full suite, writes CHANGELOG entries |
| **DEVICE-02** | secondary verification/audit workstation | independently re-runs and audits what DEVICE-01 pushed, and takes over when DEVICE-01 is unavailable |

**Neither device is superior.** Either may become the active workstation at any
time: DEVICE-01 unavailable → DEVICE-02 takes over; DEVICE-02 unavailable →
DEVICE-01 continues; both unavailable → any later clone recovers from GitHub
(`RECOVERY_PROTOCOL.md` Cases C, D, E). Nothing in the tooling depends on a
particular physical device.

## Status vocabulary

| Status | Meaning |
|---|---|
| `ACTIVE` | the device recorded itself as working at `latest_activity` |
| `OFFLINE` | the device recorded a normal shutdown (`finalize --shutdown`) |
| `UNKNOWN` | no reliable record: never synchronized, or its task was taken over while it was silent |
| `HANDOFF_PENDING` | the device handed its task off and is waiting for the other device |
| `RECOVERY` | the device took over a stale task and has not yet confirmed it (`heartbeat` clears it) |

```yaml nexus-state
DEVICE-01.role: primary-implementation
DEVICE-01.status: ACTIVE
DEVICE-01.ownership: none
DEVICE-01.latest_known_commit: ac8cae24ae636131cc50b906de5e879b57418e30
DEVICE-01.latest_activity: 2026-10-04T07:05:45.406Z
DEVICE-01.last_successful_sync: 2026-10-02T11:35:24.245Z
DEVICE-02.role: secondary-verification-audit
DEVICE-02.status: UNKNOWN
DEVICE-02.ownership: none
DEVICE-02.latest_known_commit: 96ab675ad1f19ef4d6a41c8b52ba4ab65baa0f3c
DEVICE-02.latest_activity: 2026-10-02T17:16:13Z
DEVICE-02.last_successful_sync: NOT VERIFIED
```

## Reconciliation, 2026-09-26 (DEVICE-01)

DEVICE-02's record said `HANDOFF_PENDING` at `1f694f8`, which the repository had
outgrown: the P9-001 handoff was accepted by DEVICE-01 hours earlier, and
DEVICE-02 has since delivered the whole C-02 sweep.

The two evidence fields are now reconciled **from the remote**, not from a
report: `78318ca` is its newest commit on `origin/main` carrying
`Nexus-Device: DEVICE-02` (2026-09-26T15:09:01Z), and
`.nexus/SESSION_REGISTRY.md` records it attached to `S-phases-building` at
2026-09-26T14:17:11Z.

`status` is set to `UNKNOWN` rather than `ACTIVE` deliberately. This column is
what a device last recorded *about itself*, and DEVICE-02 has run no
state-writing `nexus-sync` command since 2026-09-26T00:47 - it delivered the
sweep through pull requests instead of a `claim`. DEVICE-01 will not assert a
self-report on another device's behalf. Its next `claim`, `heartbeat` or
`release` replaces this with its own.

## Reconciliation, 2026-10-04 (DEVICE-01) — and a defect in how activity is detected

DEVICE-02's evidence fields said 2026-09-26 at `78318ca`. **It has been active
twice since**, and the registry could not see either:

| Evidence | When | Carries `Nexus-Device: DEVICE-02`? |
|---|---|---|
| `fa5a040`, `640b600`, `dbb7c12` — merging `origin/main` into the Knowledgebase lane | 2026-10-01 | yes |
| `96ab675` — "Merge main into feat/knowledgebase-expansion: CHANGELOG only" | 2026-10-02T17:16:13Z | **no** |

The evidence fields are updated to `96ab675` / 2026-10-02T17:16:13Z, read from
the remote and not from any report.

**The defect this exposes.** `SYNC_PROTOCOL` staleness evidence #2 is "a commit
on `origin/main` carrying the trailer `Nexus-Device: <owner>`". `96ab675` is on
`origin/feat/knowledgebase-expansion`, not `main`, **and carries no trailer at
all** — its author is the generic `Claude`. So DEVICE-02's most recent work is
invisible to `nexus-sync start`, which reported it idle for 184 hours while it
had committed 43 hours earlier. A device that works only on a branch and omits
the trailer cannot be seen by the staleness rule, and the rule will report it
takeover-eligible.

This is recorded, not fixed. Fixing it means either widening evidence #2 to
branch commits or requiring the trailer on every device commit, and both change
`SYNC_PROTOCOL`'s takeover semantics — which is a protocol decision, not a
reconciliation. **Until then, do not take over a DEVICE-02 task on staleness
evidence alone; check `origin/feat/knowledgebase-expansion` first.**

`status` stays `UNKNOWN` and `last_successful_sync` stays `NOT VERIFIED`. Both
are self-reports, DEVICE-02 has still never run a state-writing `nexus-sync`
command, and DEVICE-01 will not assert one on its behalf.

## History before this registry

Before 2026-09-21 the two devices coordinated through a file bus,
`.claude/sync/DEVICE1_TO_DEVICE2.md` and `DEVICE2_TO_DEVICE1.md`. That bus
exists only on the unmerged branch `origin/feat/training-question-bank`. It
records that the devices had at one point been working **in the same checkout**,
and that `ListAgents` repeatedly reported no live peer session. DEVICE-02's last
activity is therefore recorded here as `NOT VERIFIED` rather than inferred from
that bus. The first `nexus-sync` command DEVICE-02 runs will record it
properly.
