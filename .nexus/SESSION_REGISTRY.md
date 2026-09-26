# Session Registry

The canonical, repository-backed list of **development sessions** — units of
work that outlive any one Claude conversation, machine or checkout. It exists so
that DEVICE-01 and DEVICE-02 discover the same sessions without either device
being reachable, and without anyone copying a session id, a prompt or a
transcript between machines.

Change it only through `nexus-sync session register | attach | update | list`.
Those commands commit and push immediately, because a session that exists only
on one device is exactly the defect this file was created to fix.

## What a session is here, and what it is not

A **session** in this file is the logical work: "PHASES BUILDING", with a role,
a status, the control version it works under, and its next action.

A **Claude Code conversation** is not a session here, and cannot be. Its
transcript lives in per-machine application state — on DEVICE-01 that is
`%USERPROFILE%\.claude\projects\<mangled-repo-path>\<uuid>.jsonl`, 44 MB for
this repository alone — outside the repository, with a device-local uuid for a
name. The repository must never carry it: it is another machine's application
state, it holds pasted material, and `CLAUDE.md` forbids committing that class
of file. So the registry records the session, and each device attaches its own
conversation to it locally.

**What this therefore gives you:** either device can discover that a session
exists, what it is for, which control version it obeys, who last touched it, and
what to do next — and can continue that work from the repository alone. **What
it cannot give you:** reading the other device's chat history. That is not a
synchronization failure; it is application state on a different computer.

## Identity is derived, never assigned

`session_id = "S-" + slug(name)`. The slug lowercases, collapses runs of
non-alphanumeric characters to `-` and trims. So:

| Name typed on either device | Canonical id |
|---|---|
| `PHASES BUILDING` | `S-phases-building` |
| `Phases Building` | `S-phases-building` |
| `phases  building!` | `S-phases-building` |

Two devices that have never spoken derive the same id for the same work, which
is why **registering an existing session attaches to it instead of creating a
second one**. A device-local identifier — a conversation uuid, a window, a
process — is never identity, and is not stored here at all.

## How the two devices avoid overwriting each other

Keys are flat and dotted, so each line has exactly one writer:

- `<id>.<field>` — **shared**, changed only by `session update`;
- `<id>.<DEVICE-0X>.<field>` — that device's **attachment**, written only by it.

Consequences, in order of how often they matter:

1. **Both devices working at once is not a conflict.** Each writes its own
   attachment lines, so Git merges them.
2. **A late push is rejected, not merged blindly.** The tool never force-pushes,
   so the second device must synchronize first and then re-issue.
3. **A disagreement is refused.** Setting a shared field that the *other* device
   already set to a different value needs `--supersede --reason "..."`, and the
   value that was replaced is written into the registration history below. There
   is no last-write-wins path.
4. **Optimistic concurrency is available.** `--expect-revision N` refuses unless
   the session is still at revision `N`, naming who moved it.
5. **Convergence** is ordinary Git convergence: both devices read `origin/main`,
   and `nexus-sync status` prints the registry at every session start.

```yaml nexus-state
registry_version: 1
S-phases-building.DEVICE-01.attached_at: 2026-09-26T13:00:46.532Z
S-phases-building.DEVICE-01.last_seen: 2026-09-26T15:26:01.646Z
S-phases-building.DEVICE-01.last_seen_commit: 152257f378c54ccf9535fde12481b3103909dcfa
S-phases-building.name: "PHASES BUILDING"
S-phases-building.role: "orchestrator: authoritative phase plan, task partition, integration and conflict policy"
S-phases-building.status: ACTIVE
S-phases-building.control_version: P9-2026-09-26-003
S-phases-building.branch: main
S-phases-building.next_action: "C-02 integrated (PR #18, #19); baseline B-003 at 796c5e0; PR #3 CLEAN at 082fa95 and unmerged pending D15. All remaining work is owner-gated: D15, D16, D13, then D14 (needs D10); Phase 8 needs D8/D9/D10. DEVICE-02: record state through nexus-sync and independently audit B-003."
S-phases-building.created_by: DEVICE-01
S-phases-building.created_at: 2026-09-26T13:00:46.532Z
S-phases-building.updated_by: DEVICE-01
S-phases-building.updated_at: 2026-09-26T15:26:01.646Z
S-phases-building.revision: 3
S-phases-building.DEVICE-02.attached_at: 2026-09-26T14:17:11.329Z
S-phases-building.DEVICE-02.last_seen: 2026-09-26T14:17:11.329Z
S-phases-building.DEVICE-02.last_seen_commit: d162b6d36f1b11873b6d60359d281fcac55b426d
```

## Registration history

Append-only. Rows are added by `nexus-sync session`; never edit or delete an old
row. A `SUPERSEDE` row is the record of a resolved conflict and carries the value
it replaced. Timestamps are UTC.

| When (UTC) | Event | Device | Session | Detail |
|---|---|---|---|---|
| 2026-09-26T13:00:46.532Z | REGISTER | DEVICE-01 | S-phases-building | registered as PHASES BUILDING, role orchestrator: authoritative phase plan, task partition, integration and conflict policy, status ACTIVE |
| 2026-09-26T13:11:25.551Z | UPDATE | DEVICE-01 | S-phases-building | set next_action at revision 2 |
| 2026-09-26T14:17:11.329Z | ATTACH | DEVICE-02 | S-phases-building | attached DEVICE-02 to the session created by DEVICE-01 at revision 2; no shared field changed |
| 2026-09-26T15:26:01.646Z | UPDATE | DEVICE-01 | S-phases-building | set next_action, control_version at revision 3 |
