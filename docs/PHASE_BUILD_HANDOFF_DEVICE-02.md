# Phase Build Handoff — DEVICE-02

**Execution instructions for the DEVICE-02 lane.** This is not live ownership
state: `.nexus/ACTIVE_TASK.md` owns claims and status, and only `nexus-sync`
changes them. Read `docs/PHASES_BUILDING_CONTROL.md` first — it is the authority,
and this file is derived from it.

```yaml handoff
control_version: P9-2026-10-02-001
phase: "Phase 9 - Packaging & Release Hardening (OPEN; P9-A and P9-D satisfied; P9-B/C/E blocked on D13 and D14)"
lane: KB-01 - Knowledgebase feature lane (C-02 audit lane COMPLETE and integrated)
baseline_sha: 0c09e361ddaa46b0634859a220e049a9c5096758   # baseline B-006
current_checkpoint: feat/knowledgebase-expansion (PR #21, deliberately unmerged, 10 ahead / 0 behind main, CLEAN, blocked on D18)
nexus_task: none held by DEVICE-02; claim one before mutating (nexus-sync claim)
session: attach to S-phases-building, then register your own lane session
```

## Exact next action at control version P9-2026-10-02-001

**Next action.** Unchanged: the Knowledgebase lane
(`feat/knowledgebase-expansion`, PR #21), which **stays unmerged** - its own
integration gate is unsatisfied and **D18** (which content contract the runtime
ingests) comes first.

**What arrived on `main` that touches your branch mechanically**, none of it a
change to your architecture:

1. `package.json` `scripts` - `main` now appends four `version:*` entries after
   `nexus-sync:test`, where your branch appends nine `kb:*` entries. A textual
   conflict on merge, and a union resolution: keep both sets. Control §10(H).
2. `tools/preflight/preflight.mjs` imports `tools/release/version.mjs` for the
   one definition of a releasable version, and `versionParity` gained a
   `policyFormat` field. `tools/preflight/**` moved to DEVICE-01's owned list
   after checking that your branch changes nothing in it. If you have unpushed
   preflight work, say so rather than merging over it.
3. **CI exists and is now VERIFIED** (`.github/workflows/ci.yml`), and runs on
   every pull request, so PR #21 is checked by it. It is green on your branch:
   run `36822607147` at `9e58995`, and run `36825852812` at `dbb7c12` for PR #22.
   The gates themselves were proven on hosted runners by run `36793771261`
   (`df5dae9`), which reproduced every baseline B-006 figure off DEVICE-01,
   including `cargo test` 70/70 on `windows-latest`. **That is the figure this
   device could not measure** - you may now cite the run id instead of writing
   `NOT VERIFIED ON DEVICE-02`, because a named hosted run is evidence and a
   badge is not.

**Three decisions closed since your last handoff**, all under the owner's
*standing* authorization rather than by the owner personally, and all labelled as
such: **D16** (`docs/RELEASE_POLICY.md`), **D8** (interrupted attempts are
continued, never resumed) and **D9** (a failed evaluation is visible and
retryable). **D10 was deliberately not closed** and remains externally blocked.

## Why this lane is blocked rather than busy

Phase 9's P9-A and P9-D are satisfied; P9-B, P9-C and P9-E are gated on D13 and
D14 (control document §2), and the decision register records that no substantive
engineering work remains that does not depend on an open decision. So this lane
does not implement Phase 9 either.

**And KB-01 itself is blocked on D18.** That is the important sentence in this
file. Until D18 names which content contract the runtime ingests, every further
KB record is authored against a schema that may not be the one selected, so
*adding records is the one activity that increases risk while looking like
progress.* The rework exposure is already 324 records.

## Assigned work

1. **Hold PR #21.** It is `MERGEABLE` / `CLEAN`, 10 ahead and 0 behind `main`,
   CI-green, and marked *do not merge*. Keep it that way. If `main` advances and
   it conflicts, merge `main` into the branch and resolve under control §10 -
   `CHANGELOG.md` by §10(G), `package.json` `scripts` by §10(H) as a union of
   both sets.
2. **Dispose of PR #22 inside this lane.** It targets
   `feat/knowledgebase-expansion`, not `main`, so DEVICE-01 does not integrate
   it; it is yours to merge or close.
3. **Record your own state through `nexus-sync`.** The C-02 sweep was delivered
   without a `claim`, so DEVICE-01 had to reconcile
   `.nexus/DEVICE_REGISTRY.md` from commit evidence and left your `status` as
   `UNKNOWN` rather than assert a self-report on your behalf. Any state-writing
   command (`claim`, `heartbeat`, `release`) puts that record back in your hands.
4. **Audit, which is this device's standing role.** Independently re-verify
   `main` at baseline **B-006** (`0c09e36`) against your own run, and audit the
   reconciliation DEVICE-01 made at this control version: the claim is that
   §§2-8 of the control document now match the repository, and that the
   superseded rows are preserved in §3a rather than deleted. Disagreeing with it
   in a PR is a legitimate use of this lane.

**Do not author more KB records to fill the wait.** If the lane feels idle, that
is D18 being visible, and the correct output is to say so rather than to add
rework.

## C-02 documentation-accuracy sweep — COMPLETE, do not redo

All four items were authored here and integrated by DEVICE-01 as PR #18
(`b1ef49d`) and PR #19 (`2556d1e`): the `README.md` test counts, the `tauri dev`
contradiction, the Phase 7 audit's packaging and CSP statements, and the D7
listing in `docs/PHASE_8_3_ASSESSMENT_MODE.md` §5. They are listed here as a
closed record because an earlier revision of this file still assigned them, and
a device recovering from Git alone would have redone finished work.

Each correction cited its evidence and turned no claim into a stronger one.
Corrections are additive to the record: the history of what was previously
believed survives where each document keeps it deliberately.

## Prohibited work

- Resolving or narrowing **any** open decision — D10, D13, D14, D17, D18, A2,
  A6, A7, A9, A12. Recording a *constraint* on a decision, as PR #16 did, is
  allowed; proposing an answer is not. **D18 above all**: do not answer it by
  deleting either content contract, by writing an adapter or shim between them
  (that would be a third contract), or by letting a merge imply it. D8, D9, D15
  and D16 have since been resolved and have left this list.
- Touching DEVICE-01's owned files: `apps/desktop/**`, `packages/**`,
  `CHANGELOG.md` beyond this lane's own entry,
  `docs/PHASE_9_DEVICE01_VALIDATION.md`, `docs/DECISION_REGISTER.md` outside a
  reviewed constraint note, `docs/PHASES_BUILDING_CONTROL.md`, `.nexus/**`.
- Merging **any PR into `main`**, PR #21 above all. DEVICE-01 integrates.
  (PR #3 was merged by the owner's D15 decision at `c384ac5` and is history.)
  PR #22 is the exception that proves the rule: it targets this lane's own
  branch, not `main`.
- Recording a Windows, Rust or installer figure this device cannot measure.
  `cargo test` fails here at `gdk-sys` and WiX/NSIS cannot run; write
  `NOT VERIFIED ON DEVICE-02` and leave DEVICE-01's figure standing - or cite a
  named CI run, which is measurement rather than trust.
- Starting Phase 10, closing Phase 8, weakening tests, `git add -A`,
  force-pushing, or rewriting published history.

## Dependency requirements

**D18 blocks the whole of KB-01**, which is why items 1-4 above are holding,
auditing and recording rather than building. Any Phase 9 item proper stays
blocked until its decision is recorded in `docs/DECISION_REGISTER.md`.

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

## First commands of the session

`node tools/nexus-sync/nexus-sync.mjs start` - which prints the session registry,
so the PHASES BUILDING session is visible here without anyone sending it to you.
Attach with `nexus-sync session register --name "PHASES BUILDING"` (attaching,
not duplicating) and **confirm this control version is `P9-2026-10-02-001`**; if
your instructions name an older one, diagnose read-only and reconcile before
editing anything.

Then `nexus-sync claim` a task before mutating, and do the assigned work above:
hold PR #21, dispose of PR #22, put your own registry record back in your hands,
and audit `main` at B-006 and this control version's reconciliation. Begin no
Phase 9 implementation item, author no further KB records while D18 is open, and
do not wait on DEVICE-01 - this lane shares no implementation file with it.

*An earlier revision of this file ended by telling this device to claim P9-003
and redo items 1 and 2 of the C-02 sweep, which had already been integrated. That
instruction is withdrawn, and it is recorded here rather than silently removed.*
