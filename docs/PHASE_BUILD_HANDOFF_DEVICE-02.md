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

## Exact next action at 2026-10-04 (after D18)

**D18 is resolved, and it went against this lane's schema. Read this before
authoring anything else.**

The canonical runtime-ingestion contract is **B** — the D12 Zod model in
`packages/nexus-core/src/knowledge-corpus/`. `knowledge-corpus/schema/kb-record.schema.json`
is **retired as a contract**. The reasoning, the measurement and the full
field-level migration map are in `docs/KNOWLEDGE_ARCHITECTURE.md`.

**This is not a judgement on the work.** O1 measured the overlap at 11 of 54
field names, and those 11 are the entire governance spine — identity, provenance,
revision, review, verification, lifecycle. The two lanes agreed on governance and
differed only on the content model. B was chosen because D12 is an owner decision
and B implements it, because `main` outranks an unmerged branch, and above all
because **only B has a runtime**: your own `INTEGRATION_BLOCKERS.md` records this
corpus's storage, ingestion, indexing and retrieval as open.

**Your tooling is not retired.** `kb-privacy-scan`, fingerprint duplicate
detection, `kb-manifest`, `kb-scorecard` and the 24 policy rules are gates, not
contracts. They retarget to B-shaped records and lose nothing.

**Do not author more KB records.** 432 are already exposed to the migration; more
only increases it.

**PR #21 stays unmerged** until the records are migrated to B and re-validated.

**Three things in your records that the map could not resolve**, and that you
know the content better than anyone else does:

1. `correctChoiceIds` is an array on 318 records; B has a singular
   `correctChoiceId`. Do multi-select items genuinely exist, or is the array
   always length 1?
2. Variant lineage is 5 of your fields (`variantOf`, `parentId`, `templateId`,
   `mutationTypes`, `variantLineage`) to 3 of B's, across 375 records. Which
   distinctions must survive?
3. `accessClasses` has no home in B. It is on zero records and your generator
   cannot assign it. Until B models it, no record can be marked
   `ASSESSMENT_CLOSED_BOOK`.

**One thing about your own visibility.** `96ab675` (2026-10-02) carries **no
`Nexus-Device:` trailer**, and staleness detection reads that trailer on
`origin/main`. So `nexus-sync start` reported you idle for 184 hours while you
had committed 43 hours earlier. Your registry record is reconciled from commit
evidence, but `status` stays `UNKNOWN` because that column is a self-report and
DEVICE-01 will not write one for you. **Any state-writing `nexus-sync` command
puts it back in your hands**, and adding the trailer to branch commits makes your
work visible to the protocol.

**Still yours and still ungated:** `README.md`'s stale figures — now corrected by
DEVICE-01 under the owner's explicit §P instruction to reconcile stale facts, and
rewritten to point at `.nexus/BASELINE.md` and CI instead of repeating counts, so
it cannot go stale the same way a fourth time. Say so if you disagree with that
override.

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

5. **`README.md`'s test counts have gone stale again — and this one is ungated.**
   Found by DEVICE-01 on 2026-10-02 and left for this lane because `README.md`
   is yours. Line 157 reads *"Every package's tests (390 nexus-core + 228
   desktop = 618)"*; measured on `main` the same day it is **804 nexus-core +
   330 desktop = 1134** (66 and 33 files). Line 40 says `cargo test` is green
   with **55 tests**; it is **70/70**. The 390 + 228 figures were *correct* when
   the C-02 sweep wrote them — the D15 merge then added the Training question
   run, the D12 corpus module and the delivery layer, and nothing re-measured.

   So this is not a repeat of a closed defect; it is the same figure going stale
   a second time for a structural reason, which is worth saying in the fix: a
   hand-maintained count in prose drifts every time the suite grows. CI now
   prints all of these on every push (run `36819449371` at `9416bf8`), so cite a
   measurement and consider whether the README should quote exact counts at all
   or point at the gate that measures them. `cargo test` is the one figure this
   device cannot run — take it from the Windows job of a named CI run rather
   than from DEVICE-01's word.

**Do not author more KB records to fill the wait.** If the lane feels idle, that
is D18 being visible, and the correct output is to say so rather than to add
rework. Item 5 above is the one piece of ungated work this lane has.

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
