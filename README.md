# H.A.A. Nexus

Healthcare training, simulation, assessment, and competency platform. See
`docs/HAA_Nexus_Architecture_Package.md` for the full technical architecture, `docs/BUSINESS_MODEL_PRODUCT_SPEC.md` for the commercialization/subscription strategy, `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md` for the audit that gates commercialization, and
`CHANGELOG.md` for exactly which phases are incorporated in this build (it's
cumulative — every checkpoint includes all prior phases, verified together,
never a separate patch). This README covers only how to run what exists so far.

**Proprietary software — see `LICENSE.md`.** This is not open source; every
`package.json` in this workspace is marked `"license": "UNLICENSED"`.

## Status: Phase 8.1 complete — Phase 8.2 not started

Phase 7 (the Pre-Commercialization Audit & Stabilization Gate) closed as PASS
WITH CONDITIONS; its evidence and disposition are recorded in
`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`. Phase 8.1 (Entitlement Domain
Model) is the only commercialization increment implemented so far.

| Component | Status |
|---|---|
| `packages/nexus-core` (entitlements, AI abstraction, module registry) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/scenario-engine`, `simulation-engine`, `evaluation-engine`, `persistence`, `competency-engine` | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/terminology-engine` (lay↔clinical dictionary schema + searchable repository) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/training-engine` (lesson schema + repository) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/recommendation-engine` (deterministic error-frequency rules) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/analytics-engine` (overall performance, trend, weak/strong areas, error trends, scenario progress) | **Implemented** — 14 unit tests; every figure computed from real `SessionRecord`/`CompetencyRecord` data, no separate analytics store |
| Real content: 2 scenarios, 4 terminology entries, 3 lessons | **Implemented** — all pass schema validation and cross-reference checks (recommendation-engine's lesson IDs are confirmed to actually exist in shipped content) |
| Rust backend (DB connection, session/profile/competency queries, Tauri commands) | **Implemented and compiled** — `cargo check --all-targets` clean and `cargo test` green (14 tests) on Rust 1.98.1. See "Rust/Tauri verification" below |
| Desktop: Knowledge Base (search), Training (lesson browser + knowledge checks), Analytics, Submission Summary (real scoring + recommendations) | **Implemented** — unit/integration tested, typechecked, production build verified |
| App icons (`src-tauri/icons/`) | **Implemented** — full icon set generated from a brand source image via `tauri icon` |
| Exact mid-transcript resume after interruption | **Not implemented (honestly scoped out — see CHANGELOG)** |
| Recommendation engine factoring in competency-record trends (not just error frequency) | **Not implemented (honestly scoped out — see CHANGELOG)** |
| Migration runner / `schema_version` tracking | **Not implemented** — accepted Phase 7 condition; required before Phase 8 adds any table (see audit doc) |
| Assessment (no-pause) mode | **Not started** — Phase 8.2+ |
| Entitlement domain model (tier ladder, capability matrix, pure resolver) | **Implemented (Phase 8.1)** — 45 unit tests. Pure domain logic only; nothing consumes it yet |
| Commercialization (subscription persistence, billing, payments, UI gating, web deployment, auth) | **Not started** — Phase 8.2 onward |

### Rust/Tauri verification

Earlier phases were built in a sandbox whose only Rust was Ubuntu's apt
package (1.75.0), well below Tauri v2's MSRV, so the Rust half of the desktop
shell had never been compiled. **That gap is now closed.** As of the Phase 7
gate, on Windows 11 with MSVC build tools present:

```
rustup 1.29.1
rustc 1.98.1 (48a229cea 2026-09-01)
cargo 1.98.1 (797e8a9bc 2026-08-05)
```

- `cargo check --all-targets` — **clean**, no errors, no warnings.
- `cargo test` — **14 passed, 0 failed.** Real-file SQLite (not `:memory:`),
  covering migration/table integrity, WAL + foreign-key pragmas, restart
  idempotency, autosave of an in-progress draft with no evaluation yet,
  autosave survival across a restart, autosave-then-submit attaching the
  evaluation to the same attempt, interrupted-session detection, scenario
  version traceability, profile round-trip, and competency upsert.

**Still unverified:** `pnpm tauri dev` (launching the actual webview) and
`tauri build` (MSI/NSIS bundling) have not been run. Installer packaging is
Phase 9 (Tauri packaging/release hardening), not Phase 7.

## Repo layout

```
apps/desktop        # Tauri app: React frontend (src/) + Rust backend (src-tauri/)
packages/nexus-core  # Pure TypeScript engine services, no UI, no Tauri
packages/ui-kit      # Shared, module-agnostic React components + design tokens
docs/                # Architecture package, business model spec, Phase 7 audit
```

## Running what's verified today

This repo pins its package manager via `packageManager` in the root
`package.json`; run `corepack enable` once if `pnpm` is not already on PATH.

```bash
pnpm install

# Every package's tests (231 nexus-core + 25 desktop = 256).
# nexus-core covers scenario/terminology/lesson schema validation, content
# hashing, versioning, the in-memory repositories, session state machine,
# the full evaluation engine, the competency engine, the analytics engine, the entitlement resolver,
# the recommendation engine's deterministic rules, and content-QA passes
# over every file under /content. Desktop covers duration formatting, real
# checks that all bundled content loads/validates/evaluates correctly at
# runtime, the full submit -> persist -> competency-update flow, and
# end-to-end recommendation and analytics flows against real submitted
# sessions.
pnpm test

# Typecheck every package
pnpm typecheck

# Production build
pnpm build

# Rust backend (requires a rustup-managed toolchain)
cd apps/desktop/src-tauri && cargo test

# frontend dev server (browser only — this is not the desktop shell,
# just confirms the React app itself)
pnpm dev:desktop
```

`pnpm test`, `pnpm typecheck`, and `pnpm build` all run recursively across
every workspace package (`pnpm -r`), so a newly added package cannot be
silently omitted from the aggregate command.

The Tauri desktop shell (`pnpm tauri dev`) compiles but has not been launched
end-to-end yet.

## Phase 7 outcome

Phase 7 was **not Analytics**. It was the **Pre-Commercialization Audit &
Stabilization Gate**, and it closed as **PASS WITH CONDITIONS**. Analytics was
audited within the gate and confirmed as an already-implemented capability
whose barrel export had been removed in error; it was restored, not rebuilt.

The accepted conditions carried into Phase 8 are listed in
`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`.

## Phase 8 progress

Phase 8 is commercialization, delivered as independently verifiable increments.

- **8.1 Entitlement Domain Model — complete.** A tier ladder, a capability
  matrix expressed as data, and a pure resolver, all inside `nexus-core` with
  no provider, persistence, or UI dependency. It is domain logic only:
  nothing in the app consumes it yet, so product behaviour is unchanged.
- **8.2 onward — not started.** Scenario-library gating, paywall/conversion
  states, Assessment mode, subscription persistence, PayMongo, web
  deployment and authentication all remain unimplemented.
