# H.A.A. Nexus — Phases Building Control

**The durable execution contract for DEVICE-01 and DEVICE-02.** It exists so that
either device can recover its correct instructions from Git alone, without any
conversation, and so that two devices building different phases in parallel
cannot collide unknowingly.

This document carries *phase-development assignments*. It is **not** live
ownership state: task ownership, claims, heartbeats and handoffs remain in
`.nexus/ACTIVE_TASK.md` and may only be changed through `nexus-sync`. When the
two disagree about who holds a task, `.nexus/` is right; when they disagree about
what the work *is*, this document is right.

```yaml control
control_version: P9-2026-10-02-001
issued: 2026-10-02
issued_by: DEVICE-01 (orchestration session; integration coordinator)
baseline_sha: 0c09e361ddaa46b0634859a220e049a9c5096758   # the recorded baseline B-006; 045b1e1 was this plan's first issue
authoritative_phase: "Phase 9 - Packaging & Release Hardening (OPEN; P9-A SATISFIED by the D15 merge; P9-D SATISFIED by the D16 release policy; P9-B/C/E still decision-blocked)"
phase_8_state: "OPEN - not closed by Phase 9; roadmap steps 3-8 unstarted; D8 and D9 resolved 2026-10-01, D10 still open"
phase_10_state: "NOT STARTED by design (Architecture Package section 22)"
device_01_assignment: "C-01 - integration, QA and control-plane integrity. The decisions that needed neither an owner nor a credential are now all closed under the standing authorization in section 1a (D16, D8, D9), so the lane holds no ungated engineering work; it remains the integration coordinator and keeps this document and .nexus true to the repository"
device_02_assignment: "KB-01 - Knowledgebase feature lane (feat/knowledgebase-expansion, PR #21); C-02 documentation sweep COMPLETE"
```

## 1. Authority order

1. this document, at the control version above;
2. the authoritative phase specification for the phase named above
   (`docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`);
3. `docs/DECISION_REGISTER.md`;
4. the current repository implementation and its tests;
5. current Git state;
6. an individual device session's own instructions.

A device session must not act on an older prompt or an earlier conversation that
contradicts the current control version. Conversational memory is not project
state.

**Version check, every session.** Read `control_version` here. If the session was
told to work under a different one, stop substantive mutation, diagnose
read-only, and reconcile against this file before editing anything.

## 1a. Decisions closed under standing authorization

The owner has granted a standing authorization to make and implement reasoned
recommendations for decisions that are not already fixed by a higher-priority
control artifact. It changes what a session may *do*; it does not change what the
record must *say*.

**Every decision must be labelled with how it was made**, and the labels are not
interchangeable:

| Label | Means |
|---|---|
| `OWNER-DECIDED` | the owner chose it. D1, D3–D7, D11, D12, D15 |
| `CLAUDE-RECOMMENDED AND IMPLEMENTED UNDER STANDING AUTHORIZATION` | a session chose it from the project's own principles and implemented it. **D16**, **D8**, **D9** |
| `EXTERNALLY BLOCKED` | needs a credential, an identity or infrastructure that does not exist. D13, D14, D10 |
| `CONFLICTING CONTROL-PLANE INSTRUCTION` | two authoritative documents disagree and repository evidence does not settle it |

**Never record a decision a session made as one the owner made.** An owner
decision overrules a standing-authorization decision without argument, and the
owner can only exercise that if the record tells them which is which.

The exceptions remain: a session still stops and reports before anything needing
a secret, a signing identity, payment or legal details, an irreversible external
action, an action that would overwrite another session's work, or a destructive
Git operation.

## 2. Authoritative reason for the current phase state

Phase 7 is **CLOSED — PASS WITH CONDITIONS**
(`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`).

Phase 8 is **open, and is not closed by Phase 9.** Phase 8.3 Assessment is
finished — D1 and D3–D9 are all resolved, **D8 and D9 on 2026-10-01 under the
standing authorization of §1a** — but commercialization roadmap steps 3–8 are
unstarted and **D10** is open. Phase 9 is packaging; it advances neither
entitlements nor web deployment nor billing.

Phase 9 is **specified, with two of its five items satisfied and three still
decision-blocked.** The specification was authored by DEVICE-02 and merged as
PR #13 (`39dbd06`):

| Item | State | Gate |
|---|---|---|
| **P9-A** — release builds open a console window | **SATISFIED** — the attribute is on `main` (`main.rs:8`) with a guard test in the 70-test Rust suite, arrived with the D15 merge `c384ac5` | D15, **resolved 2026-09-27** |
| **P9-B** — installers unsigned | not implemented | **D13** (a purchased credential) |
| **P9-C** — auto-update not wired | not implemented | **D14**, itself entangled with **D10** |
| **P9-D** — no release discipline | **SATISFIED** — enforcement half at `d3bca14` (version parity in `tools/preflight`, PR #14); policy half authored at `fba3544` (`docs/RELEASE_POLICY.md`) | **D16**, **resolved 2026-10-01** under the standing authorization |
| **P9-E** — bundle metadata minimal | not implemented | **D13** plus a legal identity the repository does not record |

`docs/DECISION_REGISTER.md` states the consequence plainly: as of `aeb56d6`,
**no substantive engineering work remains that does not depend on one of the open
decisions**, and the decisions that §1a could close have since been closed. This
control plane therefore assigns *evidence, integration and
documentation-accuracy* work only. Neither device may convert an open decision
into implementation authority, and neither may manufacture work to look busy.

## 3. Verified state at this control version

Every line below was measured in the session that issued this document, not
carried over from an earlier report. The previous control version's table is
preserved in §3a, because its rows are what this reconciliation corrected.

| Fact | Evidence |
|---|---|
| `origin/main` = local `main` = `9416bf8` at session start, clean tree | `git status --porcelain=v1 -b`, `nexus-sync start` → `clean (ahead 0, behind 0)` |
| `de2c2d1` (the P9-A fix) **is** an ancestor of `main` | `git merge-base --is-ancestor de2c2d1 main` → true |
| `082fa95` (`feat/training-question-bank` tip) **is** an ancestor of `main` | `git merge-base --is-ancestor 082fa95 main` → true; **PR #3 is MERGED**, D15 executed at `c384ac5` |
| Every DEVICE-02 lane branch except the Knowledgebase one is fully merged | `git rev-list --left-right --count main...<branch>` → `0` on the branch side for `device01-phase9`, `device02-phase9`, `device02-phase9-d16-caveat`, `device02-c02-readme-accuracy`, `device02-c02-phase-doc-accuracy` |
| `origin/feat/knowledgebase-expansion` is **10 ahead, 0 behind** `main` | `git rev-list --left-right --count main...origin/feat/knowledgebase-expansion` → `0  10`; PR #21 `MERGEABLE` / `CLEAN`, held on **D18** |
| PR #22 targets `feat/knowledgebase-expansion`, not `main` | `gh pr list`; it is inside DEVICE-02's lane and is not a DEVICE-01 integration |
| Preflight on this tree | 18 decisions recorded, **10 blocked** (D10, A2, A9, A6, A7, A12, D13, D14, D17, D18), 7 resolved; version parity `yes`; releasable format `yes` |
| `main` is green on DEVICE-01 | nexus-core **804/804** (66 files), desktop **330/330** (33 files), preflight **27/27**, release `version` **25/25**, nexus-sync **81/81**, `pnpm -r typecheck` clean, `pnpm -r build` clean, `cargo fmt --check` clean, `cargo test --offline` **70/70**, `cargo clippy --all-targets` exit 0 (one `empty_line_after_doc_comments` style warning in `src/db/delivery.rs:13`) |
| CI is green on the current tip | run `36819449371`, `push`, `9416bf8`, conclusion `success` — the run, not the badge |
| Recorded baseline **B-006** | `0c09e36` (`.nexus/BASELINE.md`) |

**D15 is resolved and executed.** The merge happened at `c384ac5` on 2026-09-27
by owner decision, so `main` now carries the Training question run (M23), Pilot
Batch 001 r3, decision **D12** and the P9-A attribute. What that merge did *not*
do is retire the other content contract, which is why **D18** now exists.

### 3a. What the previous control version's §3 claimed

Kept verbatim rather than deleted, because a control plane that silently rewrites
its own evidence cannot be audited. These rows were measured at
`P9-2026-09-26-001` against `045b1e1` and baseline **B-002**, and five of them
the repository has since outgrown:

| Fact as recorded then | Status now |
|---|---|
| `origin/main` = local `main` = `045b1e1`, clean tree | superseded — `main` is `9416bf8` |
| `de2c2d1` is **not** an ancestor of `main` | **false now** — it is, via `c384ac5` |
| `de2c2d1` **is** an ancestor of `feat/training-question-bank` tip `f4de3dc` | still true, and the branch is itself merged |
| PR #3 is `MERGEABLE` / `CLEAN` at `f4de3dc` | superseded — PR #3 is **MERGED** |
| PR #16 integrated at `045b1e1`; preflight reported 13 recorded, 10 blocked, **D16 still blocked** | superseded — 18 recorded, 10 blocked, and **D16 is resolved** |
| The branch is **41 commits** ahead of the merge base | superseded — it is merged |
| The merged tree was green: nexus-core 784/784, desktop 282/282, preflight 25/25, nexus-sync 60/60, `cargo test` 70/70 | superseded by the B-006 figures above; the suites have grown since |
| `main`'s own suite at `894a425`: nexus-core 390/390, desktop 228/228 | historical |
| Version parity holds on the merged tree | still true, and now also enforced against the releasable format |
| Recorded baseline **B-002** at `1d7b209` | superseded by **B-006** at `0c09e36` |

The sentence that stood here — "**D15 now has complete measured inputs, and is
still open**" — was true when written and is not true now.

**Evidence for every phase claim is in `docs/PHASES_BUILDING_LEDGER.md`**: phase
status, the Phase 9 item table, open decisions, the Windows-readiness
classification and the integration state, each with the command or commit that
proves it.

## 4. Known completed checkpoints

| Checkpoint | SHA | What it established |
|---|---|---|
| B-002 baseline | `1d7b209` | the recorded verified baseline |
| Phase 9 specification | `39dbd06` (PR #13) | Phase 9 scope; D13–D16 opened |
| P9-D enforcement | `d3bca14` (PR #14) | version parity enforced in preflight (DEVICE-02) |
| DEVICE-01 lane validation | `b5ec790` (PR #15) | P9-A confirmed in the artifact (PE `Subsystem` 3); P9-B confirmed unsigned |
| D16 constraint recorded | `045b1e1` (PR #16) | the parity invariant pins the crate version; D16 left unresolved |
| P9-A implemented on the branch | `de2c2d1` | windowed release build plus a source guard test; reached `main` with `c384ac5` |
| PR #3 conflict resolved | `f4de3dc` | `main` merged into the branch, CHANGELOG reconciled, PR #3 `CLEAN` |
| **D15 executed — PR #3 merged** | `c384ac5` | owner decision 2026-09-27; `main` gains M23, Pilot Batch 001 r3, the D12 corpus module, the delivery layer and the P9-A attribute. **P9-A satisfied** |
| C-02 sweep integrated | `b1ef49d` (PR #18), `2556d1e` (PR #19) | four stale documentation statements corrected; lane C-02 **COMPLETE** |
| **D16 resolved — release and version policy** | `fba3544` | `docs/RELEASE_POLICY.md`, `tools/release/version.mjs` (6 declarations, 25/25), `[profile.release]` measured and left at defaults, `get_app_version` reached the UI. **P9-D satisfied.** Standing authorization, not an owner decision |
| B-005 / B-006 baselines | `c6b7fd5` / `ef5d7cb` | the recorded verified baselines after D16 and after D8/D9 |
| **D8 and D9 resolved** | `0c09e36` | practice/simulation resume and evaluation-failure behaviour, both under the standing authorization. Phase 8.3's decision group **D1, D3–D9** is complete |
| CI established and **VERIFIED** | `df5dae9`, run `36793771261` | the release gates run on every push and PR; both jobs green on hosted runners, reproducing every B-006 figure off DEVICE-01, including `cargo test` 70/70 on `windows-latest` |
| D10's unblocked half delivered | `9416bf8` (task P9-008) | the learner-state persistence boundary classified, the external blocker named, a labelled recommendation recorded. **D10 itself stays open** |

## 5. Blocked decisions

**Owner decisions. No device may answer one, and no implementation may imply one.**

| ID | Question | Blocks |
|---|---|---|
| **D18** | Which content contract the runtime ingests | every Knowledgebase consumer; **DEVICE-02's whole lane and PR #21** |
| **D10** | What persists a web learner's progress | roadmap steps 4 and 5; **D14** |
| **D13** | Which code-signing identity signs the installers | P9-B, P9-E |
| **D14** | Where the update feed lives | P9-C (needs **D10** first) |
| **D17** | May a learner study before retaking an interrupted Assessment | the scope of D4's closed-book window, or D6's retake rule |
| **A2, A6, A7, A9, A12** | Accepted Phase 7 debt awaiting decisions or content | see the register |

**Resolved since this table was first written, and no longer blockers:** **D15**
(2026-09-27, owner, merge `c384ac5`), **D12** (on `main` since that merge),
**D16**, **D8** and **D9** (2026-10-01, all three under the §1a standing
authorization, labelled as such in the register, the ledger and the changelog).

**The recommended order is D18 → D10 → D13 → D17.** D18 comes first because it
alone unblocks a whole lane, and because every record DEVICE-02 authors until it
is answered is written against a schema that may not be the one ingested — the
largest single piece of rework risk in the repository. D14 follows D10.

**D18 in full:** which content contract the runtime ingests — D12's Zod model in
`packages/nexus-core/src/knowledge-corpus/` (on `main` since `c384ac5`) or
`knowledge-corpus/schema/kb-record.schema.json` with its 324 records (on
`origin/feat/knowledgebase-expansion`). DEVICE-02 recorded it in
`knowledge-corpus/INTEGRATION_BLOCKERS.md` as the blocker that comes before all
its others. Neither device may answer it, and neither may make it moot by
deleting the other's contract or by writing a bridge between them — a bridge
would be a third contract.

## 6. Dependencies

- P9-A is **done**: D15 was resolved as a merge, and the attribute and its guard
  test are on `main`.
- P9-B and P9-E share the D13 identity. P9-E additionally needs a legal entity,
  which the repository records nowhere but `LICENSE.md`'s placeholder.
- P9-C depends on D14 → D10, and must not become a route into Phase 10.
- P9-D is **done**: D16 was resolved under the standing authorization and
  `docs/RELEASE_POLICY.md` is its policy half. The enforcement half pins the
  Cargo crate version to the product version (see the D16 entry), and
  `tools/release/version.mjs` keeps all six declarations equal in one command.
- Phase 9 cannot close before D10 is decided, through D14.
- **The release policy itself gates the only remaining Phase 9 output.**
  `docs/RELEASE_POLICY.md` §6 refuses a *stable* release at `0.1.0` — it is
  unsigned, its bundle metadata is empty and `LICENSE.md` is a placeholder — and
  the tag is the owner's. Neither device cuts one.

## 7. Device capability constraint

| Work | DEVICE-01 (Windows) | DEVICE-02 (Linux container) |
|---|---|---|
| Edit configuration and documentation | yes | yes |
| `cargo test` | yes — 70/70, rustc 1.98.1 | **no** — fails at `gdk-sys` (`gdk-3.0` absent) |
| `tauri build` (MSI/NSIS) | yes | **no** — WiX and NSIS are Windows-only |
| Verify no console window, a signed installer, an update round-trip | yes | no |

Every Phase 9 acceptance criterion that names a built or installed Windows
artifact belongs to **DEVICE-01**.

## 8. Assignments at this control version

### DEVICE-01 — C-01 (primary and integration lane)

Owned files: `apps/desktop/**`, `packages/**`, `CHANGELOG.md`,
`docs/DECISION_REGISTER.md`, `docs/PHASE_9_DEVICE01_VALIDATION.md`,
`docs/PHASES_BUILDING_CONTROL.md`, `docs/PHASE_BUILD_HANDOFF_DEVICE-01.md`,
`docs/PHASES_BUILDING_LEDGER.md`, `docs/RELEASE_POLICY.md`, `tools/release/**`,
`tools/nexus-sync/**`, `.nexus/**` (through `nexus-sync` only).

**Two files moved out of DEVICE-02's C-02 list at this control version**, and it
is recorded rather than done quietly: `tools/preflight/**` and
`docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`. D16 lives in both - preflight now
enforces the version format the policy sets, and P9-D is a Phase 9 item - and
C-02 is COMPLETE, while DEVICE-02's live lane (KB-01) touches neither. Verified
against `origin/feat/knowledgebase-expansion` before editing: that branch changes
no file under `tools/preflight/` and does not touch the Phase 9 document. If
DEVICE-02 has unpushed work in either, say so and it is reconciled by §10, not
overwritten.

**There is no ungated engineering work left in this lane.** That is a finding,
not a gap to fill: D16, D8 and D9 were the last decisions §1a could close, CI is
green on the current tip, and every remaining blocker in §5 needs the owner. The
lane does not invent work. What it does is standing:

1. **Integration coordination.** Review and integrate DEVICE-02 PRs against §9.
   The only one open against `main` is **PR #21, which must not be merged**: it
   is held on D18, and merging it would answer D18 silently. PR #22 targets
   `feat/knowledgebase-expansion` and is DEVICE-02's own lane, not an
   integration.
2. **Keep the control plane and `.nexus` true to the repository.** This item
   replaces "keep PR #3 mergeable": PR #3 is merged, D15 is executed, and the
   branch is an ancestor of `main`. The standing duty is the one this control
   version was issued to discharge — when `main` advances past what §2–§8 and
   `.nexus` describe, reconcile them against measured evidence and say in §12
   what changed, rather than letting the top of the authority order drift.
3. **Keep the recorded baseline and the measured suite current.** `B-006` at
   `0c09e36`; re-measure on DEVICE-01 after any substantive merge, and record
   Rust and Windows figures that only this device can produce.
4. **Hold the Phase 9 items.** P9-B, P9-C and P9-E stay unimplemented on `main`,
   and that is recorded as D13 and D14 rather than as a held task. P9-A and P9-D
   are done. **Do not cut a release** (§6).
5. **Session registry (NEXUS-SYNC-002, delivered).** Keep `S-phases-building`
   current with `nexus-sync session update`, and keep its `control_version`
   equal to this document's.

### DEVICE-02 — KB-01 (Knowledgebase feature lane), with C-02 complete behind it

Owned files: `knowledge-corpus/**`, `tools/knowledge-corpus/**`, `README.md`,
`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`,
`docs/PHASE_8_3_ASSESSMENT_MODE.md`, `docs/KNOWLEDGE_BASE_INTEGRATION_AUDIT.md`.

`tools/preflight/**` and `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` moved to
DEVICE-01 at `P9-2026-10-01-001` for the reason recorded there.
`docs/PHASE_BUILD_HANDOFF_DEVICE-02.md` is **issued by the controller**, not
owned by the lane — every commit to it carries `Nexus-Device: DEVICE-01` — and it
is derived from this section rather than being an independent instruction.

**KB-01 status: BLOCKED on D18, and correctly so.** `PR #21` holds 324 KB-001
records, a JSON Schema and zero-dependency tooling, is `MERGEABLE` / `CLEAN`, is
10 commits ahead of `main` and 0 behind, and is marked *do not merge*. CI is
green on it (run `36822607147` at `9e58995`). It stays unmerged until D18 says
which content contract the runtime ingests. **DEVICE-01 will not merge it to tidy
the tree**, and DEVICE-02 should not keep authoring records against a schema D18
may not select — that is the rework risk §5 names.

`PR #22` targets `feat/knowledgebase-expansion`, not `main`. It is inside this
lane and DEVICE-02 disposes of it; DEVICE-01 does not integrate it.

**C-02, the earlier audit lane: COMPLETE.** All four sweep items were
authored on DEVICE-02, integrated by DEVICE-01 as PR #18 (`b1ef49d`) and PR #19
(`2556d1e`), and verified on the merged `main`. The items were:
   - `README.md` quotes 279 nexus-core + 144 desktop tests; re-measure and correct.
   - `README.md` says `pnpm tauri dev` "has not been launched end-to-end yet"
     while its own Rust/Tauri section records verified runtime IPC.
   - `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md` carries two statements the
     repository has outgrown: packaging "unverified" — a full `tauri build` and
     both installers were produced on DEVICE-01 at `894a425` — and the CSP line.
   - `docs/PHASE_8_3_ASSESSMENT_MODE.md` §5 still reads as though **D7** were
     open. D7 was answered on 2026-09-20.
**What this lane does next.** Nothing in it is ungated any more, so it does not
invent work. Two things are open to it, both inside its audit role:

1. **Record its own state through `nexus-sync`.** The sweep was delivered without
   a `claim`, so `.nexus/DEVICE_REGISTRY.md` still held a superseded record for
   DEVICE-02 until DEVICE-01 reconciled it from commit evidence. Any state-writing
   command (`claim`, `heartbeat`, `release`) puts that record back in the device's
   own hands.
2. **Independently re-verify the integrated `main`** and audit DEVICE-01's
   recorded baseline **B-006** (`0c09e36`) against its own run - its stated role
   in `.nexus/DEVICE_REGISTRY.md`. Anything it cannot measure (Rust, Windows,
   installers) stays `NOT VERIFIED ON DEVICE-02`. CI now runs the same gates on
   hosted runners, so a figure DEVICE-02 cannot produce locally may still be
   read off a named run rather than taken on trust.

Every correction cites its evidence and turns no claim into a stronger one.
   Where DEVICE-02 cannot measure a figure — anything Rust, Windows or installer
   — it records `NOT VERIFIED ON DEVICE-02` and leaves DEVICE-01's figure
   standing.

### Prohibited for both devices

Resolving D10, D13, D14, D17, D18 or A2/A6/A7/A9/A12 · **merging PR #21** ·
answering D18 by merging, deleting or bridging either content contract ·
configuring signing, an updater feed, or bundle publisher/copyright · cutting a
release or creating a tag · starting Phase 10 · closing Phase 8 · editing the
other lane's owned files · weakening or deleting tests · `git add -A` ·
force-pushing or rewriting published history · fabricating synchronization
state, test results or verification.

*D8, D9, D15 and D16 were on this list and are now resolved; §5 records how each
was decided. A resolved decision leaves this list — it is not quietly re-listed
as open.*

## 9. Integration gate

A PR is integrated only when all of these hold, each checked against the
repository rather than against the PR description:

1. its scope matches the assignment and touches no other lane's owned files;
2. no open decision is resolved, narrowed or implied;
3. `mergeable` is `CLEAN`, or its conflicts were resolved under §10;
4. the relevant suites pass on the **merged result**, not only on the branch;
5. no `.nexus` change outside `nexus-sync`;
6. no later-phase leakage;
7. `CHANGELOG.md` says what was verified and what was not.

A successful Git merge is not proof of functional integration. DEVICE-01
integrates; DEVICE-02 prepares independently mergeable work and audits the result
from the repository afterwards.

## 10. Conflict-resolution policy (repository-wide, uniform)

Never resolve a conflict by picking *ours*, *theirs*, the newer commit, the
larger diff, or a device. Classify it first.

- **A — `.nexus` operational state.** Never hand-merge competing live
  synchronization state. Take `main`'s state and re-run `nexus-sync`; if ownership
  or active-task state genuinely conflicts, stop and diagnose.
- **B — generated output.** Fix the source inputs, then regenerate.
- **C — lockfiles.** Reconcile the manifests, regenerate with the repository's
  package manager, then validate.
- **D — application source.** Read the common ancestor, both changes, the phase
  specification and the tests. Preserve both intents where they are compatible;
  where they are not, the specification and the acceptance criteria decide.
- **E — tests.** Preserve valid coverage from both sides. Never delete a test or
  weaken an assertion to clear a conflict.
- **F — documentation.** Preserve compatible facts from both sides; where they
  contradict, the current authoritative repository state wins.
- **G — `CHANGELOG.md`.** Both devices insert at the top, so this is the
  predictable conflict. Preserve **every** entry from both sides, ordered newest
  first, and edit no entry's text. Verify mechanically that the number of headings
  out equals the union of the headings in — that is how `f4de3dc` was resolved:
  61 + 43 headings, union 63, merged 63, none lost, duplicated or invented.
- **H — configuration.** Preserve compatible changes; where mutually exclusive,
  the phase specification and the acceptance criteria decide.

**Semantic precedence** when two valid commits genuinely conflict: phase
specification → decision-register requirement → acceptance criteria → existing
tested behaviour → compatibility with completed work → preservation of
independent intent → least unnecessary behaviour change. If none of those decides
it, record the conflict and stop **only** the affected integration path.
Unrelated parallel work continues.

## 11. Next-phase transition rule

Phase 9 closes only when its specification §7 exit criteria all hold, every
already-satisfied item is verified rather than assumed, every blocked item is
documented, the suites and the applicable packaging checks pass, all parallel PRs
are integrated, `CHANGELOG.md` is accurate, `.nexus` is coherent, and no
future-phase work has leaked in.

Only then does the controller read the next authoritative specification,
partition it, issue a **new** control version (monotonically increasing; an old
one is never reused), record the new baseline SHA, and instruct both devices to
re-read this file. Phases are never invented here — the repository's
specifications are authoritative.

## 12. Change log for this document

| Control version | Date | Reason |
|---|---|---|
| `P9-2026-10-02-001` | 2026-10-02 | **Reconciliation, not reassignment.** No decision was resolved, no Phase 9 item implemented, no assignment changed, and nothing of DEVICE-02's was touched. What changed is that §2–§8 had drifted behind §12: they still stated that D16 blocked P9-D's policy half, that D8 and D9 were open, that D15 was open with "complete measured inputs", that `de2c2d1` was absent from `main`, and that DEVICE-01's standing duty was to keep PR #3 mergeable *without merging it* — while PR #3 has been merged since `c384ac5`, D16 since `fba3544` and D8/D9 since `0c09e36`. Because §1 ranks this document **above** the decision register, a device recovering from Git alone was being told the opposite of what the repository holds, which is the exact failure the control plane exists to prevent. §3 is re-measured in the issuing session as it claims to be, and the old table is preserved verbatim in the new §3a rather than deleted. §4 gains the five checkpoints reached since `045b1e1`. §5 drops the resolved decisions, adds **D17** and **D18**, and records the order D18 → D10 → D13 → D17. §8 replaces "keep PR #3 mergeable" with the duty this row discharges, states plainly that no ungated engineering work remains as a *finding*, and re-describes DEVICE-02's lane as KB-01 with C-02 complete behind it. The prohibition list drops D8/D9/D15/D16 and PR #3 and adds PR #21, bridging the two content contracts, and cutting a release. Baseline recorded as **B-006** `0c09e36`. Full suite re-measured green on `main` (figures in §3), CI green at `9416bf8` (run `36819449371`). |
| `P9-2026-10-01-001` | 2026-10-01 | **D16 resolved and implemented under the owner's standing authorization** (`docs/RELEASE_POLICY.md`), so **P9-D is satisfied** and Phase 9's blocked set shrinks to P9-B, P9-C and P9-E. Adds §1a: how a decision records the way it was made, and why an owner decision and a standing-authorization decision must never be written the same way. Moves `tools/preflight/**` and `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` into DEVICE-01's list, with the check that made it safe. Records a new mechanical overlap with PR #21: both lanes append to `package.json` `scripts`. |
| `P9-2026-09-27-001` | 2026-09-27 | **D15 resolved as a merge and executed** (`c384ac5`), so P9-A is satisfied and `main` now carries the Training question run, the D12 corpus module and the delivery layer. DEVICE-02's lane becomes the Knowledgebase feature lane (PR #21); DEVICE-01's becomes integration, QA and Assessment-integrity hardening. The schema-reconciliation question DEVICE-02 escalated is recorded, not resolved. |
| `P9-2026-09-26-003` | 2026-09-26 | C-02 integrated: PR #18 (`b1ef49d`) and PR #19 (`2556d1e`). Lane C-02 is COMPLETE and has no ungated work left. PR #3 re-reconciled at `082fa95` after the sweep touched the Phase 7 audit. Governance reconciled and baseline B-003 recorded. Phase 9 is still fully decision-blocked; Phase 8 is still open. |
| `P9-2026-09-26-002` | 2026-09-26 | Owner-directed infrastructure task NEXUS-SYNC-002: the canonical cross-device session registry (`.nexus/SESSION_REGISTRY.md`, `nexus-sync session`, N-008). Assignments otherwise unchanged; Phase 9 is still fully decision-blocked. P9-002 released COMPLETE on its recorded scope. |
| `P9-2026-09-26-001` | 2026-09-26 | First control plane. Issued after verifying that `de2c2d1` is not in `main`, resolving the PR #3 CHANGELOG conflict at `f4de3dc`, and integrating PR #16 at `045b1e1`. Records Phase 9 as fully decision-blocked and assigns only evidence, integration and documentation-accuracy work. |
