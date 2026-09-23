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
commit: 865d31e8c6883898e4dab272b71b9ddb3a0a5e9b
branch: main
timestamp: 2026-09-21T03:35:47Z
device: DEVICE-01
tests: "PASS - nexus-core 390/390 (44 files), desktop 228/228 (25 files), preflight 17/17"
build: "PASS - pnpm -r build (desktop dist 301.87 kB JS)"
typecheck: "PASS - pnpm -r typecheck (nexus-core, ui-kit, desktop)"
rust: "PASS - cargo test 55/55; rustc 1.98.1, cargo 1.98.1"
audit_status: "Phase 7 closed PASS WITH CONDITIONS; Phase 8.3 Assessment decisions D1-D7 resolved"
known_conditions: "D8, D9, D10, D12 open; feat/training-question-bank unmerged"
```

## History

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
