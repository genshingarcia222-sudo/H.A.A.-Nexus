# Phase Build Handoff — DEVICE-01

**Execution instructions for the DEVICE-01 lane.** This is not live ownership
state: `.nexus/ACTIVE_TASK.md` owns claims and status, and only `nexus-sync`
changes them. Read `docs/PHASES_BUILDING_CONTROL.md` first — it is the authority,
and this file is derived from it.

```yaml handoff
control_version: P9-2026-09-26-002
phase: "Phase 9 - Packaging & Release Hardening (OPEN, fully decision-blocked)"
lane: C-01 - primary implementation and integration coordination
baseline_sha: 045b1e1e0fa3eb5a70ed196da16a604be903d01c
current_checkpoint: f4de3dcd20d6fa34cdbdc75ddf4b1e4bea1d55cf  # PR #3 conflict resolved on the branch
nexus_task: NEXUS-SYNC-002 (owner DEVICE-01; P9-002 released COMPLETE on its recorded scope)
session: S-phases-building (register/attach it at every session start)
```

## Assigned work

1. **Integration coordination.** DEVICE-01 is the integration coordinator. Review
   every DEVICE-02 PR against the control document's §9 gate, integrate it, and
   verify the suites on the merged result rather than on the branch.
2. **Keep PR #3 mergeable, without merging it.** `main` advancing is what breaks
   it. When that happens: merge `main` into `feat/training-question-bank`,
   reconcile `CHANGELOG.md` by §10(G) — every entry from both sides, newest first,
   no text edited, heading count verified — then run the full suite on the merged
   tree and push the branch.
3. **Keep `.nexus` accurate.** `CURRENT_STATE.md` "Pending work" still describes
   `feat/training-question-bank` as 18 commits ahead of `865d31e` with tip
   `5bcf9f9`. The measured state is 41 commits ahead of the merge base with tip
   `f4de3dc`, and PR #3 is `CLEAN`. Correct it through the normal
   `nexus-sync`-governed flow.
4. **Hold the Phase 9 items** until an owner decision lands. P9-A and P9-B are
   not implementable, and that is recorded as D15 and D13 rather than as a held
   task.
5. **Keep the session registry current.** `nexus-sync session register --name
   "PHASES BUILDING"` attaches this device (it never duplicates), and
   `session update --id S-phases-building --next "..."` records where the work
   stands so DEVICE-02 can continue it from Git alone.

## Prohibited work

- **Merging PR #3.** That is **D15**, an open owner decision, whatever the merge
  button now says.
- **Implementing P9-A on `main`.** The specification forbids it before D15, and
  the fix already exists at `de2c2d1` on the branch.
- **P9-B / P9-E:** no `certificateThumbprint`, `digestAlgorithm`, `timestampUrl`,
  `signCommand`, `publisher` or `copyright`. D13 has named no identity, and
  `LICENSE.md` holds a placeholder rather than a legal entity.
- **P9-C:** no `tauri-plugin-updater` dependency and no `plugins.updater` block.
  D14 is open and entangled with D10.
- **P9-D's policy half:** no tagging scheme, channel policy or release checklist.
  That is D16 itself. The enforcement half is already merged.
- Closing Phase 8, starting Phase 10, editing DEVICE-02's owned files, weakening
  tests, `git add -A`, force-pushing, rewriting published history, or recording
  verification that was not performed.

## Dependency requirements

Nothing in this lane's remaining Phase 9 work may start before its decision is
recorded in `docs/DECISION_REGISTER.md`: P9-A needs D15, P9-B and P9-E need D13,
P9-C needs D14 which needs D10, P9-D's policy needs D16.

## Validation requirements

On this device, for any change touching code, and on the **merged** tree:

```
npx --yes pnpm@9 -r test            # nexus-core and desktop
npx --yes pnpm@9 -r typecheck
node tools/preflight/preflight.mjs && node tools/preflight/preflight.test.mjs
node tools/nexus-sync/nexus-sync.test.mjs
cd apps/desktop/src-tauri && cargo test --offline
```

Last measured on the merged PR #3 tree at `f4de3dc`: nexus-core **784/784**,
desktop **282/282**, preflight **25/25**, nexus-sync **60/60**, typecheck clean,
`cargo test` **70/70**. No count may regress below these, or below B-002 on
`main`. A documentation-only change runs preflight and its tests, because the
decision register is parsed.

## Integration expectations

DEVICE-02's PRs arrive independently mergeable. Verify scope, decision compliance,
conflict class, merged-tree suites, `.nexus` untouched and no later-phase leakage,
then merge with a merge commit — never a squash that would erase the other
device's authorship, and never a force-push.

## Exact next action

`node tools/nexus-sync/nexus-sync.mjs start`, confirm this control version, then:
if an owner decision has landed in `docs/DECISION_REGISTER.md`, implement exactly
what it authorizes and nothing adjacent. If none has, and `main` has advanced
since `045b1e1`, re-reconcile PR #3 under §10(G). If neither is true, integrate
any open DEVICE-02 PR that passes §9, and otherwise stop and report — do not
invent Phase 9 work to fill the wait.
