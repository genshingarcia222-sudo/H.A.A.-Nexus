# Phase 9 — DEVICE-01 validation record (P9-A, P9-B)

**What this is.** Measured evidence for the two Phase 9 items assigned to
DEVICE-01, gathered on the Windows workstation that is the only device able to
produce them (`docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` §6). It is an
evidence record, not a specification: the specification is that document, and
this one does not extend, reinterpret or supersede it.

**What this is not.** No decision is resolved here. **D13** and **D15** remain
open, and nothing below may be read as authorization to act on either. Where a
measurement bears on a decision it is recorded as an input to the owner's
choice, never as the choice.

**No application, Rust, or bundler-configuration behaviour was changed by this
work.** Every finding was obtained by reading source, building unmodified
sources, and inspecting the resulting artifacts.

---

## 1. Environment and commit

| | |
|---|---|
| Device | DEVICE-01 (Windows 11 Pro for Workstations, 10.0.26200) |
| Commit measured | `894a425da8d65cf7e740e6821f03a4a301e214d8` (`main` after PR #13) |
| Branch | `claude/device01-phase9`, created from that commit |
| Rust | rustc 1.98.1 (48a229cea 2026-09-01), cargo 1.98.1 |
| Node | v24.21.0 |
| pnpm | not on PATH; invoked as `npx --yes pnpm@9` (a recorded DEVICE-01 condition) |

## 2. Baseline re-verification

The B-002 baseline re-run in full on DEVICE-01 at the commit above. **No count
regressed.**

| Check | Command | Result | vs B-002 |
|---|---|---|---|
| nexus-core | `npx --yes pnpm@9 --filter @haa-nexus/nexus-core test` | **390/390** (44 files) | unchanged |
| desktop | `npx --yes pnpm@9 -r test` | **228/228** (25 files) | unchanged |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **17/17** | unchanged |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **60/60** | unchanged |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean (nexus-core, ui-kit, desktop) | unchanged |
| Rust | `cargo test` in `apps/desktop/src-tauri` | **55/55** | unchanged |
| Preflight report | `node tools/preflight/preflight.mjs` | 13 decisions recorded, 10 blocked, 0 problems | as expected after PR #13 |

**`.nexus/BASELINE.md` was deliberately not appended to.** A new baseline entry
belongs with the matching `last_verified_*` fields in `.nexus/CURRENT_STATE.md`,
and that file is off limits to this lane while DEVICE-02 works concurrently.
Recording half of a baseline is worse than recording none, so the figures live
here and B-002 stands unchanged until Phase 9 closes (exit criterion 6).

`tauri build` was run with `beforeBuildCommand` overridden to empty, because the
configured command invokes `pnpm` directly and `pnpm` is not on PATH on this
device. The frontend was built first by the equivalent
`npx --yes pnpm@9 --filter @haa-nexus/desktop build`. Nothing in the repository
was edited to achieve this; the override was passed on the command line.

## 3. Artifacts produced

`tauri build` completed end to end and produced both bundles.

| Artifact | Size | README's recorded figure |
|---|---|---|
| `target/release/haa-nexus-desktop.exe` | 10,255,360 B (9.78 MB) | 9.8 MB — reproduces |
| `bundle/msi/H.A.A. Nexus_0.1.0_x64_en-US.msi` | 3,780,608 B (3.61 MB) | 3.6 MB — reproduces |
| `bundle/nsis/H.A.A. Nexus_0.1.0_x64-setup.exe` | 2,667,584 B (2.54 MB) | 2.5 MB — reproduces |

This closes the question §2 of the Phase 9 specification raised from the Phase 7
audit's stale text: packaging *works* on DEVICE-01 at the current commit, and
the figures README records are reproducible rather than remembered.

## 4. P9-A — release builds show a console window

**Classification: BLOCKED BY DECISION (D15).** Not implemented.

### 4.1 The defect is confirmed, and confirmed at the binary level

`apps/desktop/src-tauri/src/main.rs` on `main` does not carry
`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`. The
specification established this by reading the source. This record adds the
measurement of the artifact that source produces.

The PE optional header's `Subsystem` field is what the Windows loader reads to
decide whether to allocate a console for a process. It is the mechanism itself,
not a proxy for it. Read directly from the built file (offset `e_lfanew + 92`):

| Artifact | PE `Subsystem` | Meaning |
|---|---|---|
| `haa-nexus-desktop.exe` (release) | **3** | `IMAGE_SUBSYSTEM_WINDOWS_CUI` — **console** |
| `H.A.A. Nexus_0.1.0_x64-setup.exe` (NSIS installer) | 2 | `IMAGE_SUBSYSTEM_WINDOWS_GUI` |

So the defect is in the shipped application binary only. The NSIS installer that
delivers it is already a GUI subsystem image, which is why the console has never
been visible during installation and is visible only once the app itself runs.

### 4.2 Evidence bearing on D15, which remains open

D15 asks whether `origin/feat/training-question-bank` is merged or its fix
reimplemented on `main`. Four measurements that the owner needs, none of which
decides it:

- **The branch's fix works.** A release build of that tree, at the commit
  `de2c2d1` that was its tip when this was measured, produces PE `Subsystem`
  **2** (`IMAGE_SUBSYSTEM_WINDOWS_GUI`). The commit subject
  *"fix(desktop): release builds are windowed, not console"* is therefore
  accurate: the branch does fix P9-A — verified by building it, not inferred
  from its subject. Built in a throwaway detached worktree with a separate
  `CARGO_TARGET_DIR`; nothing in the repository was modified.
- **The branch is not a one-line fix.** It is **41 commits ahead of**
  `origin/main` and changes **85 files**. Within `apps/desktop/src-tauri` alone
  it adds a delivery-events subsystem: a new migration `004_delivery_events.sql`,
  `src/db/delivery.rs`, 645 inserted lines across nine files, and **+29 lines in
  `main.rs`** — the `windows_subsystem` attribute is a small part of a much
  larger change, and `main.rs` is one of the files it edits.
- **Therefore the two options are not equivalent in cost or in risk.** Merging
  brings a subsystem, a schema migration and open decision D12 along with the
  fix. Reimplementing is one attribute line, and creates a conflicting edit in
  `main.rs` — a file the branch already modifies — for whenever the branch is
  merged later.
- **The branch became mergeable during this session, and that is not a
  decision.** At `2026-09-25T18:14:49-07:00`, while this validation was running,
  the repository owner merged `main` into the branch through GitHub's web UI
  (commit `28fa2d1`, committer `GitHub <noreply@github.com>`). The branch went
  from 12 behind to **0 behind**, and the long-standing **PR #3**, open since
  2026-09-19, now reports `MERGEABLE` / `CLEAN`. The `windows_subsystem`
  attribute is still present at the new tip. **Making a merge possible is not
  recording a decision**: D15 is still listed as blocked in
  `docs/DECISION_REGISTER.md`, and `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`
  §9 requires the decision to be recorded there before the work it gates may
  start. PR #3 was therefore not merged by this task.

This is precisely why the specification says to resolve D15 first, and why P9-A
was not implemented here.

## 5. P9-B — installer signing is absent

**Classification: BLOCKED BY DECISION (D13).** Not implemented.

### 5.1 No signing configuration exists anywhere in the repository

A repository-wide search for `certificateThumbprint`, `digestAlgorithm`,
`timestampUrl` and `signCommand` across `*.json`, `*.toml`, `*.rs`, `*.ts`,
`*.mjs`, `*.yml` and `*.yaml` (excluding `node_modules` and `target`) returns
**no match**. `tauri.conf.json` `bundle` declares only `active`, `targets` and
`icon`.

### 5.2 The produced artifacts are unsigned, measured

`Get-AuthenticodeSignature` on each artifact:

| Artifact | Status | Signer |
|---|---|---|
| `haa-nexus-desktop.exe` | `NotSigned` | none |
| `H.A.A. Nexus_0.1.0_x64_en-US.msi` | `NotSigned` | none |
| `H.A.A. Nexus_0.1.0_x64-setup.exe` | `NotSigned` | none |

### 5.3 Why no work was done

P9-B is blocked on a credential, not on code. A code-signing identity is a
purchased legal credential that D13 has not selected, and `CLAUDE.md` and the
Phase 9 specification §8 both forbid placing such material in source control.
Writing a `windows.certificateThumbprint` referring to a certificate that does
not exist would make the build fail, not make it signed.

## 6. What was **not** validated

Stated explicitly, because the Phase 9 exit criteria depend on some of it.

- **No clean-machine installation.** Neither installer was run on a clean
  Windows machine. Exit criterion 2 requires that, and it has not happened.
- **No SmartScreen observation.** No reputation or warning behaviour was
  observed; the unsigned state is measured, its end-user consequence is not.
- **No interactive launch.** The console-window defect is established from the
  PE `Subsystem` field — the mechanism the loader acts on — not by starting the
  release build and watching a console appear. No application was launched on
  this workstation.
- **Nothing about P9-C, P9-D or P9-E.** Those are DEVICE-02's lane and are not
  assessed here.
- **No update round-trip, and no update-signing keypair** (P9-C, D14).

## 7. Outcome

| Item | Owner | Classification | Blocker |
|---|---|---|---|
| P9-A | DEVICE-01 | BLOCKED BY DECISION | **D15** open |
| P9-B | DEVICE-01 | BLOCKED BY DECISION | **D13** open (credential) |

DEVICE-01's Phase 9 lane contains **no item that an open decision authorizes
implementing**. What this cycle produced is the measured evidence above, so that
when D13 and D15 are decided the work starts from facts rather than from a
reading of the source.
