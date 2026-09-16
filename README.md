# H.A.A. Nexus

Healthcare training, simulation, assessment, and competency platform. See
`docs/HAA_Nexus_Architecture_Package.md` for the full technical architecture, `docs/BUSINESS_MODEL_PRODUCT_SPEC.md` for the commercialization/subscription strategy, and
`CHANGELOG.md` for exactly which phases are incorporated in this build (it's
cumulative — every checkpoint includes all prior phases, verified together,
never a separate patch). This README covers only how to run what exists so far.

**Proprietary software — see `LICENSE.md`.** This is not open source; every
`package.json` in this workspace is marked `"license": "UNLICENSED"`.

## Status: Phase 6 complete — Phase 7 is the Pre-Commercialization Audit & Stabilization Gate

| Component | Status |
|---|---|
| `packages/nexus-core` (entitlements, AI abstraction, module registry) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/scenario-engine`, `simulation-engine`, `evaluation-engine`, `persistence`, `competency-engine` | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/terminology-engine` (lay↔clinical dictionary schema + searchable repository) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/training-engine` (lesson schema + repository) | **Implemented** — unit tested, typechecked |
| `packages/nexus-core/recommendation-engine` (deterministic error-frequency rules) | **Implemented** — unit tested, typechecked |
| Real content: 2 scenarios, 4 terminology entries, 3 lessons | **Implemented** — all pass schema validation and cross-reference checks (recommendation-engine's lesson IDs are confirmed to actually exist in shipped content) |
| Rust backend (DB connection, session/profile/competency queries, Tauri commands) | **Written, passes `rustfmt` syntax validation. Compilation unverified in this sandbox** — same toolchain gap as Phase 1 |
| Desktop: Knowledge Base (search), Training (lesson browser + knowledge checks), Submission Summary (real scoring + recommendations) | **Implemented** — unit/integration tested, typechecked, production build verified |
| Exact mid-transcript resume after interruption | **Not implemented (honestly scoped out — see CHANGELOG)** |
| Recommendation engine factoring in competency-record trends (not just error frequency) | **Not implemented (honestly scoped out — see CHANGELOG)** |
| App icons (`src-tauri/icons/`) | **Not started** |
| Phase 7 Pre-Commercialization Audit & Stabilization Gate | **Next gate — not started** |

### Known environment gap: Rust toolchain

This was built in a sandbox with no internet access to `rustup`'s distribution
host, so the only available Rust is Ubuntu's apt package, `1.75.0` (Dec 2023).
Tauri's own MSRV policy is "current stable minus 3," which was already 1.83 in
April 2025 and is higher now. Several of Tauri v2's transitive dependencies
require Cargo's `edition2024` feature, which 1.75 does not support — `cargo
check` fails on that basis, not on anything wrong with this project's code.

As of Phase 5, the SQL schema itself has been verified independently by
executing it against real SQLite via Python (see `CHANGELOG.md`), which
covers correctness of the schema and query patterns even though the Rust
code that will actually run those queries hasn't compiled here yet.

**Before treating the desktop shell as done:** on a machine with `rustup`
installed (`rustup update stable`), run:

```bash
cd apps/desktop
pnpm install
pnpm tauri dev
```

If that fails for a reason other than the toolchain, that's a real bug to
fix — everything above it (frontend, IPC command shape, `tauri.conf.json`)
was written to spec but its Rust half is unverified until this runs.

## Repo layout

```
apps/desktop        # Tauri app: React frontend (src/) + Rust backend (src-tauri/)
packages/nexus-core  # Pure TypeScript engine services, no UI, no Tauri
packages/ui-kit      # Shared, module-agnostic React components + design tokens
docs/                # Architecture package
```

## Running what's verified today

```bash
pnpm install

# nexus-core unit tests (172 tests: scenario/terminology/lesson schema
# validation, content hashing, versioning, the in-memory repositories,
# session state machine, the full evaluation engine, the competency engine,
# the recommendation engine's deterministic rules, and content-QA passes
# over every file under /content)
pnpm --filter @haa-nexus/nexus-core test

# desktop app unit/integration tests (22 tests: duration formatting, real
# checks that all bundled content loads/validates/evaluates correctly at
# runtime, the full submit -> persist -> competency-update flow, and
# end-to-end recommendation-flow tests against real submitted sessions)
pnpm --filter @haa-nexus/desktop test

# typecheck everything
pnpm --filter @haa-nexus/nexus-core typecheck
pnpm --filter @haa-nexus/ui-kit typecheck
pnpm --filter @haa-nexus/desktop typecheck

# frontend dev server (browser only — this is not the desktop shell,
# just confirms the React app itself)
pnpm --filter @haa-nexus/desktop dev

# frontend production build
pnpm --filter @haa-nexus/desktop build
```

The Tauri desktop shell (`pnpm --filter @haa-nexus/desktop tauri dev`) requires
the real Rust toolchain described above and has not been run end-to-end yet.


## Phase 7 definition

Phase 7 is **not Analytics**. It is the **Pre-Commercialization Audit & Stabilization Gate**. Analytics readiness and any existing placeholder/data-path work are audited as part of this gate. Phase 8 begins commercialization implementation only after Phase 7 closes. See `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`.
