# Phase Build Handoff — DEVICE-02

**Execution instructions for the DEVICE-02 lane.** This is not live ownership
state: `.nexus/ACTIVE_TASK.md` owns claims and status, and only `nexus-sync`
changes them. Read `docs/PHASES_BUILDING_CONTROL.md` first — it is the authority,
and this file is derived from it.

```yaml handoff
control_version: P9-2026-09-26-003
phase: "Phase 9 - Packaging & Release Hardening (OPEN, fully decision-blocked)"
lane: C-02 - independent audit, documentation and validation tooling
baseline_sha: 045b1e1e0fa3eb5a70ed196da16a604be903d01c
current_checkpoint: 2556d1e  # PR #19 integrated; lane C-02 COMPLETE
nexus_task: none held by DEVICE-02; claim one before mutating (nexus-sync claim)
session: attach to S-phases-building, then register your own lane session
```

## Why this lane is documentation work right now

Phase 9's five items are all gated on open owner decisions (control document §2),
and the decision register records that no substantive engineering work remains
that does not depend on one of them. So this lane does not implement Phase 9. It
corrects statements the repository has outgrown — each one already listed as a
known issue in `.nexus/CURRENT_STATE.md`, so none of it is invented work.

## Assigned work — C-02 documentation-accuracy sweep

1. **`README.md` test counts.** It quotes 279 nexus-core + 144 desktop tests.
   Re-measure on `main` and correct. (`main` at `894a425` measured 390 + 228 on
   DEVICE-01; measure again rather than copying that.)
2. **`README.md` `tauri dev` contradiction.** One place says it "has not been
   launched end-to-end yet"; its own Rust/Tauri section records verified runtime
   IPC. The later, verified statement is the true one.
3. **`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`** carries two statements that
   are no longer true: packaging "unverified" — a full `tauri build` and both
   installers were produced on DEVICE-01 at `894a425`, 9.78 MB exe / 3.61 MB MSI
   / 2.54 MB NSIS — and the Content Security Policy line, which describes a real
   policy now.
4. **`docs/PHASE_8_3_ASSESSMENT_MODE.md` §5** still reads as though **D7** were
   open. D7 was answered on 2026-09-20 and the register records it as resolved.

Each correction cites its evidence, and none may turn a claim into a stronger one.
Corrections are additive to the record: do not delete the history of what was
previously believed where a document keeps it deliberately.

## Prohibited work

- Resolving or narrowing **any** decision — D8, D9, D10, D13, D14, D15, D16, A2,
  A6, A7, A9, A12. Recording a *constraint* on a decision, as PR #16 did, is
  allowed; proposing an answer is not.
- Touching DEVICE-01's owned files: `apps/desktop/**`, `packages/**`,
  `CHANGELOG.md` beyond this lane's own entry,
  `docs/PHASE_9_DEVICE01_VALIDATION.md`, `docs/DECISION_REGISTER.md` outside a
  reviewed constraint note, `docs/PHASES_BUILDING_CONTROL.md`, `.nexus/**`.
- Merging PR #3 or any PR into `main`. DEVICE-01 integrates.
- Recording a Windows, Rust or installer figure this device cannot measure.
  `cargo test` fails here at `gdk-sys` and WiX/NSIS cannot run; write
  `NOT VERIFIED ON DEVICE-02` and leave DEVICE-01's figure standing.
- Starting Phase 10, closing Phase 8, weakening tests, `git add -A`,
  force-pushing, or rewriting published history.

## Dependency requirements

None for the sweep above — it depends on no decision, which is exactly why it is
assigned. Any Phase 9 item proper stays blocked until its decision is recorded in
`docs/DECISION_REGISTER.md`.

## Validation requirements

Runnable on this device:

```
npx --yes pnpm@9 -r test
npx --yes pnpm@9 -r typecheck
npx --yes pnpm@9 -r build
node tools/preflight/preflight.mjs && node tools/preflight/preflight.test.mjs
node tools/nexus-sync/nexus-sync.test.mjs
```

Preflight and its tests matter even for a documentation change, because the
decision register is a parsed document: new bolded prose has to be shown not to
flip a blocked decision to resolved. Report the decisions line — recorded, blocked
and which IDs — as PR #16 did.

## Integration expectations

Prepare work as an independently mergeable PR against `main`, one lane concern per
PR, and let DEVICE-01 integrate it against the control document's §9 gate. If
`main` advances and the PR conflicts, resolve it under §10 — for `CHANGELOG.md`
that means every entry from both sides, newest first, no text edited.

## Exact next action

`node tools/nexus-sync/nexus-sync.mjs start` - which now prints the session
registry, so the PHASES BUILDING session is visible here without anyone sending
it to you. Attach to it with `nexus-sync session register --name "PHASES
BUILDING"` (attaching, not duplicating), confirm this control version, claim
a task (`nexus-sync claim --task-id P9-003 --name "C-02 documentation-accuracy
sweep"`), then do item 1 and item 2 in one PR, measuring the counts on this
device. Do not begin any Phase 9 implementation item, and do not wait on
DEVICE-01 — this lane shares no file with it.
