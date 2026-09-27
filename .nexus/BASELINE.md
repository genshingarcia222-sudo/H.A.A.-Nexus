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
commit: 7dcad6b264d2f16ae0e9f49f0fa842ac26033293
branch: main
timestamp: 2026-09-27T09:20:00Z
device: DEVICE-01
tests: "PASS - nexus-core 784/784, desktop 296/296, preflight 25/25, nexus-sync 81/81"
build: "PASS - pnpm -r build"
typecheck: "PASS - pnpm -r typecheck (nexus-core, ui-kit, desktop)"
rust: "PASS - cargo test 70/70; rustc 1.98.1, cargo 1.98.1"
audit_status: "Phase 7 closed PASS WITH CONDITIONS (packaging and CSP cleared); Phase 8.3 decisions D1-D7 resolved; D15 resolved as a merge and executed; P9-A satisfied; closed-book boundary hardened and exercised live"
known_conditions: "D8, D9, D10, D13, D14, D16, D17, D18 open; A2, A6, A7, A9, A12 open; Phase 9 P9-B/C/E and P9-D policy blocked; Phase 8 not closed; tauri build not re-run since the D15 merge; no CI exists; feat/knowledgebase-expansion (PR #21) deliberately unmerged pending D18"
```

## History

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
