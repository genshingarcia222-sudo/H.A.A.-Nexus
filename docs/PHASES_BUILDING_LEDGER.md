# PHASES BUILDING Ledger

The evidence behind every phase claim, in one place. `docs/PHASES_BUILDING_CONTROL.md`
says who does what; this says **what is true, and what proves it**.

One rule governs every row: a status is only as good as the command or commit in
its evidence column. "Verified" means it was run on a named device against a
named commit. Anything else says so.

**Control version:** `P9-2026-10-01-001` · **Ledger updated:** 2026-10-01 ·
**Canonical `main`:** see `.nexus/CURRENT_STATE.md`, which `nexus-sync` re-checks
against the remote on every read.

## 1. Phases

| Phase | Objective | Status | Evidence | Blocker |
|---|---|---|---|---|
| 7 | Pre-commercialization audit and stabilization gate | **CLOSED — PASS WITH CONDITIONS** | `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`; two of its conditions (packaging, `csp: null`) since cleared and marked in place | — |
| 8 | Commercialization implementation | **OPEN** | 8.1 entitlements and 8.3 Assessment complete (D1, D3–D7 resolved); **D8 and D9 resolved 2026-10-01** under standing authorization; roadmap steps 3–8 unstarted | **D10** |
| 9 | Packaging and release hardening | **OPEN, two items done** | `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`; P9-A satisfied at `c384ac5`; P9-D satisfied 2026-10-01 (`docs/RELEASE_POLICY.md`, enforcement half at `d3bca14`) | **D13, D14** |
| 10 | Cloud and API architecture | **NOT STARTED, by design** | Architecture Package §22 | D14 must not be used as a route into it |

## 2. Phase 9 items

| Item | Objective | Status | Evidence | Acceptance condition |
|---|---|---|---|---|
| **P9-A** | Release builds open no console window | **SATISFIED** | `main.rs:8` carries `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`; guard test in the 70-test Rust suite; arrived with D15 merge `c384ac5` | A Windows release build showing no console window — the attribute is the mechanism; a clean-machine run has not been repeated since the merge |
| **P9-B** | Installers are signed | **BLOCKED** | No `certificateThumbprint`, `digestAlgorithm`, `timestampUrl` or `signCommand` anywhere in `tauri.conf.json`; `Get-AuthenticodeSignature` reported `NotSigned` for all three artifacts | **D13** names an identity, then a signed installer runs on a clean machine without a signing-attributable SmartScreen block |
| **P9-C** | Auto-update is wired | **BLOCKED** | `Cargo.toml` has no `tauri-plugin-updater`; `tauri.conf.json` has no `plugins.updater` and no `createUpdaterArtifacts` (confirmed again 2026-09-27: `plugins: []`) | **D14** (needs **D10**), then one version-to-version update completed against a real feed |
| **P9-D** | Release discipline | **SATISFIED** | `docs/RELEASE_POLICY.md` (D16, 2026-10-01, standing authorization); parity enforced in `tools/preflight/preflight.mjs` and extended to reject an unshippable format; `tools/release/version.mjs` sets all six declarations atomically, **25/25** | A written policy, one authoritative source, and a tool that makes a bump a single command - all three present |
| **P9-E** | Bundle metadata | **BLOCKED** | `bundle` carries only `active`, `icon`, `targets`; no `publisher`, `copyright` or `licenseFile`; `LICENSE.md` holds a placeholder, not a legal entity | **D13** plus a recorded legal identity |

## 3. Open decisions

| ID | Question | Blocks | Owner action needed |
|---|---|---|---|
| **D10** | What persists a web learner's progress | Roadmap steps 4–5; **D14** | Choose the persistence model |
| **D13** | Code-signing identity | P9-B, P9-E | Purchase or designate a certificate |
| **D14** | Update-feed location | P9-C | Decide, after D10 |
| **D17** | May a learner study before retaking an interrupted Assessment? | The scope of the closed-book window | Decide whether the window extends past an attempt |
| **D18** | Which content contract does the runtime ingest | Every Knowledgebase consumer | Choose D12's Zod model or the KB JSON Schema |
| **A2, A6, A7, A9, A12** | Accepted Phase 7 debt | Various | See the register |

Resolved and implemented: **D1, D2, D3, D4, D5, D6, D7, D11, D12, D15**, and
**D16**, **D8** and **D9** - the first decisions closed under the owner's *standing* authorization
rather than by the owner personally. The record distinguishes the two
deliberately: see `docs/RELEASE_POLICY.md` and the D16 entry in the register.

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
| Release binary size, three profiles | `cargo build --release --offline` run three times on identical source, rustc 1.98.1; the default figure reproduced exactly on a fourth run |
| A failed evaluation is visible and retryable | The evaluator was deliberately broken in the dev server on 2026-10-01: the "Not scored" notice rendered, Submit was disabled, the draft stayed on screen; the file was restored and checksum-verified byte-identical |
| A continued attempt carries the draft and the clock | Walked in the browser preview 2026-10-01: an autosaved practice attempt, the Dashboard card, the carried draft, and a timer continuing from the carried time rather than restarting |
| The running version is reachable from the product | `get_app_version` had never been called from the frontend; Settings now reads it over IPC, 6 + 3 tests |

**2. Statically validated — read from configuration, not executed**

- No signing configuration of any kind (P9-B).
- No updater plugin or dependency; `plugins` is empty (P9-C).
- `bundle` has no `publisher`, `copyright` or `licenseFile` (P9-E).
- ~~No `[profile.release]`~~ — **now measured rather than assumed** (D16). A
  profile was added, measured and removed: defaults **10,278,912 bytes**,
  `strip = true` **10,277,888**, `strip = true` + `lto = "thin"` **10,433,024**.
  Thin LTO made the binary *larger*. Cargo's defaults ship, and the numbers are
  recorded in `Cargo.toml` and `docs/RELEASE_POLICY.md` §9. This moves from
  "statically validated" to **verified on DEVICE-01**.
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

**4. Blocked** — P9-B (D13), P9-C (D14 → D10), P9-E (D13 plus a legal identity).
P9-D is no longer among them.

**5. CI now exists, and has never run.** `.github/workflows/ci.yml` was created
on 2026-10-01 under the master control prompt §30, which requires CI to be
established before release certification. It runs the release-policy §7 gates
with the same commands a device runs: version parity, `pnpm -r test`,
`-r typecheck`, `-r build`, preflight (tool and run), the release-version tool,
the nexus-sync suite, and a Windows job for `cargo fmt --check` and `cargo test`.

**Its status is `AWAITING ENVIRONMENT VALIDATION`, not verified.** Every command
in it passes on DEVICE-01, and the most likely runner-specific failure was
checked directly — the tool suites were re-run with `.nexus/local-device.yaml`
moved aside, which is the state a CI checkout is in, and preflight, its tests and
all 81 nexus-sync tests still passed. `pnpm install --frozen-lockfile` was
confirmed against the committed lockfile. But **no hosted runner has executed
it**, and the Windows job is the uncertain part: it compiles the Tauri crate,
which needs the WebView2 SDK. Read the first run before trusting a green badge.

Why it matters: before it, every check in this ledger was a hand-run command,
which is how a commit made outside a session — the GitHub Desktop commits under
"Known issues" in `.nexus/CURRENT_STATE.md` — could land on `main` untested. One
of them left `cargo fmt --check` failing on `main` from the D15 merge until
2026-10-01, and nothing noticed.

It consumes the owner's Actions minutes. Deleting the file is the whole of
turning it off.

## 5. Integration state

| Branch / PR | State | Note |
|---|---|---|
| `feat/training-question-bank` (PR #3) | **MERGED** `c384ac5` | D15, owner decision 2026-09-27 |
| `feat/knowledgebase-expansion` (PR #21) | **OPEN, do not merge** | DEVICE-02's lane; its own integration gate is unsatisfied and **D18** comes first |
| PR #18, #19 (C-02 sweep) | **MERGED** `b1ef49d`, `2556d1e` | Documentation accuracy |
| Overlap between the two live lanes | `CHANGELOG.md`, `.gitattributes`, and now `package.json` `scripts` | All mechanical. Both lanes append to the same `scripts` block after `nexus-sync:test` — `main` four `version:*`, PR #21 nine `kb:*`. Union resolution, §10(G) and §10(H) |
| Any release tag | **none exists** | `docs/RELEASE_POLICY.md` §6 refuses a stable release while P9-B and P9-E are blocked |

## 6. How to extend this ledger

Add a row when a phase item changes state, and put the command or commit that
proves it in the evidence column. If a row cannot be given evidence, it does not
belong here — it belongs in `docs/DECISION_REGISTER.md` as an open question.
