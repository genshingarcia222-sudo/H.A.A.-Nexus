# H.A.A. Nexus — Phase 9: Packaging & Release Hardening

**Purpose:** Current-state record for Phase 9. It establishes what packaging
behaviour is already verified, what remains, which items are blocked on an owner
decision or a credential, and which device can do the work. This document is the
durable home for the Phase 9 decision log.

**Status at entry:** specification authored on DEVICE-02 (2026-09-26). No Phase 9
implementation has been performed.

---

## 1. Why this document exists

Before this file, Phase 9 had no specification. It existed only as four scattered
sentences across other documents:

| Source | What it said |
|---|---|
| `README.md` | "Installer **signing**, auto-update and release hardening remain Phase 9." |
| `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md` §5 | `tauri dev` / `tauri build` "deferred to Phase 9 (Tauri packaging/release hardening)" |
| `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md` §5 | "`main.rs` lacks `#![cfg_attr(not(debug_assertions), windows_subsystem = \"windows\")]` … Phase 9 item." |
| `docs/HAA_Nexus_Architecture_Package.md` §21 | "`tauri-plugin-updater` is architected for but not wired to a release feed until Phase 9 … MVP ships without auto-update." |

Nothing in the repository defined Phase 9 entry criteria, scope, or exit criteria.
This document does, **derived only from repository evidence**. No requirement here
was invented; every item cites what it came from.

## 2. Two stale statements this document supersedes

The Phase 7 audit is a snapshot taken at the Phase 7 gate. Two of its Phase 9
deferrals were subsequently closed, and the audit text was not revised:

- **`tauri dev` and `tauri build` are no longer unverified.** `README.md` records
  that `tauri dev` launches the real webview with live IPC against SQLite, and
  that `tauri build` "completes end to end and produces both bundles: a 3.6 MB MSI
  and a 2.5 MB NSIS setup (the release exe is 9.8 MB)". Packaging therefore
  *works*; what Phase 9 owns is packaging that is **signed, updatable and
  release-disciplined**.
- **The CSP condition is closed.** Phase 7 recorded `"csp": null` as a condition
  that would be unacceptable once a web build and payment redirect existed.
  `apps/desktop/src-tauri/tauri.conf.json` now carries a real policy
  (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'none'`, `frame-ancestors 'none'`, with a separate `devCsp` for
  Vite/HMR). `style-src` retains `'unsafe-inline'` because the UI styles elements
  through React `style` props — a known, documented residue, not a Phase 9 item.

Correcting the audit prose is **not** done here; the audit is a historical gate
record and stays as written. This section is the pointer.

## 3. Verified baseline this phase starts from

Recorded baseline **B-002** at `1d7b209307e7f2a2490cd113116e65052aada980`
(`.nexus/BASELINE.md`), re-verified independently on DEVICE-02 at `7e304a1`:
nexus-core 390/390, desktop 228/228, preflight 17/17, nexus-sync 60/60, typecheck
clean, build clean.

**Not re-verified on DEVICE-02:** the Rust suite (recorded `55/55`, rustc 1.98.1,
on DEVICE-01). DEVICE-02 is a Linux container; `cargo test` fails there at
`gdk-sys` — *"The system library `gdk-3.0` required by crate `gdk-sys` was not
found"* — and its toolchain is rustc 1.94.1. See §6.

## 4. Phase 9 scope

Five items, each with the evidence that establishes it.

### P9-A — Release builds show a console window on Windows

`apps/desktop/src-tauri/src/main.rs` does not carry
`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`. Verified
absent on `main` at `7e304a1`. A Windows release build therefore opens a console
window behind the app.

**Do not fix this on `main` yet.** The unmerged branch
`origin/feat/training-question-bank` has tip commit `de2c2d1`
*"fix(desktop): release builds are windowed, not console"*, which by its subject
addresses exactly this. Implementing it independently on `main` would create a
conflicting change in `main.rs` when that branch is merged, and merging it is an
**escalated owner decision** (`.nexus/CURRENT_STATE.md` "Pending work"; decision
N-007). Resolve **D15** first.

**Effort if reimplemented:** one attribute line. **Verification:** a Windows
release build showing no console window — DEVICE-01 only.

### P9-B — Installer signing is absent

`tauri.conf.json` `bundle` declares `active`, `targets: ["msi","nsis"]` and
`icon`, and **no signing configuration** — no `windows.certificateThumbprint`,
no `digestAlgorithm`, no `timestampUrl`. Unsigned MSI/NSIS installers trigger
SmartScreen warnings on end-user machines.

**Blocked on a credential, not on code.** A code-signing identity must exist
before configuration is meaningful. Resolve **D13**.

### P9-C — Auto-update is not wired

Two independent confirmations that the updater is absent, not merely
unconfigured:

- `apps/desktop/src-tauri/Cargo.toml` `[dependencies]` lists `tauri`, `serde`,
  `serde_json`, `rusqlite` — **no `tauri-plugin-updater`**.
- `tauri.conf.json` has **no `plugins.updater` block** and no
  `bundle.createUpdaterArtifacts`.

Architecture Package §21 states the plugin is "architected for but not wired to a
release feed". Wiring it requires an update-feed endpoint and an update-signing
keypair (Tauri's updater verifies a detached signature, which is a *separate*
key from the installer code-signing certificate in P9-B). Resolve **D14**.

### P9-D — No release discipline

`tauri.conf.json` `version` is `0.1.0`; root `package.json` `version` is `0.1.0`.
Nothing in the repository enforces that they agree, and there is no recorded
release process: no tagging convention, no channel policy (stable/beta), no
release checklist, no changelog-to-release mapping. `CHANGELOG.md` is a
development log, not a release log.

**Resolve D16.** This is the item with no external dependency — it is
authorable on either device once the owner sets the policy.

### P9-E — Bundle metadata is minimal

`bundle` carries no `publisher`, `copyright`, `licenseFile`, `shortDescription`
or `longDescription`. `LICENSE.md` exists at the repository root and says
`UNLICENSED` (as does `package.json`). Installer metadata and the license shown
by the MSI are end-user-visible surfaces of a commercial product, and both are
currently empty or contradictory with a paid offering.

Depends on **D13** (publisher identity is usually the signing identity) and on
the commercial licensing decision, which no repository document records.

## 5. Open decisions

Recorded here in the register's shape. **None of these is resolved.** Per the
Phase 8.3 precedent, current behaviour and "obvious" defaults are *not*
authorization.

| ID | Question | Blocks | Why it needs the owner |
|---|---|---|---|
| **D13** | What code-signing identity signs the installers — an OV/EV certificate, Azure Trusted Signing, or a self-signed certificate for an internal pilot only? | P9-B, P9-E | Costs money, requires legal identity, and determines whether public distribution is possible at all |
| **D14** | Where does the update feed live — GitHub Releases, or first-party hosting? | P9-C | Intersects Phase 10 cloud architecture and **D10** (web persistence). Choosing first-party hosting pre-commits Phase 10 infrastructure |
| **D15** | Is `origin/feat/training-question-bank` merged, or is its `windows_subsystem` fix reimplemented on `main`? | P9-A | The branch also carries the Training question run (M23), Pilot 001 r3 and open decision **D12**. Merging was already escalated and is undecided |
| **D16** | What is the release/version policy — tagging scheme, channels, and who cuts a release? | P9-D | No repository document establishes it |

**D14 has a dependency worth stating plainly:** it is entangled with **D10**,
which is itself open and already blocks commercialization roadmap steps 4 and 5.
Phase 9 cannot fully close before D10 is decided.

## 6. Device capability constraint

Phase 9 is Windows packaging work. This materially restricts which device can
perform it.

| Work | DEVICE-01 (Windows) | DEVICE-02 (Linux container) |
|---|---|---|
| Edit configuration / docs | yes | yes |
| `cargo test` | yes — recorded 55/55, rustc 1.98.1 | **no** — fails at `gdk-sys`, missing `gdk-3.0` |
| `tauri build` (MSI/NSIS) | yes — verified, 3.6 MB / 2.5 MB | **no** — WiX/NSIS are Windows-only |
| Verify no console window (P9-A) | yes | no |
| Verify a signed installer (P9-B) | yes | no |
| Verify an update round-trip (P9-C) | yes | no |

**Consequence:** every Phase 9 item whose acceptance criterion is a built or
installed Windows artifact must be implemented and verified on **DEVICE-01**.
DEVICE-02 can author specification, configuration and release documentation, and
can audit DEVICE-01's results from the repository — its stated role in
`.nexus/DEVICE_REGISTRY.md`.

Installing GTK into the DEVICE-02 container would let `cargo test` run, but it
would still not produce or validate a Windows bundle. It is not proposed here.

## 7. Exit criteria

Phase 9 closes when all hold:

1. **P9-A** resolved — a Windows release build opens no console window, verified
   on DEVICE-01, by whichever route **D15** selects.
2. **P9-B** resolved — MSI and NSIS are signed with the identity **D13**
   names, and a signed installer has been run on a clean Windows machine without
   a SmartScreen block attributable to signing.
3. **P9-C** resolved — `tauri-plugin-updater` is a declared dependency, its
   `plugins.updater` block points at the feed **D14** names, updater artifacts
   are produced, and one version-to-version update has been completed
   end-to-end against a real feed.
4. **P9-D** resolved — a written release process exists, `tauri.conf.json` and
   `package.json` versions are reconciled, and the policy **D16** sets is
   recorded.
5. **P9-E** resolved — bundle metadata and the installer-visible license are
   populated and consistent with the commercial licensing decision.
6. The baseline is re-verified on DEVICE-01 at the closing commit, appended to
   `.nexus/BASELINE.md`, and no test count has regressed from B-002.
7. `CHANGELOG.md` records what was verified and what was not, per
   `.nexus/SYNC_PROTOCOL.md`.

## 8. What Phase 9 must not do

- **Not close Phase 8.** Commercialization roadmap steps 3–8 are unstarted and
  **D8, D9, D10** are open. Phase 9 is packaging; it does not advance
  entitlements, assessment, web deployment or PayMongo.
- **Not begin Phase 10.** Cloud/API architecture is Phase 10 (Architecture
  Package §22). D14 *touches* it and must not be used as a route into
  implementing it.
- **Not import payment, AI-vendor or TTS SDKs** into clinical-training engines
  (`CLAUDE.md`).
- **Not place secrets in source control, browser code or desktop bundles**
  (`CLAUDE.md`). Signing certificates, updater private keys and feed credentials
  are exactly this class. `.gitignore` already covers `.env*`, `*.pem`, `*.key`
  and `secrets.json`; a signing key must never be committed, and the signing
  identity belongs in CI secrets or the OS certificate store.
- **Not weaken or skip existing tests** (`CLAUDE.md`).

## 9. Recommended first increment

Once the owner resolves the decisions in §5, the cheapest ordering is:

1. **D15**, because it determines whether P9-A is a merge or a code change,
   and the branch decision has been outstanding since 2026-09-21.
2. **D16** and **P9-D**, which need no credential and no external service.
3. **D13**, then P9-B and P9-E, which share the signing identity.
4. **D14**, then P9-C — last, because it is the item entangled with D10.

Nothing in this ordering may start before its decision is recorded in
`docs/DECISION_REGISTER.md`.
