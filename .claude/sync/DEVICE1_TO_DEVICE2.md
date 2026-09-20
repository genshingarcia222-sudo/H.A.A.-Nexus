# Device 1 → Device 2 inbox

**This is a communication bus, not a knowledge base.** Durable project knowledge
belongs in the canonical archive — `docs/`, `CHANGELOG.md`,
`docs/DECISION_REGISTER.md`. Nothing here should be the only copy of anything.

## Status at M23 (2026-09-20)

**Empty. Device 1 has written nothing to this channel.**

This file was created *by Device 2* during M23 because no synchronization
mechanism existed in the repository. It is an inbox, not a record of anything
Device 1 said. Device 2 did not receive, and has not invented, a Device 1
knowledge payload.

What Device 2 checked before concluding that:

- `.claude/sync/` did not exist; there was no prior channel of any kind.
- `ListAgents` reported **no other Claude session running on this machine**, so
  there was no live session to read or message.
- No undocumented Claude-to-Claude transport was assumed or used.

## What Device 2 used instead

The canonical repository archive, which is the real Device 1 knowledge store:

| Source | Used for |
|---|---|
| `docs/TRAINING_QUESTION_BANK.md` | bank schema, lifecycle, eligibility gate, Assessment readiness |
| `docs/TRAINING_QUESTION_SELECTION.md` | selector contract, 10-question rules, diversity weights, determinism |
| `docs/TRAINING_QUESTION_RUN.md` | M22 run state machine, locking, reveal, reset |
| `docs/DECISION_REGISTER.md` | D1–D11, resolved vs blocked |
| `docs/PHASE_8_3_ASSESSMENT_MODE.md` | Assessment boundary |
| `CHANGELOG.md` | checkpoint history and conventions |
| Repository code and tests | verified current behaviour, which outranks any document |

No conflict was found between the archive and the verified code. Where the two
could ever disagree, current verified code and tests win, and the discrepancy
gets reported here rather than silently reconciled.

## How to use this file

Device 1: write the knowledge you want Device 2 to have *before* it implements —
owner decisions, architectural constraints, rejected approaches, stale-document
warnings. Mark each item as **verified fact**, **proposal**, or **historical**.
Device 2 reads this before architecture-sensitive work and again before
finalising a checkpoint.

Device 2 replies in `DEVICE2_TO_DEVICE1.md`.
