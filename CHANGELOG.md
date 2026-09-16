# Changelog

This is a single, continuously-built monorepo. Every phase below is
**cumulative** — each phase's checkpoint includes all prior phases' code,
tests, and content, verified together in one test/typecheck/build run. No
phase has ever been delivered as an isolated patch against a different base.

Status legend: **Complete** (implemented + tested this checkpoint) · **In
Progress** (started, not yet verified) · **Not Started** (by design, per the
phase order in `docs/HAA_Nexus_Architecture_Package.md`).

---

## Phase 8.1 — Entitlement Domain Model (Complete)

Incorporates Phases 1-7 in full. The first commercialization increment, and
deliberately the smallest one that stands alone: a pure domain model, with
no consumer. **No product behaviour changes in this checkpoint** — nothing
in the app reads the new model yet, so every screen behaves exactly as it
did at the Phase 7 gate.

**Added to `packages/nexus-core`:**

- **`types/subscription.ts`** — provider-neutral subscription model:
  `Tier` (`free` | `practice` | `pro` | `fast_track`), `SubscriptionStatus`
  (`none` | `active` | `past_due` | `canceled` | `expired`),
  `SubscriptionState` (`tier`, `status`, `currentPeriodEnd`,
  `fastTrackPurchased`), and a `NO_SUBSCRIPTION` constant for the local/MVP
  default. Nothing here knows a payment provider exists; a future adapter's
  job is to normalize its own vocabulary *into* these types.
- **`entitlement-engine/capability-matrix.ts`** — the commercial matrix
  from Business Model Spec Section 4, expressed as frozen data rather than
  conditionals. One authoritative table; no component reconstructs it.
- **`entitlement-engine/resolve.ts`** — `isSubscriptionCurrent`,
  `resolveEffectiveTier`, `resolveEntitlements`, `canAccessDifficulty`. All
  pure: no I/O, no clock read, no vendor dependency. `now` is an explicit
  parameter, matching the convention nexus-core already uses elsewhere
  (`startSession(params, now)`, `updateCompetencyRecord(..., now)`). That
  purity is what will let the identical function run server-side as the
  authority later, instead of trusting the client.
- **`Entitlements`** extended with ten commercial capabilities alongside the
  six Phase 1 keys: `maxScenarioDifficulty`,
  `canViewDetailedScoreBreakdown`, `canTrackCompetency`,
  `canUseRecommendations`, `canViewAnalytics`,
  `canReceiveMonthlyScenarioDrops`, `canAccessTierExclusiveContent`,
  `canRequestTranscriptReview`, `canEarnCompletionCertificate`,
  `voiceQuality`.
- **`EntitlementService`** gained `static fromSubscription(state, now)` and
  `canAccessDifficulty(difficulty)`.

**Difficulty gating reuses existing metadata.** Free ≤2 (Beginner),
Practice ≤3 (Intermediate), Pro ≤4 (Advanced), Fast-Track ≤6
(Expert/Master) map onto the scenario schema's existing 1-6 `difficulty`
field. No parallel difficulty system was created, per the spec's explicit
instruction.

**Fast-Track is modelled as a relationship, not a tier string.**
`resolveEffectiveTier` is the single place the "requires active Pro" rule
lives, and it cuts both ways: active Pro + purchase resolves *up* to
`fast_track`; a record claiming `tier: "fast_track"` without the purchase
resolves *down* to `pro`, so the add-on cannot be obtained by asserting a
string; a purchase sitting on Free or Practice confers nothing but is not
destroyed, so restoring Pro restores Fast-Track without a second payment;
and any lapse falls back to Free first, so an expired Pro + Fast-Track
resolves to Free.

**Subscription-status semantics.** `active` is current unless a bounded
period has passed. `past_due` and `canceled` retain access only for the
remainder of an already-paid period — standard dunning, so a transient card
failure does not instantly revoke access — then fall back to Free. `none`
and `expired` never grant access, and an explicit `expired` overrides a
stale future period end. The exact period-end instant counts as lapsed.

**Business-rule ambiguity found and resolved during the Phase 8.1 audit.**
The first implementation of the matrix granted Practice competency tracking
and analytics, and introduced a per-tier `maxCompetencyLevel` ceiling
(Practice capped at `advanced`). Auditing this against the specification
found no basis for any of it: the spec names competency and analytics in
exactly two rows — Free ("competency tracking and analytics remain locked")
and Pro ("Competency tracking to Mastered") — and never mentions a
competency ceiling anywhere. `maxCompetencyLevel` was removed entirely and
Practice was corrected to lock competency, analytics and recommendations.
Beyond having no spec basis, a per-tier competency ceiling would display a
level contradicting the learner's real persisted record, which the
no-fabricated-results rule (Architecture Package Section 18) forbids. The
recorded interpretation is now written into
`docs/BUSINESS_MODEL_PRODUCT_SPEC.md` Section 4 as a documented default,
explicitly flagged as changeable in one place if the founder intends
otherwise.

**Honest gaps in the matrix.** `canUseAI`, `canUseCloudSync`, and
`canAccessPremiumModules` are `false` for *every* tier including Fast-Track,
because those capabilities do not exist yet (AI is Phase 11+, cloud sync is
Phase 10, and no second module exists). A test enforces that no tier claims
them. Turning them on later is an edit to the matrix — a data change, as
Architecture Package Section 24 promises.

**Compatibility preserved.** `DEFAULT_ENTITLEMENTS`, the
`new EntitlementService(entitlements)` constructor, the three original
entitlement tests (unmodified and passing), and `Settings.tsx` behaviour are
all unchanged; `Settings.tsx` was not edited. One signature narrowed:
`can()` now accepts `BooleanEntitlementKey` rather than
`keyof Entitlements`, because `can("maxScenarioDifficulty")` is not a
yes/no question and would otherwise return a number typed as boolean.
Limits are read off `all()` or via `canAccessDifficulty()`. The only
`can()` call site in the repository (`Settings.tsx:43`) passes a boolean
key and was verified by inspection as well as by typecheck.

**Verified this checkpoint:** 231/231 nexus-core tests (33 files; 45 new
entitlement tests), 25/25 desktop tests, 14/14 Rust tests — **270 total, 0
failures**, with the Phase 7 baseline of 225 fully green. `pnpm -r
typecheck` clean. `pnpm -r build` succeeds. `cargo check --all-targets`
clean, `cargo fmt --check` clean. New tests are table-driven against a fixed
clock with no `Date.now()` dependence, and cover every tier's capability
set, all five lifecycle statuses, period-boundary behaviour, six Fast-Track
relationship combinations, the full 1-6 difficulty sweep per tier,
`DEFAULT_ENTITLEMENTS` equivalence with the resolved Free state, matrix
invariants, and resolver purity (determinism and non-mutation of inputs).

**Explicitly NOT implemented in 8.1** (deferred to 8.2 onward, and verified
absent from the repository): scenario-library UI gating, paywall/conversion
states, locked score detail, Assessment mode, subscription persistence,
SQLite migrations, any `PaymentProvider` interface or implementation,
PayMongo, cloud authentication, and web deployment.

---

## Phase 7 — Pre-Commercialization Audit & Stabilization Gate (Complete — PASS WITH CONDITIONS)

Incorporates Phases 1-6 in full. Phase 7 added no new product features by
design; it audited what existed, fixed what the audit broke open, and
recorded real verification evidence. Full audit findings and the final
disposition live in `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`.

**Blockers found and fixed:**

- **Analytics was silently broken at HEAD.** The previous commit removed
  `export * from "./analytics-engine/index.js"` from `nexus-core`'s barrel
  and reverted `Analytics.tsx` to a placeholder, but left
  `apps/desktop/src/content/analytics-flow.test.ts` importing
  `computeAnalytics` from that barrel. Desktop typecheck, production build,
  and the desktop test suite were all failing as a result — and the
  `analytics-engine` implementation plus its 14 tests were orphaned in the
  tree. **Analytics was restored, not rebuilt**: it is an
  already-implemented Phase-6-era capability that was removed in error while
  enforcing "Phase 7 is not an Analytics implementation phase." That rule
  still stands — analytics was *audited* here, not built here.
- **The aggregate test command could not catch that class of failure.** Root
  `pnpm test` ran only `nexus-core`, so desktop tests never executed in the
  aggregate. `test`, `typecheck`, and `build` are now all `pnpm -r`, so no
  package can be silently omitted.
- **The Tauri bundle referenced icon files that did not exist.**
  `tauri.conf.json` pointed at `icons/32x32.png`, `icons/128x128.png`, and
  `icons/icon.ico` while `src-tauri/icons/` held only a `.gitkeep`. A full
  icon set was generated with `tauri icon` from a brand source image built
  on the ui-kit design tokens (deep clinical teal `#0f6e63`, note-line mark).
  The unused Android/iOS icon trees the generator emits were removed.

**Rust/Tauri verification boundary — closed.** The "apt Rust 1.75 is below
Tauri's MSRV" limitation carried since Phase 1 is resolved. On a
rustup-managed toolchain (rustc/cargo 1.98.1, rustup 1.29.1, Windows 11 with
MSVC build tools):

- `cargo check --all-targets` — clean, no errors, no warnings. **This is the
  first time the Rust source has ever compiled.**
- `cargo test` previously reported *0 tests*, which could not support the
  audit's persistence-integrity requirement. Added
  `apps/desktop/src-tauri/src/db/tests.rs`: 14 tests against a real on-disk
  SQLite file (not `:memory:`, so WAL and the reopen path are genuinely
  exercised), covering every table the migration declares, WAL +
  foreign-key pragmas, restart idempotency, autosave of an in-progress draft
  with no evaluation yet, autosave survival across a restart,
  autosave-then-submit attaching the evaluation to the same attempt without
  duplicating rows, interrupted-session detection, newest-first ordering,
  scenario-version traceability of a completed attempt, profile round-trip,
  and per-domain competency upsert. All 14 pass. This replaces the Phase 5
  evidence (a one-off Python script that executed the schema by hand, which
  validated the schema but not the Rust that runs it).

**Other stabilization:**

- Root `package.json` gained `packageManager: pnpm@9.15.9`. `tauri.conf.json`
  hardcodes `pnpm` in `beforeDevCommand`/`beforeBuildCommand`, so the
  toolchain needs to be reproducible rather than assumed.
- `.gitignore` gained `.env`, `.env.*`, `*.pem`, `*.key`, `secrets.json`.
  The security audit confirmed no secret has ever been committed; these
  patterns keep that true once payment/AI/TTS providers arrive in Phase 8+.
- Dashboard copy no longer tells users that Training, Knowledge Base, and
  Analytics "arrive in later phases" — all three shipped.
- Removed the dead `build:core` script (nexus-core has no `build` script; it
  is consumed from source via `main: ./src/index.ts`).

**Verified this checkpoint:** 186/186 nexus-core tests (32 files), 25/25
desktop tests (6 files), 14/14 Rust tests — **225 total, 0 failures**.
`pnpm -r typecheck` clean across all three packages. `pnpm -r build`
succeeds (136 modules). Earlier documentation claimed 172 nexus-core and 22
desktop tests; those figures predated the analytics engine and were never
updated. Corrected throughout.

**Accepted conditions carried into Phase 8** (documented, not silently
skipped — see the audit doc for the full list): no migration runner or
`schema_version` tracking; the entitlement engine is still a static
six-boolean stub with one display-only consumer; module-global ID counters
in the evaluation and recommendation engines make error IDs non-reproducible
across runs; `modules.ts` declares 12 competency domains while the evaluator
produces 7; content hashing is implemented but not wired to any build/import
gate; no rendered-component tests; `tauri dev`/`tauri build` not yet run;
only 2 scenarios exist, at difficulty 1 and 3.

---

## Phase 6 — Training/Remediation (Complete)

Incorporates Phases 1-5 in full, plus:

- **`terminology-engine`**: schema/validation for the lay↔clinical dictionary called for in Architecture Package Sections 6/13/38, plus a searchable in-memory repository
- **`training-engine`**: lesson schema/validation (explanation, examples, knowledge checks, linked scenario IDs) plus an in-memory repository
- **`recommendation-engine`**: deterministic rule table implementing Architecture Package Section 12's exact examples — repeated HPI omissions → HPI lesson, repeated terminology errors → terminology lesson, repeated time failures → retry the same scenario, fabrication → accuracy lesson (fires on a single occurrence, since fabrication is Critical severity by design, not something that should require repetition to flag)
- **Real content**: a 4-entry terminology dictionary (matching the IDs the two existing scenarios already reference) and 3 full lessons (`hpi-fundamentals`, `medical-terminology`, `accuracy-and-unsupported-inference`) matching the recommendation engine's referenced IDs exactly — cross-checked by a dedicated content-QA test that fails loudly if either side drifts
- **Desktop**: real `Knowledge Base` (search) and `Training` (lesson browser + interactive knowledge checks) routes, replacing their Phase 1 placeholders; `SubmissionSummary` now shows a "Recommended for you" card generated from real submission history, with one-click navigation to a deep-linked lesson or an immediate scenario retry

**Bug caught and fixed during this phase (test-only, not a product bug):** the in-memory `sessionRepository` singleton carries state across tests within the same file by design (it mirrors how the real app uses it as a shared module). My first end-to-end recommendation test didn't account for this and failed due to leftover sessions from earlier tests in the same file. Added a `clear()` method to `InMemorySessionRepository` for test isolation and applied it consistently across the affected test files.

**Verified:** 172/172 nexus-core tests (17 new — terminology/lesson schema validation, repository behavior, recommendation-engine rules, and content-QA checks against the real shipped terminology/lesson files), 22/22 desktop tests (8 new — including full end-to-end tests that submit real sessions and confirm the correct recommendation fires, or correctly doesn't). Typecheck clean across all packages. Production build succeeds (134 modules). Dev server logged a clean "ready" boot (module graph loads without startup errors); a subsequent `curl` check couldn't connect due to this sandbox's background-process lifecycle being flaky for long-running servers (seen in earlier phases too) — not treated as a code issue, since the build and test evidence is stronger regardless.

**Explicitly scoped out of Phase 6** (not silently skipped): the recommendation engine currently only looks at error-type frequency; it doesn't yet factor in competency-record trends directly (e.g., a domain stuck at "developing" for many attempts) — Architecture Package Section 45 mentions competency as one input among several, and this phase implements the error-frequency half concretely, leaving competency-trend-based recommendations as a reasonable future refinement rather than a fabricated capability.

---

## Phase 5 — SQLite Persistence (Complete, with one honestly-scoped gap)

Incorporates Phases 1-4 in full, plus:

- **TypeScript persistence layer** (`nexus-core/persistence/`): `SessionRepository`, `ProfileRepository`, `CompetencyRepository` interfaces + in-memory implementations
- **`competency-engine/`**: rolls per-attempt scores into per-domain competency records (unassessed → introduced → developing → competent → advanced → mastered), with rolling-average scoring, trend detection, and a confidence value that prevents "Mastered" from being reachable off a single lucky attempt
- **SQL schema** (`apps/desktop/src-tauri/migrations/001_initial.sql`): the full schema from Architecture Package Section 8, with clear comments marking which tables are actively used vs. schema-parity placeholders for later phases. **Verified by actually executing it against real SQLite (via Python)** — not just written and eyeballed — including the exact insert/join/upsert patterns the Rust layer uses, and specifically the autosave path (in-progress session, draft persisted, no evaluation yet).
- **Rust backend** (`apps/desktop/src-tauri/src/db/`, `commands.rs`): connection setup with WAL/synchronous pragmas, session/profile/competency query modules, Tauri commands wiring it all to the frontend. Passes `rustfmt` syntax validation. **Compilation still unverified in this sandbox** (same toolchain gap as Phase 1 — see below).
- **Desktop wiring**: environment-aware repository selection (`isTauriRuntime()` — real SQLite inside the Tauri shell, in-memory fallback in a plain browser), `sessionStore` now computes evaluation and persists on submit, **autosaves every 15s while in-progress and on every pause**, and folds results into competency records. `profileStore` now backed by `ProfileRepository`. Dashboard gained a real **History** list and an **interrupted-session banner** (detects sessions left `in_progress`/`paused`, offers to start fresh or discard).

**Bug caught and fixed during this phase, before it shipped:** my first draft of the Rust `save_session` only wrote the documentation draft to disk when a session was `completed`, which would have silently broken autosave for in-progress work — the exact thing this phase exists to prevent. Caught while reasoning through the design, fixed, and re-verified against real SQLite before moving on.

**Verified:** 141/141 nexus-core tests (15 new: repository behavior, competency-engine level thresholds/trend/confidence), 15/15 desktop tests (4 new integration tests exercising the real submit → persist → competency-update flow through the in-memory adapters). Typecheck clean across all packages. Production build succeeds (123 modules). Dev server confirmed booting without runtime errors.

**Explicitly and honestly scoped out of Phase 5** (not silently skipped):
- **Exact mid-transcript resume.** An interrupted session's draft text and evaluation are never lost, but the transcript reveal position (`revealedCount`) isn't persisted yet, so "Resume" on the Dashboard starts a fresh attempt at the same scenario rather than restoring the exact encounter position. The abandoned session's draft remains visible in History.
- **Per-section competency domains** (HPI, ROS, Physical Exam, etc., as named individually in Architecture Package Section 21). The evaluator currently scores 7 categories per attempt (accuracy, completeness, terminology, relevance, structure, pertinentPosNeg, timeEfficiency), not per-section — competency records are keyed to those 7 categories for now. Scoring individual sections independently would need evaluator changes, not just persistence changes.
- **Rust compilation verification** — unchanged limitation from Phase 1. The SQL itself is now verified against real SQLite (stronger evidence than Phase 1 had for the Rust side alone), but `cargo check`/`tauri dev` still need to run on a machine with a current Rust toolchain before the desktop shell overall is considered done.

---

## Phase 4 — Evaluation & Scoring Engine (Complete)

Incorporates Phases 1, 2, and 3 in full, plus:

- `evaluation-engine/text-matching.ts` — phrase/variant matching (accepts terminology variants, not exact-string only)
- `evaluation-engine/numeric-fabrication.ts` — detects fabricated vital/lab values not present anywhere in the encounter (the spec's canonical "Temperature 37.0°C" example, generalized to any number+clinical-unit pattern)
- `evaluation-engine/negation.ts` — detects a pertinent negative reported as a positive (the "dangerous reversal" Critical case)
- `evaluation-engine/requirement-evaluator.ts` — per-requirement classification: satisfied / wrong-section / raw-lay-term / omitted / reversed
- `evaluation-engine/feedback-templates.ts` — deterministic WHAT/WHY/HOW feedback per error type (not AI-generated, so it stays auditable and reproducible)
- `evaluation-engine/evaluate.ts` — the orchestrator: runs every required/optional item through the evaluator, runs fabrication + time-management checks, computes all 7 weighted category scores, applies severity floors, returns a full `EvaluationResult`
- Added `incorrect_negative` to the severity-floor table (`scenario-engine/severity.ts`) as an always-Critical error type
- Desktop: `SubmissionSummary` now shows a real overall score, per-category bars, and full WHAT/WHY/HOW feedback per error — no longer a "not scored yet" placeholder

**Verified:** 118/118 nexus-core tests (11 new, covering every classification path: correct submission, empty submission, partial submission, the exact fabrication example, wrong-section, incorrect terminology, dangerous reversal, time management, and custom scoring-weight overrides), 11/11 desktop tests (including 4 end-to-end tests against the real shipped `SCRIBE-FM-014` content, not just synthetic fixtures). Typecheck clean across all packages. Production build succeeds (110 modules).

**Explicitly out of scope for Phase 4** (documented, not silently skipped): general unsupported-inference/irrelevance detection over arbitrary free text. The deterministic MVP core cannot reliably do this without real NLP; the architecture doc itself defers this to Phase 11's AI-assisted interpretation layer. The `relevance` category score therefore uses a narrower, honestly-scoped proxy (optional-item coverage) rather than true semantic relevance filtering — see the comment in `evaluate.ts`.

---

## Phase 3 — Live Scribing Simulator (Complete)

Incorporates Phases 1 and 2 in full, plus:

- `simulation-engine/` (nexus-core): session state machine, progressive transcript beats, flagging, documentation draft helpers
- Desktop: `ScenarioLibrary`, `SimulatorWorkspace` (live timer, transcript reveal, flagging, 7-section documentation form, Pause/Resume/Clear/Submit), `SubmissionSummary`
- `ui-kit`: `TextArea` component
- Content-loading wired to real validated scenario JSON at runtime

**Verified:** 79/79 nexus-core tests, 7/7 desktop tests, typecheck clean, production build succeeds.
**Known gaps (documented in README, not fixed silently):** no rendered-component tests (no jsdom/testing-library yet); session/draft state is in-memory only (persistence is Phase 5); Assessment mode not implemented (correctly out of MVP scope per the architecture doc's acceptance criteria, which only requires Practice or Simulation).

---

## Phase 2 — Scenario Engine (Complete)

Incorporates Phase 1 in full, plus:

- `scenario-engine/` (nexus-core): Zod schema + validation, scoring-weight merge/validation, content hashing, versioning + comparison, in-memory `ScenarioRepository` with filtering, severity floors, difficulty-level metadata
- Two full synthetic sample scenarios under `content/scenarios/live-scribing/`, both passing schema validation and a fabrication-traceability check

**Verified:** 52/52 nexus-core tests at this checkpoint, typecheck clean.

---

## Phase 1 — Application Shell (Complete)

- `nexus-core`: entitlement engine, AI service abstraction (`NullAIProvider`), module registry
- `ui-kit`: design tokens (clinical documentation-workstation aesthetic), `Button`, `Card`, `NavRail`
- Desktop: routing shell (Dashboard, Live Scribing/Training/Knowledge Base/Analytics/Settings), in-memory local profile
- Monorepo scaffold (pnpm workspaces, shared tsconfig)

**Verified:** 8/8 nexus-core tests at this checkpoint, typecheck clean, production build succeeds, dev server confirmed serving real markup.
**Known gap, unchanged since Phase 1:** the Tauri/Rust desktop shell (`apps/desktop/src-tauri`) cannot be compiled in this sandbox — apt's Rust 1.75 is well below Tauri v2's actual MSRV (~1.83+), and several transitive dependencies require Cargo's `edition2024` feature. The Rust source itself is written to standard Tauri v2 conventions and passes `rustfmt` syntax validation; full `cargo check`/`tauri dev` needs to be run on a machine with a current `rustup`-managed toolchain before the desktop shell is considered verified. See `README.md` for exact repro steps.

---

## Not yet started (by design)

Phase 8 covers commercialization and Phases 9-13 later platform expansion — see `docs/HAA_Nexus_Architecture_Package.md` and `docs/BUSINESS_MODEL_PRODUCT_SPEC.md`. Phase 8.1 (Entitlement Domain Model) is complete. Phase 8.2 onward has not been started: no UI gating, paywall states, Assessment mode, subscription persistence, PayMongo, billing, cloud authentication, or web deployment work exists in the repository.

---

## Phase 7 Definition — Pre-Commercialization Audit & Stabilization Gate

Phase 7 is explicitly defined as an audit and stabilization gate, **not an Analytics implementation phase**. Analytics readiness and any existing placeholder/data-path work are audited within this phase for correctness, traceability, and regression safety.

The Phase 7 gate must reconcile the actual Phase 1–6 repository state with `README.md`, `CLAUDE.md`, the architecture package, and the business model specification; verify tests/typechecks/build evidence; document the Tauri/Rust verification boundary; inspect persistence and determinism; confirm security/privacy boundaries; and determine whether the Phase 1 entitlement architecture is ready to support commercialization.

Phase 8 begins commercialization implementation only after the Phase 7 gate closes. See `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`.

**Outcome:** the gate closed as **PASS WITH CONDITIONS**. The audit confirmed analytics was an already-implemented capability that had been removed in error rather than a capability Phase 7 needed to build — restoring it did not redefine Phase 7 as an Analytics phase.

## Business Model Update — Commercialization Made First-Class

Added `docs/BUSINESS_MODEL_PRODUCT_SPEC.md` as the durable product/commercialization specification and `CLAUDE.md` as the Claude Code repository handoff/instruction layer.

This update establishes subscription and revenue architecture as a first-class project concern rather than a later add-on. The Phase 1 entitlement engine remains the starting point for monetization wiring.

Key decisions recorded:

- Web deployment is the near-term revenue vehicle and should proceed in parallel with desktop verification.
- Planned tiers: Free Foundations, Practice Access ($15/month), Exam-Ready Pro ($20/month), and Agency Fast-Track (+$39 one-time with active Pro).
- PayMongo is the planned customer-billing provider; provider-specific recurring-payment capabilities must be verified during implementation.
- Deterministic evaluation remains the default scoring path for all tiers to keep marginal per-attempt cost near zero and scoring auditable.
- Scenario generation and TTS should be asynchronous/batch operations with validation/caching rather than live per-attempt dependencies.
- Any future interpretive AI assessment should be explicitly metered because its cost scales directly with unique learner submissions.
- Commercial capabilities must be represented as testable entitlements rather than scattered UI-only paywalls.
- Payment, AI, and TTS vendors remain behind adapter boundaries so clinical-training logic is vendor-independent.
