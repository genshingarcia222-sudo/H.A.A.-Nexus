# PHASES BUILDING Ledger

The evidence behind every phase claim, in one place. `docs/PHASES_BUILDING_CONTROL.md`
says who does what; this says **what is true, and what proves it**.

One rule governs every row: a status is only as good as the command or commit in
its evidence column. "Verified" means it was run on a named device against a
named commit. Anything else says so.

**Control version:** `P9-2026-09-27-001` · **Ledger updated:** 2026-09-27 ·
**Canonical `main`:** see `.nexus/CURRENT_STATE.md`, which `nexus-sync` re-checks
against the remote on every read.

## 1. Phases

| Phase | Objective | Status | Evidence | Blocker |
|---|---|---|---|---|
| 7 | Pre-commercialization audit and stabilization gate | **CLOSED — PASS WITH CONDITIONS** | `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`; two of its conditions (packaging, `csp: null`) since cleared and marked in place | — |
| 8 | Commercialization implementation | **OPEN** | 8.1 entitlements and 8.3 Assessment complete (D1, D3–D7 resolved); roadmap steps 3–8 unstarted | **D8, D9, D10** |
| 9 | Packaging and release hardening | **OPEN, one item done** | `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`; P9-A satisfied at `c384ac5`, P9-D enforcement half at `d3bca14` | **D13, D14, D16** |
| 10 | Cloud and API architecture | **NOT STARTED, by design** | Architecture Package §22 | D14 must not be used as a route into it |

## 2. Phase 9 items

| Item | Objective | Status | Evidence | Acceptance condition |
|---|---|---|---|---|
| **P9-A** | Release builds open no console window | **SATISFIED** | `main.rs:8` carries `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`; guard test in the 70-test Rust suite; arrived with D15 merge `c384ac5` | A Windows release build showing no console window — the attribute is the mechanism; a clean-machine run has not been repeated since the merge |
| **P9-B** | Installers are signed | **BLOCKED** | No `certificateThumbprint`, `digestAlgorithm`, `timestampUrl` or `signCommand` anywhere in `tauri.conf.json`; `Get-AuthenticodeSignature` reported `NotSigned` for all three artifacts | **D13** names an identity, then a signed installer runs on a clean machine without a signing-attributable SmartScreen block |
| **P9-C** | Auto-update is wired | **BLOCKED** | `Cargo.toml` has no `tauri-plugin-updater`; `tauri.conf.json` has no `plugins.updater` and no `createUpdaterArtifacts` (confirmed again 2026-09-27: `plugins: []`) | **D14** (needs **D10**), then one version-to-version update completed against a real feed |
| **P9-D** | Release discipline | **HALF DONE** | Version parity enforced in `tools/preflight/preflight.mjs`, all four declarations `0.1.0`; the policy half is unwritten | **D16** sets tagging, channels and who cuts a release |
| **P9-E** | Bundle metadata | **BLOCKED** | `bundle` carries only `active`, `icon`, `targets`; no `publisher`, `copyright` or `licenseFile`; `LICENSE.md` holds a placeholder, not a legal entity | **D13** plus a recorded legal identity |

## 3. Open decisions

| ID | Question | Blocks | Owner action needed |
|---|---|---|---|
| **D8** | Practice/simulation resume (A6 is its engineering half) | Phase 8 remainder | Decide resume semantics |
| **D9** | Evaluation-failure behaviour | Phase 8 remainder | Decide what happens to a failed evaluation |
| **D10** | What persists a web learner's progress | Roadmap steps 4–5; **D14** | Choose the persistence model |
| **D13** | Code-signing identity | P9-B, P9-E | Purchase or designate a certificate |
| **D14** | Update-feed location | P9-C | Decide, after D10 |
| **D16** | Release and version policy | P9-D policy half | Write the policy |
| **D17** | May a learner study before retaking an interrupted Assessment? | The scope of the closed-book window | Decide whether the window extends past an attempt |
| **D18** | Which content contract does the runtime ingest | Every Knowledgebase consumer | Choose D12's Zod model or the KB JSON Schema |
| **A2, A6, A7, A9, A12** | Accepted Phase 7 debt | Various | See the register |

Resolved and implemented: **D1, D2, D3, D4, D5, D6, D7, D11, D12, D15**.

## 4. Windows and desktop readiness

Classified as the charter requires. **Nothing here claims a validation that was
not actually performed on a Windows machine.**

**1. Verified — run on the DEVICE-01 Windows workstation**

| Item | Evidence |
|---|---|
| Rust suite | `cargo test --offline` **70/70**, rustc 1.98.1, cargo 1.98.1 |
| Packaging produces artifacts | `tauri build` at `894a425`: 9.78 MB exe, 3.61 MB MSI, 2.54 MB NSIS setup |
| Release builds are windowed | PE `Subsystem` 2 measured on a build of the branch that is now `main` |
| Cross-platform path handling | `app_data_dir().join("haa-nexus.sqlite")` with `create_dir_all`; tests use `std::env::temp_dir()`. No hardcoded POSIX path in shipped code |
| Tooling runs on Windows | preflight **25/25**, nexus-sync **81/81**, both zero-dependency Node with explicit CRLF handling |
| Web/desktop parity of the closed-book boundary | Exercised live in the browser preview on 2026-09-27 as well as in jsdom |

**2. Statically validated — read from configuration, not executed**

- No signing configuration of any kind (P9-B).
- No updater plugin or dependency; `plugins` is empty (P9-C).
- `bundle` has no `publisher`, `copyright` or `licenseFile` (P9-E).
- **No `[profile.release]` in `Cargo.toml`**, so Cargo's defaults apply: symbols
  are not stripped and LTO is off. Not a defect, and deliberately **not changed
  here** — it alters the shipped artifact, and sizing belongs with the release
  policy D16 rather than with an unrequested edit.
- Window configuration is present and sane (1280×800, minimum 1024×700).
- A real Content Security Policy is set, with a separate `devCsp`.

**3. Awaiting environment-specific validation**

- A signed installer on a **clean** Windows machine, including SmartScreen
  behaviour. Blocked by D13.
- An update round-trip against a real feed. Blocked by D14.
- MSI upgrade and downgrade paths, and per-user versus per-machine install.
- A clean-machine run of the **current** `main` build: `tauri build` has not been
  re-run since the D15 merge. Nothing in that merge touches the bundler
  configuration, but the artifact itself has not been rebuilt and measured.

**4. Blocked** — P9-B (D13), P9-C (D14 → D10), P9-E (D13 plus a legal identity),
P9-D's policy half (D16).

**5. Recommended, not executed: there is no CI.** `.github/workflows/` does not
exist, so every check in this ledger was run by hand on a device. That is also why
a commit made outside a session — the GitHub Desktop commits recorded in
`.nexus/CURRENT_STATE.md` "Known issues" — can land on `main` without any suite
running. A workflow running `pnpm -r test`, `-r typecheck`, `-r build`, preflight
and the nexus-sync suite on every push would close that gap cheaply, with an
optional Windows job for `cargo test`. It is **not** created here: it is standing
automation on the owner's account and it consumes their Actions minutes, which is
their decision, not an engineering one.

## 5. Integration state

| Branch / PR | State | Note |
|---|---|---|
| `feat/training-question-bank` (PR #3) | **MERGED** `c384ac5` | D15, owner decision 2026-09-27 |
| `feat/knowledgebase-expansion` (PR #21) | **OPEN, do not merge** | DEVICE-02's lane; its own integration gate is unsatisfied and **D18** comes first |
| PR #18, #19 (C-02 sweep) | **MERGED** `b1ef49d`, `2556d1e` | Documentation accuracy |
| Overlap between the two live lanes | `CHANGELOG.md`, `.gitattributes` only | Mechanical; resolve under control document §10(G) |

## 6. How to extend this ledger

Add a row when a phase item changes state, and put the command or commit that
proves it in the evidence column. If a row cannot be given evidence, it does not
belong here — it belongs in `docs/DECISION_REGISTER.md` as an open question.
