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
control_version: P9-2026-09-26-002
issued: 2026-09-26
issued_by: DEVICE-01 (orchestration session; integration coordinator)
baseline_sha: 045b1e1e0fa3eb5a70ed196da16a604be903d01c   # origin/main after PR #16
authoritative_phase: "Phase 9 - Packaging & Release Hardening (OPEN, fully decision-blocked)"
phase_8_state: "OPEN - not closed by Phase 9; roadmap steps 3-8 unstarted; D8, D9, D10 open"
phase_10_state: "NOT STARTED by design (Architecture Package section 22)"
device_01_assignment: "C-01 - integration coordination, PR #3 mergeability, .nexus accuracy; NEXUS-SYNC-002 session registry (delivered)"
device_02_assignment: "C-02 - documentation-accuracy audit in its own file set; attach to the session registry"
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

## 2. Authoritative reason for the current phase state

Phase 7 is **CLOSED — PASS WITH CONDITIONS**
(`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`).

Phase 8 is **open, and is not closed by Phase 9.** Phase 8.3 Assessment is
finished — D1, D3, D4, D5, D6 and D7 are all resolved — but commercialization
roadmap steps 3–8 are unstarted and **D8**, **D9** and **D10** are open. Phase 9
is packaging; it advances neither entitlements nor web deployment nor billing.

Phase 9 is **specified and fully decision-blocked.** The specification was
authored by DEVICE-02 and merged as PR #13 (`39dbd06`). All five of its items are
gated:

| Item | State | Gate |
|---|---|---|
| **P9-A** — release builds open a console window | not implemented on `main`; **already fixed on `feat/training-question-bank`** | **D15** |
| **P9-B** — installers unsigned | not implemented | **D13** (a purchased credential) |
| **P9-C** — auto-update not wired | not implemented | **D14**, itself entangled with **D10** |
| **P9-D** — no release discipline | **enforcement half DONE** (version parity in `tools/preflight`, PR #14); policy half not authored | **D16** for the policy |
| **P9-E** — bundle metadata minimal | not implemented | **D13** plus a legal identity the repository does not record |

`docs/DECISION_REGISTER.md` states the consequence plainly: as of `aeb56d6`,
**no substantive engineering work remains that does not depend on one of the open
decisions.** This control plane therefore assigns *evidence, integration and
documentation-accuracy* work only. Neither device may convert an open decision
into implementation authority, and neither may manufacture work to look busy.

## 3. Verified state at this control version

Every line below was measured in the session that issued this document, not
carried over from an earlier report.

| Fact | Evidence |
|---|---|
| `origin/main` = local `main` = `045b1e1`, clean tree | `git rev-parse`, `git status` |
| `de2c2d1` (the P9-A fix) is **not** an ancestor of `main` | `git merge-base --is-ancestor` → false |
| `de2c2d1` **is** an ancestor of `feat/training-question-bank` tip `f4de3dc` | `git branch --contains` |
| PR #3 (`feat/training-question-bank` → `main`) is `MERGEABLE` / `CLEAN` at `f4de3dc` | GitHub |
| PR #16 integrated into `main` | merge `045b1e1`; preflight then reported 13 decisions recorded, 10 blocked, **D16 still blocked** |
| The branch is **41 commits** ahead of the merge base | `git rev-list --left-right --count` |
| The merged tree (branch + `main`) is green on DEVICE-01 | nexus-core **784/784**, desktop **282/282**, preflight **25/25**, nexus-sync **60/60**, `pnpm -r typecheck` clean, `cargo test` **70/70** |
| `main`'s own suite at `894a425` | nexus-core 390/390, desktop 228/228 — the branch adds the D12 and Question Bank work, which is why its counts are larger |
| Version parity holds on the merged tree | all four declared versions `0.1.0`, so the invariant PR #14 added on `main` is satisfied by the branch |
| Recorded baseline **B-002** | `1d7b209` (`.nexus/BASELINE.md`) |

**D15 now has complete measured inputs, and is still open.** The merge is
mechanically clean, its tree passes every check available on DEVICE-01 including
the Rust suite, and it carries the P9-A fix. None of that decides D15: the branch
also carries the Training question run (M23), Pilot Batch 001 r3 and decision
**D12**, whose register entry exists *only on that branch*. Merging it imports a
product decision into `main`. That is the owner's call, not a device's.

## 4. Known completed checkpoints

| Checkpoint | SHA | What it established |
|---|---|---|
| B-002 baseline | `1d7b209` | the recorded verified baseline |
| Phase 9 specification | `39dbd06` (PR #13) | Phase 9 scope; D13–D16 opened |
| P9-D enforcement | `d3bca14` (PR #14) | version parity enforced in preflight (DEVICE-02) |
| DEVICE-01 lane validation | `b5ec790` (PR #15) | P9-A confirmed in the artifact (PE `Subsystem` 3); P9-B confirmed unsigned |
| D16 constraint recorded | `045b1e1` (PR #16) | the parity invariant pins the crate version; D16 left unresolved |
| P9-A implemented on the branch | `de2c2d1` | windowed release build plus a source guard test; **not in `main`** |
| PR #3 conflict resolved | `f4de3dc` | `main` merged into the branch, CHANGELOG reconciled, PR #3 `CLEAN` |

## 5. Blocked decisions

**Owner decisions. No device may answer one, and no implementation may imply one.**

| ID | Question | Blocks |
|---|---|---|
| **D13** | Which code-signing identity signs the installers | P9-B, P9-E |
| **D14** | Where the update feed lives | P9-C (needs **D10** first) |
| **D15** | Merge `feat/training-question-bank`, or reimplement its fix on `main` | P9-A |
| **D16** | The release and version policy | P9-D's policy half |
| **D10** | What persists a web learner's progress | roadmap steps 4 and 5; D14 |
| **D8**, **D9** | Practice/simulation resume; evaluation-failure behaviour | the Phase 8 remainder (A6 is D8's engineering half) |
| **A2, A7, A9, A12** | Accepted Phase 7 debt awaiting decisions or content | see the register |
| **D12** | Where non-terminology reference knowledge lives | recorded **resolved on the branch only**; it reaches `main` with PR #3 |

Recommended resolution order (specification §9): **D15 → D16 → D13 → D14**, and
D14 needs D10 first.

## 6. Dependencies

- P9-A depends on D15 **only**; the implementation itself already exists.
- P9-B and P9-E share the D13 identity. P9-E additionally needs a legal entity,
  which the repository records nowhere but `LICENSE.md`'s placeholder.
- P9-C depends on D14 → D10, and must not become a route into Phase 10.
- P9-D's policy half depends on D16. Its enforcement half is already merged and
  pins the Cargo crate version to the product version (see the D16 entry).
- Phase 9 cannot close before D10 is decided, through D14.

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
`.nexus/**` (through `nexus-sync` only).

1. **Integration coordination.** Review and integrate DEVICE-02 PRs against §9.
2. **Keep PR #3 mergeable without merging it.** Whenever `main` advances, merge
   `main` into the branch and reconcile `CHANGELOG.md` by §10(G).
3. **Keep `.nexus` accurate.** `CURRENT_STATE.md` "Pending work" still describes
   the branch as 18 commits ahead of `865d31e` with tip `5bcf9f9`; the measured
   state is 41 commits ahead with tip `f4de3dc`.
4. **Hold the Phase 9 items.** P9-A and P9-B stay unimplemented on `main`.
   P9-002 was released COMPLETE once its recorded scope - classification and
   validation - was delivered; the blockage now lives in D13 and D15, which is
   where a decision belongs, not in a held task.
5. **Session registry (NEXUS-SYNC-002, delivered).** Keep `S-phases-building`
   current with `nexus-sync session update`, and keep its `control_version`
   equal to this document's.

### DEVICE-02 — C-02 (independent audit lane)

Owned files: `README.md`, `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`,
`docs/PHASE_8_3_ASSESSMENT_MODE.md`,
`docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`, `tools/preflight/**`,
`docs/PHASE_BUILD_HANDOFF_DEVICE-02.md`.

1. **Documentation-accuracy sweep.** Each item is a measured correction, and each
   is recorded in `.nexus/CURRENT_STATE.md` "Known issues" already:
   - `README.md` quotes 279 nexus-core + 144 desktop tests; re-measure and correct.
   - `README.md` says `pnpm tauri dev` "has not been launched end-to-end yet"
     while its own Rust/Tauri section records verified runtime IPC.
   - `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md` carries two statements the
     repository has outgrown: packaging "unverified" — a full `tauri build` and
     both installers were produced on DEVICE-01 at `894a425` — and the CSP line.
   - `docs/PHASE_8_3_ASSESSMENT_MODE.md` §5 still reads as though **D7** were
     open. D7 was answered on 2026-09-20.
2. **Attach to the session registry** on this device:
   `nexus-sync session register --name "Docs accuracy sweep" --role audit`, then
   `nexus-sync session register --name "PHASES BUILDING"` to attach to the shared
   session. Registering an existing session attaches rather than duplicating, so
   this is safe to re-run.
3. Every correction cites its evidence and turns no claim into a stronger one.
   Where DEVICE-02 cannot measure a figure — anything Rust, Windows or installer
   — it records `NOT VERIFIED ON DEVICE-02` and leaves DEVICE-01's figure
   standing.

### Prohibited for both devices

Resolving D8, D9, D10, D13, D14, D15, D16 or A2/A6/A7/A9/A12 · merging PR #3 ·
configuring signing, an updater feed, or bundle publisher/copyright · starting
Phase 10 · closing Phase 8 · editing the other lane's owned files · weakening or
deleting tests · `git add -A` · force-pushing or rewriting published history ·
fabricating synchronization state, test results or verification.

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
| `P9-2026-09-26-002` | 2026-09-26 | Owner-directed infrastructure task NEXUS-SYNC-002: the canonical cross-device session registry (`.nexus/SESSION_REGISTRY.md`, `nexus-sync session`, N-008). Assignments otherwise unchanged; Phase 9 is still fully decision-blocked. P9-002 released COMPLETE on its recorded scope. |
| `P9-2026-09-26-001` | 2026-09-26 | First control plane. Issued after verifying that `de2c2d1` is not in `main`, resolving the PR #3 CHANGELOG conflict at `f4de3dc`, and integrating PR #16 at `045b1e1`. Records Phase 9 as fully decision-blocked and assigns only evidence, integration and documentation-accuracy work. |
