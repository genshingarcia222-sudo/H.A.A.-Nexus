# Baseline

The latest verified repository state is in the block below. Every baseline
ever recorded here is kept in **History**, newest first. Entries are appended
and never overwritten.

A baseline counts as verified only when the commands were actually run against
that exact commit on a named device. A figure copied from somewhere else is not
a baseline.

Earlier checkpoints, from before this file existed, are recorded in
`CHANGELOG.md`, each with its own verification paragraph. For example,
`docs/DECISION_REGISTER.md` records 478 tests green at `aeb56d6`. They are
preserved there, not copied here.

```yaml nexus-state
commit: e7c8708c5df851c38bb28458681a4e776b35fb8c
branch: main
timestamp: 2026-10-14T08:35:00Z
device: DEVICE-01
tests: "PASS - nexus-core 824/824, desktop 337/337, preflight 30/30, nexus-sync 81/81, release tool 25/25"
build: "PASS - pnpm -r build"
typecheck: "PASS - pnpm -r typecheck (nexus-core, ui-kit, desktop)"
rust: "PASS - cargo test 70/70, cargo fmt --check clean, cargo clippy 0 warnings; rustc 1.98.1"
audit_status: "Phase 7 closed; Phase 8.3 decision group COMPLETE; D15 executed; D16/D8/D9/D18/A9/A2 resolved and A6 superseded, all under the owner STANDING AUTHORIZATION; preflight reports 10 resolved, 1 superseded, 6 blocked. P9-A SATISFIED and now CONFIRMED IN THE SHIPPING BINARY (PE Subsystem 2, x64, PE32+) and P9-D SATISFIED. An unsigned internal RELEASE CANDIDATE 0.1.0 (Status A) exists at this commit - both MSI and NSIS built, NSIS smoke-tested install-to-uninstall on DEVICE-01; manifest in docs/RELEASE_CANDIDATE_0.1.0.md. It is NOT a release: unsigned, no tag, clean-machine NOT verified, MSI NOT installed. D18 names contract B canonical - the 432 KB records are NOT migrated and PR #21 is NOT merged"
known_conditions: "D10, D13, D14, D17, A7, A12 open (A2 and A9 closed 2026-10-04; D17 CHARACTERIZED and awaiting the OWNER); Phase 9 P9-B/C/E blocked on D13 and D14; Phase 8 not closed - roadmap steps 3-8 unstarted and D10 blocks step 4; ICD-10-CM ingestion specified in docs/KNOWLEDGE_ARCHITECTURE.md section 5 and NOT BUILT (CMS reachable, nothing retrieved); 432 KB records not migrated to contract B; Pilot Batch 001 0 of 12 human-verified; RC 0.1.0 built 2026-10-14 but UNSIGNED, NO TAG, clean-machine install NOT VERIFIED and the MSI NOT INSTALLED (per-machine, needs elevation); tauri build rewrites Cargo.toml line endings and leaves a dirty tree; a device-activity detection defect is recorded in DEVICE_REGISTRY"
```

## History

### B-010 — D17 resolved; the closed-book window survives a restart — 2026-10-14 — DEVICE-01

| Check | Command | Result |
|---|---|---|
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **824/824** (68 files), desktop **337/337** (33 files) |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; **11 resolved, 1 superseded, 5 blocked** (D10, A7, A12, D13, D14) |
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Rust | unchanged by this work | **70/70** at B-009 |

**Movement from B-009.** nexus-core **807 → 824** (+17 domain tests for D17),
desktop **330 → 337** (the characterization block went from 1 test recording the
open window to 8 pinning the closed one). D17 moved from blocked to resolved, so
**blocked decisions 6 → 5**.

**No test was weakened or deleted.** The one replaced expectation had started
passing **vacuously** once the gate became asynchronous — it reported "not
blocked" while the book was in fact shut — and its own comment instructed that it
be changed when the decision came. The replacements are **mutation-verified**:
disabling the rule fails 5 of them.

**What this baseline does NOT establish.** D17 is enforced on the **desktop
only** and is **inert on the web until D10**, because the web target uses
in-memory repositories and a refresh destroys the record. The nav rail still
shows both reference links after a restart; the route gate is the protection.
No Rust, bundler or installer work is involved, so the RC evidence in B-009
stands unchanged.

### B-009 — Windows release candidate 0.1.0 built and smoke-tested — `e7c8708` — 2026-10-14 — DEVICE-01

The tree at `e7c8708c5df851c38bb28458681a4e776b35fb8c`, on `main`, working tree clean at build start, verified in
full on DEVICE-01 against the release gates in `docs/RELEASE_POLICY.md` §7. Every
exit status was captured independently rather than through a pipe.

| Check | Command | Result |
|---|---|---|
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **807/807** (67 files), desktop **330/330** (33 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **30/30** |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; **10 resolved, 1 superseded, 6 blocked** (D10, A7, A12, D13, D14, D17) |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Release tool | `node tools/release/version.test.mjs` | **25/25** |
| Version parity | `node tools/release/version.mjs check` | exit 0, six declarations agree |
| Typecheck / build | `pnpm -r typecheck`, `pnpm -r build` | exit 0 |
| Rust | `cargo test --offline`, `fmt --check`, `clippy -- -D warnings` | **70/70**, clean, 0 warnings |
| **Windows bundle** | `pnpm --filter @haa-nexus/desktop exec tauri build` | **MSI and NSIS both produced**; see `docs/RELEASE_CANDIDATE_0.1.0.md` |

**Movement from B-008.** nexus-core **804 → 807** (+3 tests, one new file);
every other count unchanged. The substantive movement is not a test count: **an
unsigned internal release candidate now exists**, and P9-A is confirmed in the
binary that would actually ship (PE Subsystem **2**, Machine `0x8664`, PE32+).
B-008 recorded "tauri build not re-run since the D15 merge" — that condition is
now discharged.

**Artifact hashes** (artifacts are not in source control):

| Artifact | Bytes | SHA-256 |
|---|---|---|
| `…_x64_en-US.msi` | 3,842,048 | `323df12362a3b213b79b5fc61c1319ed69aee03bfb31d7bbb2f4e1420333ea1b` |
| `…_x64-setup.exe` | 2,708,547 | `b10281b1e60747249af10449285e0e57a6b2b3146ae2583af57615cbb5e8c5b8` |

**What this baseline does NOT establish.** The candidate is **unsigned** (all
three files `NotSigned`, confirmed also by an empty PE certificate table), there
is **no tag**, **clean-machine verification was not performed** (this is the
build machine), and **the MSI was never installed** — it is per-machine and
returned 1603 unelevated, before copying any file. P9-B and P9-E remain blocked
on **D13**, P9-C on **D14** → **D10**.

### B-008 — D18 resolved; A9 and A6 closed — `ff3a12d` — 2026-10-04 — DEVICE-01

The tree at `ff3a12d7b795956025c2882cb2a66b8dc681ce65`, on `main`, verified on DEVICE-01.

| Check | Command | Result |
|---|---|---|
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **804/804** (66 files), desktop **330/330** (33 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **30/30** (was 27) |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; 18 decisions, **9 resolved, 1 superseded, 7 blocked** |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Release tool | `node tools/release/version.test.mjs` | **25/25** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --offline` | **70/70** |
| Rust format | `cargo fmt --check` | clean |
| Rust lint | `cargo clippy --offline --all-targets` | **0 warnings, 0 errors** |

**Movement from B-007.** Application test counts are unchanged at 804 and 330:
D18 was a decision and a document, and A9/A6 removed dead code rather than adding
behaviour. Preflight 27 → **30**: two tests for the new `superseded` status and
one asserting the removed `scenarioSchemaVersion` field stays removed. The
register gained a third outcome, so its counts now read 9 / 1 / 7 rather than a
two-way split.

**What this baseline does not cover.** `tauri build` has still not been re-run
since the D15 merge, so no installer exists at this commit. The 432 KB records
are **not** migrated to the canonical contract and PR #21 is **not** merged.
No ICD-10-CM file has been retrieved.

### B-007 — control plane reconciled to the repository; clippy clean — `f48a1fc` — 2026-10-02 — DEVICE-01

The tree at `f48a1fc1cdd9dfae69e0a988603ac3436a7ca2ec`, on `main`, working tree
clean, verified in full on DEVICE-01 against the release gates in
`docs/RELEASE_POLICY.md` §7.

| Check | Command | Result |
|---|---|---|
| Version | `node tools/release/version.mjs check` | six declarations at `0.1.0`, format releasable |
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **804/804** (66 files), desktop **330/330** (33 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **27/27** |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; 18 decisions recorded, **10 blocked**, 7 resolved |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Release tool | `node tools/release/version.test.mjs` | **25/25** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --offline` | **70/70**, rustc 1.98.1 |
| Rust format | `cargo fmt --check` | clean |
| Rust lint | `cargo clippy --offline --all-targets` | **zero warnings** — new at this baseline; B-006 carried one |

**No test count moved from B-006.** That is the point of this baseline: the work
it records was a documentation reconciliation plus a one-item lint fix, and a
changed count would have meant something unintended happened.

**What changed since B-006.** `docs/PHASES_BUILDING_CONTROL.md` §§2–8,
`docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` §§4–9, both phase-build handoffs
and `.nexus/CURRENT_STATE.md`'s prose were reconciled against measured
repository state at control version `P9-2026-10-02-001`; they had still been
asserting that D8, D9, D15 and D16 were open and that PR #3 was unmerged. One
code change: `apps/desktop/src-tauri/src/db/delivery.rs`'s module documentation
was converted from a misattached `///` block to `//!` module docs, which is what
took clippy to zero.

**Not verified at this baseline, and not claimed:** no `tauri build` and no
installer inspection were performed, so P9-A's clean-machine criterion and every
P9-B/P9-E artifact figure still stand on B-005's measurements. CI reproduces the
cross-platform gates but builds no installers.

### B-006 — D8 and D9 closed; Phase 8.3's decision group complete — `0c09e36` — 2026-10-01 — DEVICE-01

The tree at `0c09e361ddaa46b0634859a220e049a9c5096758`, on `main`, verified in full on DEVICE-01 against the release
gates in `docs/RELEASE_POLICY.md` §7.

| Check | Command | Result |
|---|---|---|
| Version | `node tools/release/version.mjs check` | six declarations at `0.1.0`, format releasable |
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **804/804** (66 files), desktop **330/330** (33 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **27/27** |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; 18 decisions recorded, **10 blocked**, 7 resolved |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Release tool | `node tools/release/version.test.mjs` | **25/25** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --offline` | **70/70**, rustc 1.98.1 |
| Rust format | `cargo fmt --check` | clean |

**Independently reproduced off this device.** CI run 36793771261 (at `df5dae9`,
three commits later) passed every one of these gates on hosted Ubuntu and Windows
runners with identical counts — 804, 330, 27, 25, 81, and `cargo test` 70/70
under the same rustc 1.98.1. It is the first time any baseline figure has been
confirmed on a machine that is not DEVICE-01.

**Movement from B-005.** nexus-core 796 → **804** (D9's session transitions);
desktop 317 → **330** (D9's store and notice). Earlier in the same day B-005 →
this baseline covers D8 as well: nexus-core 784 → 804, desktop 305 → 330.
Nothing regressed, and no test was deleted, weakened or skipped.

**Three decisions closed under the owner's standing authorization** in this
session — **D16**, **D8**, **D9** — each labelled as such in the register, the
ledger and the changelog, and each overruled by an owner decision. **Phase 8.3's
decision group is complete**: D1 and D3–D9 are resolved.

**Measured on this device only.** The Rust and build figures are Windows
workstation measurements; DEVICE-02's Linux container cannot reproduce them.

**What this baseline does not cover.** `tauri build` has still not been re-run
since the D15 merge, so no installer exists at this commit. P9-B, P9-C and P9-E
remain blocked on D13 and D14. No release tag exists, and the release policy
refuses a stable one at `0.1.0`.

### B-005 — D16 closed; release gates run end to end — `fba3544` — 2026-10-01 — DEVICE-01

The tree at `fba35448eee7c2a777c465b8a78483cc3ce77335`, on `main`, verified in full on DEVICE-01. It is the first
baseline taken by running the release gates in `docs/RELEASE_POLICY.md` §7 in
order, which is what those gates are for.

| Check | Command | Result |
|---|---|---|
| Version | `node tools/release/version.mjs check` | all six declarations `0.1.0`, format releasable |
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **784/784** (64 files), desktop **305/305** (31 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **27/27** |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; 16 decisions recorded, **10 blocked**, 5 resolved |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Release tool | `node tools/release/version.test.mjs` | **25/25** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean; `dist/assets/index-*.js` 341.60 kB |
| Rust | `cargo test --offline` in `apps/desktop/src-tauri` | **70/70**, rustc 1.98.1 |
| Rust format | `cargo fmt --check` | clean — **it was not**, see below |
| Release binary | `cargo build --release --offline` | 10,278,912 bytes, reproduced on a second run |

**Movement from B-004.** desktop 296 → **305**: six tests for the version read and
three for the Settings surface that shows it. preflight 25 → **27**: the release
policy's format rule, in both directions. The new release-tool suite is **25**.
Nothing regressed, and no test was deleted, weakened or skipped.

**`cargo fmt --check` was failing when this cycle started.** Three files in the
delivery layer that arrived with the D15 merge, one last touched by `24f5cc0`
"update" — a commit made outside a session. Fixed mechanically at `33b7398` with
the Rust suite at 70/70 before and after. The register's header still describes
`cargo fmt --check` as clean at `aeb56d6`; that was true then and stopped being
true at the merge.

**Measured on this device only.** `cargo test`, `cargo build --release`,
`cargo fmt` and `pnpm -r build` are Windows-workstation measurements. DEVICE-02's
Linux container cannot reproduce them, so for that device they remain
`NOT VERIFIED ON DEVICE-02`.

**What this baseline does not cover.** `tauri build` has still not been re-run
since the D15 merge — the last bundled artifacts are from `894a425`. The
unbundled release binary *was* rebuilt and measured here, four times, but no
installer has been produced or run on a clean machine at this commit. P9-B, P9-C
and P9-E remain blocked on D13 and D14.

### B-004 — D15 merged; Assessment integrity hardened — `7dcad6b` — 2026-09-27 — DEVICE-01

The tree at `7dcad6b264d2f16ae0e9f49f0fa842ac26033293`, on `main`, verified in full on DEVICE-01. It is the first
baseline after the **D15** merge, so it is the first to include the Training
question run, the D12 corpus module and the delivery layer on `main`.

| Check | Command | Result |
|---|---|---|
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **784/784** (64 files), desktop **296/296** (29 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **25/25** |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; 16 decisions recorded, **11 blocked**, 4 resolved |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --offline` in `apps/desktop/src-tauri` | **70/70**, rustc 1.98.1, cargo 1.98.1 |

**Why the counts jumped from B-003.** nexus-core 390 → 784 and desktop 228 → 296:
394 of those arrived with the D15 merge, which brings its own tests, and the Rust
suite went 55 → 70 for the same reason. The remaining 14 desktop tests are new
here: nine hardening the closed-book boundary and five covering the catch-all
route. **No count regressed**, and no test was deleted, weakened or skipped.

**Measured on this device only.** `cargo test`, `pnpm -r build` and the toolchain
versions are Windows-workstation measurements; DEVICE-02's Linux container cannot
reproduce them (`gdk-sys` fails, WiX/NSIS will not run), so for that device they
remain `NOT VERIFIED ON DEVICE-02`.

**What this baseline does not cover.** `tauri build` was **not** re-run: the last
recorded run was at `894a425` (9.78 MB exe, 3.61 MB MSI, 2.54 MB NSIS). Nothing
since touches the bundler configuration, but the artifact has not been rebuilt and
measured, and no installer has been run on a clean machine. Phase 9 items P9-B,
P9-C, P9-E and P9-D's policy half remain gated on D13, D14 and D16.

### B-003 — C-02 integrated; session registry in place — `796c5e0` — 2026-09-26 — DEVICE-01

The tree at `796c5e0ac698319df704b4ba47feb53a7d1f90e0`, on `main`, verified in full on DEVICE-01. It is the first
baseline that includes `.nexus/SESSION_REGISTRY.md` and the `nexus-sync session`
commands, and the first after the lane C-02 documentation sweep (PR #18
`b1ef49d`, PR #19 `2556d1e`).

| Check | Command | Result |
|---|---|---|
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **390/390** (44 files), desktop **228/228** (25 files) |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **25/25** |
| Preflight run | `node tools/preflight/preflight.mjs` | exit 0; 13 decisions recorded, **10 blocked** |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **81/81** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --offline` in `apps/desktop/src-tauri` | **55/55**, rustc 1.98.1, cargo 1.98.1 |

**No count regressed from B-002.** The application suites are identical (390 +
228): everything since B-002 has been tooling, governance and documentation. The
two tool suites grew - preflight 17 → 25 with the P9-D version-parity checks, and
nexus-sync 60 → 81 with the session-registry tests, including the A-G
bidirectional-discovery scenarios.

**Measured on this device only.** `cargo test`, `pnpm -r build` and the Rust
toolchain versions are Windows-workstation measurements. DEVICE-02 cannot produce
them - its Linux container fails at `gdk-sys` (`gdk-3.0` absent) and cannot run
the WiX/NSIS bundlers - so for that device they remain `NOT VERIFIED ON
DEVICE-02`.

**What is not covered.** `tauri build` was not re-run for this baseline; the last
recorded run produced a 9.78 MB executable, a 3.61 MB MSI and a 2.54 MB NSIS
setup at `894a425`, and nothing since has touched Rust, `tauri.conf.json` or the
bundler configuration. No installer was run on a clean machine, and no Phase 9
item was implemented: all five remain gated on open owner decisions.

### B-002 — sync protocol established — `1d7b209` — 2026-09-23 — DEVICE-01

The tree at `1d7b209307e7f2a2490cd113116e65052aada980`, on branch
`nexus/sync-bootstrap` tracking `origin/main` (N-002), verified in full on
DEVICE-01. This is the first baseline that includes `.nexus/` and
`tools/nexus-sync/`.

| Check | Command | Result |
|---|---|---|
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **390/390**, desktop **228/228** |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **17/17** |
| Sync tool | `node tools/nexus-sync/nexus-sync.test.mjs` | **60/60** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | **55/55**, rustc 1.98.1 |

**Mutation verification:** eleven mutations of `nexus-sync.mjs`, all killed, no
survivor, run against a scratch copy from this tree. One mutation initially
reported NOT APPLIED (its target had moved) and one failed to match CRLF line
endings; both were corrected and re-run until they killed.

**Unchanged from B-001.** The application counts are identical to the
pre-bootstrap baseline `865d31e`: this work added tooling and documentation and
changed no application behaviour.

**What is not covered.** The `.nexus/` state commits that follow this one
(`release`, the `finalize` sync record) touch only `.nexus/` state files. The
sync tool's own suite validates those files and was re-run after them; the
application suites were not, because no application file changes.

### B-001 — pre-bootstrap baseline — `865d31e` — 2026-09-21 — DEVICE-01

The state of `main` immediately before the distributed-workstation sync system
was added. It was recorded so that the bootstrap itself can be audited.

| Check | Command | Result |
|---|---|---|
| Git | `git status`, `git rev-list --left-right --count main...origin/main` | clean; `0 0` after `git fetch origin` |
| Tests | `npx --yes pnpm@9 -r test` | nexus-core **390/390**, desktop **228/228** |
| Preflight tool | `node tools/preflight/preflight.test.mjs` | **17/17** |
| Typecheck | `npx --yes pnpm@9 -r typecheck` | clean |
| Build | `npx --yes pnpm@9 -r build` | clean |
| Rust | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | **55/55**, rustc 1.98.1 |

Notes: `desktop` emits expected stderr from `saveFailureRecovery.test.tsx`
(simulated write failure), and the test passes.
