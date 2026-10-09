# Phase Build Handoff — DEVICE-01

**Execution instructions for the DEVICE-01 lane.** This is not live ownership
state: `.nexus/ACTIVE_TASK.md` owns claims and status, and only `nexus-sync`
changes them. Read `docs/PHASES_BUILDING_CONTROL.md` first — it is the authority,
and this file is derived from it.

```yaml handoff
control_version: P9-2026-10-02-001
phase: "Phase 9 - Packaging & Release Hardening (OPEN; P9-A and P9-D satisfied; P9-B/C/E blocked on D13 and D14)"
lane: C-01 - integration coordination and control-plane integrity; the decisions standing authorization could close are closed
baseline_sha: 0c09e361ddaa46b0634859a220e049a9c5096758   # baseline B-006
current_checkpoint: see .nexus/CURRENT_STATE.md  # PR #3 merged at c384ac5 (D15); D16 at fba3544; D8/D9 at 0c09e36
nexus_task: see .nexus/ACTIVE_TASK.md for the live task, owner and status - this file never names it
session: S-phases-building (register/attach it at every session start)
```

## Exact next action at 2026-10-04 (after D18)

**D18 is resolved. That changes what this lane can do next.**

`docs/KNOWLEDGE_ARCHITECTURE.md` is the authoritative three-layer boundary and
holds the field-level A-to-B migration map. Contract **B** — the D12 Zod model in
`packages/nexus-core/src/knowledge-corpus/` — is canonical.

**Next safe atomic unit, in dependency order.** None of these was started; each
is sized to reach a commit on its own.

| # | Unit | Why it is next | Size |
|---|---|---|---|
| 1 | **ICD-10-CM ingestion from CMS** | the largest unbuilt requirement, and `codingReference` in B is already its shape. CMS is reachable (HTTP 200, 2026-10-04); **nothing has been retrieved** | large — do not start below ~20 points of session headroom |
| 2 | **Migrate the 432 KB records to contract B** | unblocked by D18, blocks PR #21. Follow the map; classes (a) and (b) are mechanical, class (c) needs a decision per field | large |
| ~~3~~ | ~~**D17**~~ | **Characterized 2026-10-09 — OWNER DECISION REQUIRED.** Not resolvable under standing authorization: every option, including leaving it open, states a policy about D4's scope or D6's retake rule. The decision packet is in the register. No code changed; the 26 characterization tests still pass | done |

**A2, A7 and the accessClasses question are closed as of 2026-10-04.** A2
resolved - the dead field removed, and a third previously unrecorded copy of the
domain list eliminated, so the domains now live once in nexus-core and are
compile-guarded. A7 deferred, with its unblocking condition named and a truthful
blocker marker so it reads as a choice rather than an oversight.

**The accessClasses disposition changes planning, so read it before sizing any
corpus work:** no schema change is needed, and **a Knowledge Corpus browser is no
longer blocked behind a record-level access model**. D4 blocks surfaces, not
records, so a browser ships as a gated route exactly as `/knowledge-base` does.
The previous statement to the contrary in `docs/KNOWLEDGE_ARCHITECTURE.md` was
wrong and is corrected there. `accessClasses` is the one class-(c) field the
migration map deliberately leaves behind.

**D17 is characterized and waiting on the owner as of 2026-10-09.** That was
the last cheap decision in this lane. **Everything that remains is either an
owner decision or one of the two large operations** — there is no third
category left, which is worth knowing before planning a session.

Two findings from the characterization that change how D17's options should be
priced, both recorded in the register: **D10 does not block the decision, it
blocks uniform enforcement** (option 2 works on desktop today and is silently
inert on web until D10), and **option 2 is cheaper than the entry implied** —
`findInterrupted()` already exists and the Dashboard already calls it, so the
missing piece is one boot-time read, not a persistence layer.

**Do not start unit 1 or 2 without checking the expensive-operation gate first.**
A half-migrated corpus or a half-retrieved CMS snapshot is worse than neither.

**Three questions the migration map raises and does not answer** — settle them
before touching records: `correctChoiceIds` (array, 318 records) against B's
singular `correctChoiceId`; variant lineage, 5 A-fields to 3 B-fields across 375
of 432 records; and `accessClasses`, which has **no home in B at all**, so no
record can yet be marked `ASSESSMENT_CLOSED_BOOK`.

**A standing constraint that is now sharper:** D4 is held today by the route gate
and the source-scanning invariant, **not at the record**. A Knowledge Corpus
browser must not ship before `accessClasses` has a home in B.

**Still owner-gated, and nothing here can close them:** **D10** (needs a provider
account and an account model), **D14** (needs D10), **D13** (a purchased signing
identity), plus **A12** and Pilot Batch 001, which need human clinical review that
cannot be faked. Do not cut a release: `docs/RELEASE_POLICY.md` §6 refuses a
stable one at `0.1.0`.

**Do not merge PR #21.** D18 being answered is a precondition for that work, not
a substitute for it.

## Assigned work

1. **Integration coordination.** DEVICE-01 is the integration coordinator. Review
   every DEVICE-02 PR against the control document's §9 gate, integrate it, and
   verify the suites on the merged result rather than on the branch.
   The only PR open against `main` is **#21, which must not be merged** — it is
   held on D18. **#22** targets `feat/knowledgebase-expansion` and belongs to
   DEVICE-02; DEVICE-01 does not integrate it.
2. **Keep the control plane and `.nexus` true to the repository.** This replaces
   the old "keep PR #3 mergeable without merging it", which the repository has
   outgrown: PR #3 was **merged** at `c384ac5` when the owner resolved D15, and
   `082fa95` is an ancestor of `main`. The live duty is the one
   `P9-2026-10-02-001` was issued to discharge — when `main` advances past what
   the control document's §§2–8 and `.nexus` describe, re-measure and reconcile
   them, and say in §12 what changed. The top of the authority order is allowed
   to be terse; it is not allowed to be wrong.
3. **Keep the baseline and the measured suite current.** `B-006` at `0c09e36`.
   Re-measure on this device after any substantive merge, and record the figures
   only this device can produce — `cargo test`, `cargo fmt --check`, `tauri
   build`, installer inspection. CI reproduces the cross-platform half on hosted
   runners, so read the run id, never the badge.
4. **Hold the Phase 9 items** until an owner decision lands. P9-A and P9-D are
   **done**; P9-B, P9-C and P9-E are not implementable, and that is recorded as
   D13 and D14 rather than as a held task.
5. **Keep the session registry current.** `nexus-sync session register --name
   "PHASES BUILDING"` attaches this device (it never duplicates), and
   `session update --id S-phases-building --next "..."` records where the work
   stands so DEVICE-02 can continue it from Git alone.

## Prohibited work

- **Merging PR #21**, or answering **D18** by merging, deleting or bridging
  either content contract. A bridge would be a third contract. DEVICE-02's lane
  is blocked on D18 and tidying the tree is not a reason to unblock it.
- **Cutting a release or creating a tag.** `docs/RELEASE_POLICY.md` §6 refuses a
  stable release at `0.1.0` — unsigned, empty bundle metadata, placeholder
  licence — and the tag is the owner's.
- **P9-B / P9-E:** no `certificateThumbprint`, `digestAlgorithm`, `timestampUrl`,
  `signCommand`, `publisher` or `copyright`. D13 has named no identity, and
  `LICENSE.md` holds a placeholder rather than a legal entity.
- **P9-C:** no `tauri-plugin-updater` dependency and no `plugins.updater` block.
  D14 is open and entangled with D10.
- **Re-opening P9-D.** It is satisfied: `docs/RELEASE_POLICY.md` is the policy
  half (D16, standing authorization) and parity enforcement is merged. Changing
  the policy is a new decision, not maintenance of this one.
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
