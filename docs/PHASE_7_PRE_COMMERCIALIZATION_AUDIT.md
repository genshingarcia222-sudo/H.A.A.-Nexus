# H.A.A. Nexus — Phase 7: Pre-Commercialization Audit & Stabilization Gate

**Status:** **CLOSED — PASS WITH CONDITIONS**
**Purpose:** Establish a clean, verified Phase 6 baseline before any commercialization, payment, web, cloud, AI, or voice implementation begins.

## Phase 7 is NOT a new feature phase

Phase 7 is a **gate**. It does not exist to add major product functionality. Its purpose is to audit the implementation that already exists, reconcile documentation with the real repository, expose technical debt, and verify that the architecture is safe to extend into revenue-bearing systems.

The repository contains an Analytics route placeholder, but no production analytics capability should be assumed. **Analytics is an audit/readiness concern inside Phase 7, not the definition of Phase 7.** Do not reopen the phase roadmap and label Phase 7 as "Analytics."

> **Audit note on that rule.** The audit found that analytics had in fact already been implemented (engine + 14 tests + a working route) during earlier work, and had then been *removed in error* while enforcing the rule above. Restoring it is not the same as building it. Phase 7 audited analytics; it did not implement analytics. The rule stands unchanged.

## Audit scope

### 1. Repository and architecture integrity
- Verify the actual monorepo structure against `docs/HAA_Nexus_Architecture_Package.md`.
- Confirm package boundaries and dependency direction.
- Identify accidental coupling between UI, Nexus Core, persistence, Tauri, and external-provider concerns.
- Check that commercialization dependencies can remain outside clinical-training engines.

### 2. Phase 1–6 implementation verification
- Trace every claimed Phase 1–6 capability to real source code and tests.
- Mark each item as verified, partially verified, stubbed, or unverified.
- Do not treat interfaces or placeholders as implemented functionality.

### 3. Test and determinism audit
- Run the full available test suite.
- Confirm deterministic evaluation repeatability.
- Confirm recommendation and competency behavior remain reproducible.
- Check for shared mutable state and test-order dependence.
- Check for regressions across package boundaries.

### 4. Persistence integrity
- Verify SQLite schema/migration integrity.
- Verify autosave behavior and interruption handling.
- Verify that completed attempts remain durable and traceable to the correct scenario version.
- Explicitly document the known exact-mid-transcript resume limitation unless it has actually been fixed.

### 5. Tauri/Rust verification boundary
- Attempt `rustup update stable`, `cargo check`, and/or `pnpm tauri dev` on a real supported machine.
- Record the actual Rust/Tauri result.
- Do not mark desktop compilation as verified based only on `rustfmt` or TypeScript tests.

### 6. Analytics readiness audit
- Inspect the current Analytics route and underlying data sources.
- Determine exactly which analytics calculations are implemented versus merely architected or placeholder UI.
- Confirm all future displayed metrics can trace to real persisted records.
- Do not present placeholder charts or fabricated metrics as learner results.
- Produce a clear post-audit disposition for analytics implementation; analytics itself is not the Phase 7 deliverable.

### 7. Security/privacy boundary audit
- Confirm no secrets are present in source control.
- Confirm no payment credentials, API keys, or provider secrets are expected in the frontend.
- Confirm built-in patient content remains synthetic.
- Confirm the application does not claim HIPAA compliance merely because it uses healthcare terminology.

### 8. Commercialization readiness audit
Review the existing Phase 1 entitlement engine and determine exactly what is reusable for:
- tier definitions;
- capability entitlements;
- scenario difficulty gating;
- subscription-state normalization;
- future PayMongo provider state.

Do not connect live payments during Phase 7. Phase 7 determines whether the existing architecture is ready for that work.

### 9. Documentation reconciliation
Reconcile:
- `README.md`
- `CLAUDE.md`
- `CHANGELOG.md`
- `docs/HAA_Nexus_Architecture_Package.md`
- `docs/BUSINESS_MODEL_PRODUCT_SPEC.md`
- source/test reality

Any contradiction between these documents must be resolved before Phase 7 closes.

---

# AUDIT EVIDENCE AND DISPOSITION

## Environment of record

| Tool | Version |
|---|---|
| OS | Windows 11 Pro for Workstations 10.0.26200 |
| Node | v24.21.0 |
| pnpm | 9.15.9 (now pinned via root `packageManager`) |
| rustup | 1.29.1 |
| rustc / cargo | 1.98.1 |
| MSVC build tools | VS 18 BuildTools, MSVC 14.51.36231 |

Entry state: branch `main`, working tree clean, HEAD `ec6dd82`.

## 1. Repository and architecture integrity — PASS

- Monorepo structure matches Architecture Package §7.
- **Dependency direction is clean.** `packages/nexus-core` has exactly one runtime dependency (`zod`) and imports nothing from `apps/`, `ui-kit`, `@tauri-apps/*`, or any vendor SDK. It will run unmodified in a browser, in the Tauri webview, and in Node — which is what the future web revenue path and server-side entitlement verification will require.
- No payment, AI, or TTS SDK exists anywhere in the tree. The "no vendor SDK inside clinical-training engines" rule is structurally true, not merely configured.
- `isTauriRuntime()` is confined to `apps/desktop/src/persistence/repositories.ts` — the single place the platform decision is made.

## 2. Phase 1–6 implementation verification

| Component | Verdict |
|---|---|
| Application shell, routing | VERIFIED |
| Design system (`ui-kit`) | PARTIALLY VERIFIED — implemented and consumed; no tests of any kind |
| Entitlement engine | PARTIALLY VERIFIED — see §8 |
| Scenario engine, schema validation | VERIFIED |
| Content hashing / versioning | PARTIALLY VERIFIED — correct and tested, but `computeContentHash` is never called outside its own test and `content_versions` is never written *(update: the build-time drift gate now uses it — see A3)* |
| Live-scribing session state, transcript reveal, documentation form | VERIFIED |
| Evaluation engine, fabrication/negation detection | VERIFIED |
| Deterministic scoring | PARTIALLY VERIFIED — see §3 |
| Persistence (TypeScript) | VERIFIED |
| Persistence (SQLite/Rust) | VERIFIED as of this gate — see §4/§5 |
| Competency engine | VERIFIED |
| Autosave | VERIFIED as of this gate — see §4 |
| Terminology dictionary, training lessons, remediation | VERIFIED |
| Recommendation engine | VERIFIED (error-frequency only; competency-trend input remains scoped out) |
| Analytics | **FAILED on entry, VERIFIED on exit** — see §6 |
| AI abstraction | VERIFIED (`NullAIProvider` only) |
| Tauri/Rust layer | **UNVERIFIED on entry, VERIFIED on exit** — see §5 |

## 3. Test and determinism audit — PASS WITH CONDITIONS

**Final test evidence (actually executed, not inferred):**

| Suite | Result |
|---|---|
| `pnpm -r test` → nexus-core | **186 passed / 186** (32 files) |
| `pnpm -r test` → apps/desktop | **25 passed / 25** (6 files) |
| `cargo test` | **14 passed / 14** |
| **Total** | **225 passed, 0 failed** |
| `pnpm -r typecheck` | **Clean** — nexus-core, ui-kit, desktop |
| `pnpm -r build` | **Success** — 136 modules, `dist/` emitted |
| `cargo check --all-targets` | **Clean** — no errors, no warnings |

**Determinism.** `evaluateAttempt()` is a pure function of `(scenario, draft, activeMs)` for all scores and all error classification. Scoring is reproducible.

**Condition (carried to Phase 8):** the evaluation *result object* is not byte-reproducible. `evaluation-engine/evaluate.ts` holds a module-global `errorIdCounter`, and `recommendation-engine/index.ts` holds a module-global `recommendationIdCounter`. Identical inputs therefore yield different `id` values across runs, and both counters reset to 1 per process. Impact is limited (IDs are stored inside JSON blobs, so no key collisions occur), but this weakens the auditability the commercial model depends on and should be replaced with content-derived IDs.

> **Update — cleared (A1).** Error and recommendation IDs are now derived from their subject, so the same attempt produces an identical result object on every evaluation. The evidence above describes the state at the Phase 7 gate.

**Shared mutable state.** The in-memory `sessionRepository` singleton is shared across tests by design; `InMemorySessionRepository.clear()` exists for isolation and is applied consistently. No test-order dependence was observed across full-suite runs.

## 4. Persistence integrity — PASS

Entry state: the only evidence was a one-off Python script (Phase 5) that executed the schema by hand. That validated the *schema*; it did not validate the *Rust that runs it*. `cargo test` reported **0 tests**.

Added `apps/desktop/src-tauri/src/db/tests.rs` — 14 tests against a **real on-disk SQLite file** (deliberately not `:memory:`, so WAL mode and the reopen path are genuinely exercised):

- every table the migration declares is created;
- `journal_mode=WAL` and `foreign_keys=ON` are actually in effect;
- reopening the database twice does not duplicate the seeded local user (the migration re-runs on every boot);
- **autosave persists an in-progress draft with no evaluation yet** — the exact regression Phase 5 recorded catching;
- an autosaved draft survives an application restart;
- repeated autosaves update in place rather than accumulating rows;
- autosave-then-submit attaches the evaluation to the same attempt, leaving exactly one session row, one attempt row, one evaluation row;
- `find_interrupted` returns only `in_progress`/`paused`;
- a completed attempt stays traceable to its exact `scenarioId` + `version` across a restart;
- sessions list newest-first;
- profile round-trips; competency upsert keeps one row per domain and survives a restart.

All 14 pass.

**Known limitation, explicitly re-confirmed as still present:** exact mid-transcript resume is not implemented. `revealedCount` is not persisted, so "Start a new attempt" on the Dashboard begins a fresh attempt at the same scenario rather than restoring the encounter position. The interrupted attempt's draft text is not lost — it remains in History under its original session id.

**Condition (carried to Phase 8, blocking):** there is **no migration runner and no `schema_version` tracking**. `db/mod.rs` executes `001_initial.sql` unconditionally on every boot. Architecture Package §20 states migrations are "applied in order at startup, tracked in `application_metadata['schema_version']`" — `application_metadata` is created and never written. Phase 8 must not add a table until this exists.

> **Update — cleared by Phase 8.2.1.** A versioned migration runner now exists and `application_metadata['schema_version']` is written. The evidence above describes the state at the Phase 7 gate.

## 5. Tauri/Rust verification boundary — PASS

The limitation carried since Phase 1 (apt Rust 1.75 below Tauri v2's MSRV) is resolved. On rustc 1.98.1:

- `cargo check --all-targets` — **clean**. This is the first successful compilation of the Rust source in the project's history.
- `cargo test` — **14/14 pass**.

**Defect found and fixed:** `tauri.conf.json` referenced `icons/32x32.png`, `icons/128x128.png`, and `icons/icon.ico`, but `src-tauri/icons/` contained only `.gitkeep`. A full icon set was generated via `tauri icon` from a 1024×1024 brand source built on the ui-kit tokens (deep clinical teal `#0f6e63` tile, white note-line mark). Unused Android/iOS icon trees emitted by the generator were removed.

**Still unverified, deferred to Phase 9 (Tauri packaging/release hardening):** `pnpm tauri dev` (launching the real webview) and `tauri build` (MSI/NSIS bundling) have not been run. Compilation is verified; packaging is not.

> **Update — cleared.** Both have since been run on the Windows workstation. `pnpm tauri dev` launches the real webview and performs live IPC against SQLite, and `tauri build` completes end to end, producing a 9.78 MB executable, a 3.61 MB MSI and a 2.54 MB NSIS setup. Packaging is therefore verified; what remains Phase 9 work is packaging that is *signed, updatable and release-disciplined* — see `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`, items P9-B, P9-C and P9-E. Those figures were measured on the Windows workstation and are `NOT VERIFIED ON DEVICE-02`, whose Linux container cannot run `cargo test` (`gdk-3.0` absent) or the WiX/NSIS bundlers. The evidence above describes the state at the Phase 7 gate.

**Minor, fixed 2026-09-25 (Phase 9):** `main.rs` now carries `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`, so release builds no longer open a console window behind the application. `tauri dev` keeps its console. Guarded by a source-scanning test, since `debug_assertions` is always on under `cargo test`.

## 6. Analytics readiness audit — PASS (capability restored, not built)

**Finding.** Commit `ec6dd82` deleted `export * from "./analytics-engine/index.js"` from the `nexus-core` barrel and reverted `Analytics.tsx` to a placeholder, while leaving `apps/desktop/src/content/analytics-flow.test.ts` importing `computeAnalytics` from that barrel. Consequences at entry:

- `pnpm --filter @haa-nexus/desktop typecheck` — failing (TS2305);
- `pnpm --filter @haa-nexus/desktop build` — failing (`build` = `tsc --noEmit && vite build`);
- `pnpm --filter @haa-nexus/desktop test` — failing;
- a complete, tested engine (14 tests) orphaned in the tree;
- README's "typecheck clean" and "production build verified" claims false.

This also violated the standing rule *"do not silently remove or weaken existing tests"* — the test was not deleted, it was orphaned.

**Corroboration.** README claimed 172 nexus-core and 22 desktop tests; actual counts are 186 and 25. The deltas — 14 and 3 — are exactly the sizes of `analytics-engine/compute.test.ts` and `analytics-flow.test.ts`.

**Disposition.** Restored. Analytics is an already-implemented capability, audited and confirmed here:

- every figure traces to a real `SessionRecord` or `CompetencyRecord`; there is no separate analytics store, matching Architecture Package §18;
- `averageScore` returns `null` rather than a fabricated `0` when nothing has been scored, and the UI renders an explicit empty state;
- non-finite scores are filtered defensively rather than allowed to poison the average;
- weakest/strongest areas exclude domains with zero attempts;
- no placeholder charts or synthesized metrics exist.

Restoring analytics also restores MVP acceptance criterion §34(13) ("view competency levels per domain"), which had no UI at all while the route was a placeholder.

## 7. Security/privacy boundary audit — PASS

- **No secrets in source control.** A full scan for API-key/token/secret patterns across `apps`, `packages`, `content`, `docs`, and root files returned only prose references in specification documents. `git ls-files` shows no `.env`, credential, or key file has ever been tracked.
- No payment credential, API key, or provider secret is expected in the frontend; no such code path exists.
- Built-in patient content is synthetic. Both shipped scenarios are authored fixtures; no code path accepts or requires real PHI.
- The application does not claim HIPAA compliance anywhere. Architecture Package §27 explicitly disclaims it.
- **Preventative fix applied:** `.gitignore` had no secrets patterns at all. Added `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `secrets.json` — verified that no currently-tracked file matches them.

**Condition (carried to Phase 8):** `tauri.conf.json` sets `"csp": null`. Acceptable for an offline desktop MVP; **not** acceptable once a web build and a payment redirect exist.

> **Update — cleared.** `tauri.conf.json` no longer sets `"csp": null`. It carries a real policy — `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `frame-ancestors 'none'`, with the IPC and asset origins allowed — plus a separate `devCsp` for Vite/HMR. `style-src` retains `'unsafe-inline'` because the UI styles elements through React `style` props, which is a known and documented residue rather than an open condition. The accepted-debt table below records the same clearance as **A5**. The evidence above describes the state at the Phase 7 gate.

**Standing constraint for Phase 8:** privacy posture inverts the moment learner documentation leaves the device. Architecture Package §27 ("no data leaves the device") will stop describing the product at web deployment and must be rewritten *before* launch, not after.

## 8. Commercialization readiness audit

| Capability | State |
|---|---|
| Entitlement tiers | **ABSENT** — no `Tier` type, enum, or string exists |
| Capability matrix | **STUBBED** — one frozen 6-boolean `DEFAULT_ENTITLEMENTS` |
| Scenario difficulty gating | **ABSENT, but well-positioned** — `difficulty: 1–6` is schema-enforced and `ScenarioRepository.list({difficulty})` already filters; `ScenarioLibrary` applies no gate |
| User identity | **STUBBED** — hardcoded `LOCAL_USER_ID`, display name only |
| Subscription state | **ABSENT** |
| Billing abstraction | **ABSENT** — but `AIServiceProvider`/`NullAIProvider` is a proven template |
| Web deployment | **ABSENT** — the Vite build is Tauri-targeted |
| Authentication | **ABSENT** |
| Cloud/server boundary | **ABSENT** — `sync_queue` exists as inert schema parity |
| Payment integration | **ABSENT** — correct; must stay so until Phase 8 reaches it |
| Free-to-paid conversion states | **ABSENT** — full score detail renders unconditionally |

**Verdict on reuse:** the Phase 1 entitlement engine is **reusable as a boundary, insufficient as an engine**. `EntitlementService.can(key)` is the right call shape and should be preserved; but the service is a value holder that cannot answer "can this user start *this scenario*?". It needs a tier model, a capability matrix, and a resolution function — extension, not replacement. Scenario `difficulty` metadata is the canonical gating axis and maps directly onto the tier ladder (Free ≤2 · Practice ≤3 · Pro ≤4 · Fast-Track ≤6); no parallel difficulty system should be created.

**Enforcement reality:** no server exists, so authoritative server-side verification is impossible today. The entitlement resolver must therefore be written as a **pure, environment-agnostic function** that a server can later re-execute as the authority. Writing it any other way is the expensive mistake.

**Content reality:** only 2 scenarios exist, at difficulty 1 and 3. The gating machinery can be built now; there is not yet enough content to justify charging for it. This is a content problem, not an engineering one, and it — not the code — is the real gate on revenue.

## 9. Documentation reconciliation — PASS

Resolved in this gate:

- README test counts corrected (172/22 → 186/25, plus 14 Rust).
- README "typecheck clean" / "production build verified" claims made true again (they were false at entry).
- README Rust section rewritten from "known environment gap" to recorded verification results.
- `analytics-engine` now documented in README and CHANGELOG; it was absent from both.
- CHANGELOG gained a Phase 7 entry; "Not yet started" section updated.
- Dashboard in-product copy no longer claims Training/Knowledge Base/Analytics "arrive in later phases".
- Business model spec's product-state table updated.
- This document's status changed from "Not yet started" to the closed disposition.

**Unresolved documentation gaps (conditions, not blockers):** Architecture Package §20 describes a migration runner that does not exist *(resolved by Phase 8.2.1 — the code now matches §20)*, and §29 describes a build-time content-hash drift gate that does not exist *(resolved — see A3)*. Both are recorded as Phase 8 prerequisites rather than rewritten, because the documented behaviour is the behaviour we want — the code should catch up to the doc, not the reverse.

---

## Phase 7 exit criteria — final status

| # | Criterion | Status |
|---|---|---|
| 1 | Phase 1–6 claims audited against the repository | ✅ Met — §2 |
| 2 | All known defects fixed or explicitly accepted/documented | ✅ Met — 3 blockers fixed, conditions listed below |
| 3 | Full test/typecheck/build evidence recorded | ✅ Met — 225 tests, all green; §3 |
| 4 | Tauri/Rust verification status explicitly known | ✅ Met — compiles + 14 tests; packaging deferred to Phase 9; §5 |
| 5 | Analytics verified or explicitly scoped incomplete | ✅ Met — verified as implemented and restored; §6 |
| 6 | Entitlement architecture documented as reusable or needing redesign | ✅ Met — reusable as boundary, needs extension; §8 |
| 7 | No undocumented architectural blocker remains | ✅ Met — all conditions enumerated below |
| 8 | This document records audit evidence and final disposition | ✅ Met |

## FINAL DISPOSITION: PASS WITH CONDITIONS

The gate closes. The repository builds, typechecks, and passes 225 tests across TypeScript and Rust. The Rust verification boundary that had been open since Phase 1 is closed. No secret has ever been committed. No vendor SDK contaminates the clinical-training engines.

It is **PASS WITH CONDITIONS** rather than a clean PASS because three conditions are genuine prerequisites for specific Phase 8 increments, and several others are accepted debt.

### Blocking conditions — must be resolved *within* Phase 8, before the increment they gate

| # | Condition | Gates |
|---|---|---|
| C1 | ~~No migration runner / `schema_version` tracking~~ **CLEARED by Phase 8.2.1** — numbered migrations applied once each, in order, transactionally, recorded in `application_metadata['schema_version']`, with foreign-key handling that permits table rebuilds. 18 Rust tests. See CHANGELOG, Phase 8.2.1 | Any Phase 8 increment that adds a table (subscription persistence, Assessment mode's `mode` CHECK constraint) |
| C2 | ~~Entitlement engine has no tier, matrix, subscription state, or resolution function~~ **CLEARED by Phase 8.1** — `Tier`, `SubscriptionState`, `CAPABILITY_MATRIX` and the pure `resolveEntitlements` resolver now exist in `nexus-core`, with 45 tests. See CHANGELOG, Phase 8.1 | The entire commercialization sequence; it was Phase 8's first increment |
| C3 | No rendered-component tests (no jsdom/testing-library) — **PARTIALLY ADDRESSED by Phase 8.2**: jsdom + Testing Library now exist (opt-in per file), with rendered tests for `ScenarioLibrary` gating (15) and Dashboard interrupted-session resume (2). Every other component remains untested at the rendered level, so the condition stays open for each *future* gating/paywall surface | Any paywall/gating UI state, which would otherwise ship untested |

### Accepted debt — documented, not blocking

| # | Condition |
|---|---|
| A1 | ~~Module-global ID counters make error/recommendation IDs non-reproducible across runs~~ **CLEARED** — IDs are now content-derived (`<errorType>:<requirementId>`, `fabrication:<value>#<n>`, `rec:<ruleId>`); no module-level mutable state remains in `nexus-core`. See CHANGELOG, Phase 7 Accepted-Debt Remediation |
| A2 | `modules.ts` declares 12 competency domains; the evaluator produces 7. The registry list is dead data |
| A3 | ~~Content hashing implemented but wired to no build/import gate (Architecture Package §29 unmet)~~ **CLEARED** — `content/content-hashes.json` records each released scenario version's hash; the content-QA suite fails any shipped scenario edited without a version bump. Scenarios only; runtime `content_versions` writes remain unimplemented (content is bundled, not imported). See CHANGELOG, Phase 7 Accepted-Debt Remediation |
| A4 | ~~`tauri dev` not yet run; runtime IPC unexercised~~ **PARTLY CLEARED** — `tauri dev` now runs: the webview launches and real `invoke` calls round-trip through Rust and SQLite (fixing a Vite watcher defect that had made `tauri dev` fail outright on Windows). `tauri build` also completes end to end, producing a 3.6 MB MSI and a 2.5 MB NSIS setup (an earlier bundling failure was a transient DNS error while downloading WiX). Installer signing, auto-update and release hardening remain Phase 9. See CHANGELOG, "Runtime IPC Verified in the Real Tauri Shell" |
| A5 | ~~`"csp": null` in `tauri.conf.json`~~ **CLEARED** — a production CSP (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, IPC origins allowed) plus a separate dev policy for Vite/HMR. `style-src` retains `'unsafe-inline'` because the UI uses React `style` props. Verified by running the production binary: zero CSP violations, IPC working. See CHANGELOG |
| A6 | Exact mid-transcript resume not implemented (`revealedCount` not persisted) |
| A7 | Recommendation engine does not factor in competency trends |
| A8 | ~~MVP acceptance criterion §34(10) — note comparison — never implemented~~ **CLEARED** — the submission summary shows a per-section table of encounter vs. learner vs. required, with each requirement's status read back out of the evaluation rather than recomputed. Inherits the Phase 8.3 live-feedback boundary. See CHANGELOG |
| A9 | `modules.ts` carries a stale `scenarioSchemaVersion: "0.0.0-unbuilt"` |
| A10 | ~~N+1 query patterns in `list_sessions` and `TauriCompetencyRepository.get()`~~ **CLEARED** — session reads (get/list/interrupted) are one query each; competency lookup uses a per-domain `get_competency_record` command, now exercised over real IPC in the running shell (see A4). See CHANGELOG, Phase 7 Accepted-Debt Remediation |
| A11 | `main.rs` missing `windows_subsystem = "windows"` for release builds |
| A12 | Only 2 scenarios exist (difficulty 1 and 3) — insufficient content for a paid tier. **Sharpened by Phase 8.2:** with gating live and every learner resolving to Free, only SCRIBE-FM-014 is startable in the app; SCRIBE-IM-032 shows as locked. No difficulty-2, -4, -5 or -6 content exists, so Pro and Fast-Track currently unlock nothing Practice does not |
| A13 | ~~`simulation_sessions.started_at` is TEXT; ordering is lexicographic (correct until year 2286)~~ **CLEARED** — ordering casts to INTEGER with an `id` tie-break; the column type is unchanged (no migration). See CHANGELOG, Phase 7 Accepted-Debt Remediation |

## Phase 8 entry point

Phase 7 is closed, so Phase 8 may begin, in the approved sequence from `docs/BUSINESS_MODEL_PRODUCT_SPEC.md`:

1. Entitlement-engine wiring and capability matrix. ← **start here (resolves C2)**
2. Assessment (no-pause) mode.
3. Web deployment and lightweight cloud persistence.
4. PayMongo billing/subscription state integration.
5. Automated free-to-paid conversion states.
6. Offline/batch scenario generation.
7. Cached TTS/voice pipeline.
8. Future metered AI deep-review capability.

The recommended first increment is the **entitlement domain model in `nexus-core`**: a `Tier` type, a `SubscriptionState` type, a capability matrix expressed as data, and a pure `resolveEntitlements(state)` function — with no UI change, no persistence change, and no payment provider. `DEFAULT_ENTITLEMENTS` and the existing `EntitlementService` constructor must remain working so nothing currently depending on them breaks.
