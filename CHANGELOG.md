# Changelog

This is a single, continuously-built monorepo. Every phase below is
**cumulative** — each phase's checkpoint includes all prior phases' code,
tests, and content, verified together in one test/typecheck/build run. No
phase has ever been delivered as an isolated patch against a different base.

Status legend: **Complete** (implemented + tested this checkpoint) · **In
Progress** (started, not yet verified) · **Not Started** (by design, per the
phase order in `docs/HAA_Nexus_Architecture_Package.md`).

---

## TypeScript to Rust IPC Data Contract (Complete)

Every DTO in `src-tauri/src/db/models.rs` documents itself as mirroring a
`nexus-core` type through hand-written `#[serde(rename = "...")]`
attributes. Nothing verified that claim. A mistyped, missing or stale rename
fails **silently at runtime** — the frontend receives `undefined` for that
field — while every Rust and TypeScript test stays green, because each side
only ever tested itself.

**Shared fixtures.** `apps/desktop/ipc-contract/` holds four JSON records
(completed session, in-progress session with its nullable fields, competency
record, user profile) that both sides test against. Every `f64` field uses a
non-integer value, so an exact comparison is meaningful (`serde_json`
distinguishes `70` from `70.0`).

**Rust side** (`src-tauri/src/db/contract_tests.rs`, +8 tests): each fixture
deserializes into its DTO and serializes back to *exactly* the same JSON —
which also catches a field that exists in TypeScript but not in Rust, since
serde otherwise ignores unknown fields and would drop it on save. Three tests
repeat the comparison after a round trip through real file-backed SQLite, and
one asserts that a record missing a required field is rejected rather than
silently defaulted.

**TypeScript side** (`src/persistence/ipcContract.test.ts`, +7 tests): the
key list for each type is compiler-checked with
`satisfies Record<keyof T, true>`, so it cannot drift from the `nexus-core`
type, and each fixture must have exactly those keys. A further test parses
`commands.rs` and the repository modules and requires every `invoke` call to
pass exactly the arguments its `#[tauri::command]` declares, camelCase to
snake_case — the other half of the contract, which types cannot check.

**Mutation checks.** Five, each caught: a broken serde rename (3 Rust tests
failed), `default` added so a missing field is silently filled (1), a key
dropped from a fixture (1), an argument renamed on the TypeScript side (1),
and the same argument renamed on the Rust side (1). Every file was restored
byte-identical.

**Known limitation — this is not an end-to-end test.** These tests prove the
two sides agree on field names, types and argument names; they do not prove a
real IPC call works, because `pnpm tauri dev` and `tauri build` have still
never been run in this environment (Phase 7 accepted debt A4). The
argument-name check reads source text, not a running Tauri app.

**Verified:** 267/267 nexus-core, 113/113 desktop, 51/51 Rust — **431 total, 0
failures** (+15). `pnpm -r typecheck` clean. `pnpm -r build` succeeds (287.63
kB). `cargo check --all-targets` and `cargo fmt --check` clean.

---

## Architecture §28 Edge-Case Coverage (Complete, with two items recorded as not implementable)

Architecture Package §28 lists the edge cases the testing strategy must map to
concrete fixtures. Auditing them against the repository found four
unimplemented; three required behaviour changes. None of these changes what
the product offers or how attempts are scored.

| §28 edge case | State before | Now |
|---|---|---|
| Empty submission, partial submission, terminology variant accepted, wrong terminology, fabrication (the temperature example) | Covered (Phase 4) | Unchanged |
| Forced interruption → recovery | Covered (Phase 7 restart tests) | Unchanged |
| **Simulated DB write failure → "user sees a recoverable error, not silent data loss"** | **Silent.** A failed save was only logged; a failed submission save still showed the summary as if saved | **Implemented** — see below |
| **Duplicate submission** | A second `submit` threw from the store | **Implemented** — idempotent submit |
| **Scenario version bump after a completed attempt** | Untested | **Tested** |
| **Very long documentation (stress the segmenter)** | Untested | **Tested** |
| Unsupported-inference detection | Scoped out in Phase 4 (needs language understanding; Architecture Package §23 defers it to AI-assisted interpretation) | Still scoped out |
| Contradictory learner input | Untested | **Not authorized** — the correct *grading outcome* for contradictory documentation is scoring policy, which no source defines. Recorded as D7 in `docs/PHASE_8_3_ASSESSMENT_MODE.md`; no expected outcome was encoded |

**Write-failure recovery.**
- `sessionStore` gains `saveError` (`"autosave"` | `"submission"`), set when a
  save fails and cleared by the next successful save, a new session, or a
  reset. `persistDraft` now resolves to whether it succeeded.
- A new `SaveErrorNotice` (`role="alert"`, conveyed in text, not only colour)
  appears in the simulator workspace and on the submission summary. It
  explains exactly what is and is not saved, and offers **Try saving again**.
  The autosave wording claims automatic retries only while the session is
  running, which is when the 15-second autosave interval actually runs.
- **Known limitation:** a failed *competency* update after submission is still
  only logged. Competency folding is not safely retryable (retrying could
  count an attempt twice), so surfacing it needs its own design.

**Idempotent submit.** `submit` does nothing unless the session is
`in_progress` or `paused`, so a double click, or a retry racing the first
submit, can never evaluate, save, or fold one attempt into competency twice.

**Tests.** +9 desktop (`saveFailureRecovery.test.tsx`): autosave failure
keeps the draft and clears on the next success; a failed submission save
keeps the result and saves on retry; the error clears on reset; no notice
while saves succeed; the workspace notice and its retry; the summary notice
and its retry; the notice persists when a retry also fails; an attempt folds
into competency once despite concurrent and repeated submits; submit on a
completed session does not throw. +3 desktop (`versionTraceability.test.ts`,
using a test-only v1.1 never written to `/content`): a stored attempt still
resolves to the exact v1.0 content (by content hash) after v1.1 exists;
re-evaluating the stored draft against its recorded version reproduces the
stored evaluation exactly, IDs included (possible since A1); and the same
draft scores differently against v1.1. +2 `nexus-core`: required facts are
found at the end of sections of roughly 180 KB each, and evaluation is
deterministic with no pathological slowdown (generous 5 s ceiling).

**Mutation checks.** Seven, each caught: silencing autosave failures (4 tests
failed), silencing submission-save failures (2), removing the submit guard
(2), the notice never rendering (3), the summary omitting the notice (1), the
repository ignoring the requested version (2), and the text matcher reading
only the first 10 KB (1). Every file was restored byte-identical.

**Test noise, not a defect.** Rendered tests that use `MemoryRouter` print
React Router v6 "future flag" deprecation warnings to stderr. These come from
the router library, not the application, and were left alone.

**Verified:** 267/267 nexus-core, 106/106 desktop, 43/43 Rust — **416 total, 0
failures** (+14). `pnpm -r typecheck` clean. `pnpm -r build` succeeds (287.63
kB). `cargo check --all-targets` and `cargo fmt --check` clean.

---

## Phase 7 Accepted-Debt Remediation (In Progress)

Runs in parallel with Phase 8.3, which is blocked on product decisions. Each
item below is accepted debt recorded in
`docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`, and each is a technical change
with no effect on what the product offers or how learners are evaluated.

### A1 — Deterministic evaluation and recommendation IDs (Cleared)

**Problem.** `evaluation-engine/evaluate.ts` and
`recommendation-engine/index.ts` each held a module-global counter
(`errorIdCounter`, `recommendationIdCounter`). Identical inputs therefore
produced different IDs on every evaluation, and the counters reset per
process. Scores were always reproducible; the result objects were not. That
weakens the reproducible, auditable scoring Business Model Spec Section 6
relies on.

**Change.** IDs are now derived from what they identify:
- a requirement error is `<errorType>:<requirementId>` — each requirement
  yields at most one error, and requirement IDs are unique within a scenario
  (schema-enforced);
- a fabricated value is `fabrication:<value>#<occurrence>`, so the same value
  written twice gets two distinct IDs;
- a time overrun is `time_management:session`;
- a recommendation is `rec:<ruleId>` — each rule fires at most once per call.

**No module-level mutable state remains in `nexus-core`** (verified by search).
Scores, severities, categories, feedback text and recommendation rules are
unchanged. IDs are used only as React keys and inside stored JSON, and
nothing parses them, so evaluations saved with the old `err-N` / `rec-N`
format remain valid.

**Tests.** +4 `evaluate.test.ts`: an attempt covering every ID branch evaluates
to an identical result (IDs included) every time; unrelated earlier
evaluations do not change IDs; every ID in a result is unique, including a
value fabricated twice; each ID is derived from its subject. +2
`recommendation-engine`: identical recommendations for the same history, and
rule-derived IDs unique within the result.

**Mutation checks.** Restoring a global counter for error IDs failed all 4
evaluation determinism tests; dropping the fabrication occurrence number
failed the uniqueness test; restoring a counter for recommendation IDs failed
both recommendation tests. Every file was restored byte-identical.

**Verified:** 258/258 nexus-core, 91/91 desktop, 36/36 Rust — **385 total, 0
failures** (+6). `pnpm -r typecheck` clean. `pnpm -r build` succeeds (286.23
kB). `cargo check --all-targets` and `cargo fmt --check` clean.

### A3 — Content-hash drift gate (Cleared)

**Problem.** Architecture Package §29 requires that "a content update that
doesn't bump `version` but changes `content_hash` is flagged as a
content-authoring error at build/import time". `computeContentHash` existed,
but nothing outside its own test called it, so an edit to a released
scenario could ship silently under an unchanged version - and every attempt
stored against that version would then be traced to content it was never
scored against.

**Change.**
- `findContentHashViolations(recorded, actual)` in `scenario-engine`: pure and
  deterministic. It reports a released version whose content changed
  without a version bump, a shipped version with no recorded hash, and a
  recorded version no longer shipped.
- `content/content-hashes.json`: the committed manifest of SHA-256 hashes of
  each released scenario version's canonicalized JSON, seeded with the two
  shipped scenarios (`SCRIBE-FM-014@1.0`, `SCRIBE-IM-032@1.0`).
- The content-QA suite checks every shipped scenario against the manifest on
  every `pnpm test`. Its failure message says exactly what to do: publish the
  edit under a new version, or add the printed entry for a new version.
- **No regeneration command, by design.** Re-recording a released version's
  hash would defeat the gate, so new versions are added from the printed
  entry and existing entries are never overwritten.

**Scope.** Scenarios only, which is what §29 names. Lessons and the
terminology dictionary are not covered, and the dictionary has no version
field to bump. Runtime `content_versions` writes remain unimplemented,
because content is bundled with the app rather than imported into SQLite.

**Tests.** +6 unit tests for the checker (clean match, changed without a
bump, the same change under a new recorded version, unrecorded, recorded but
missing, all violations in a stable order). +1 content-QA test over the real
shipped content.

**Mutation checks.** Editing a released scenario without bumping its version,
altering a recorded hash, removing a manifest entry, and making the checker
ignore hash differences each failed. Reordering keys and reformatting
whitespace in a released scenario still passed, as it should, since the hash
is canonical. Every file was restored byte-identical, and the shipped
scenarios are unchanged.

**Verified:** 265/265 nexus-core, 91/91 desktop, 36/36 Rust — **392 total, 0
failures** (+7). `pnpm -r typecheck` clean. `pnpm -r build` succeeds, bundle
unchanged (the checker runs only at test time). `cargo check --all-targets`
and `cargo fmt --check` clean.

### A10 / A13 — Single-query persistence reads and numeric ordering (Cleared)

**Problem.** Listing sessions ran one query for the IDs and then three
queries per session: 3N+1 for N sessions, on every Dashboard load and every
submission's recommendation pass. `find_interrupted_sessions` did the same.
`TauriCompetencyRepository.get` fetched every competency record to find one,
and `submit` calls it once per domain. Separately, sessions were ordered by
`started_at` as *text*, although the column holds epoch-millisecond strings.
That misorders values of different digit lengths, so it was correct only
while every timestamp had 13 digits.

**Change.**
- `db/sessions.rs`: `get_session`, `list_sessions` and
  `find_interrupted_sessions` now share one statement that loads the
  session, its latest attempt and that attempt's evaluation together. It keeps
  the previous loader's semantics: latest attempt by `submitted_at`, first
  evaluation by `rowid`, and an empty draft with no evaluation for a session
  that has no attempt. Timestamps are ordered as integers, with `id` breaking
  ties so the order is fully deterministic. `save_session` is byte-identical.
  `list_session_ids` and `find_interrupted_session_ids` were removed, and the
  two existing tests that used them now use the full-record functions with
  unchanged assertions.
- `db/competency.rs` + `commands.rs` + `main.rs`: a new
  `get_competency_record(domain)` command; `TauriCompetencyRepository.get`
  uses it.
- IPC contract test: every command name the frontend passes to `invoke` must
  be registered in `main.rs`, so a renamed or unregistered command fails the
  test suite rather than failing at runtime.

**Tests.** +7 Rust: numeric rather than text ordering, a stable order for
equal start times, many sessions listed without drafts or evaluations
cross-wired, a session with no attempt row, the latest of two attempts and
its own evaluation (and still one record per session), interrupted sessions
returned as full records newest-first, and per-domain competency lookup. +3
desktop (`tauriRepositories.test.ts`, with `invoke` mocked): `get` issues one
per-domain command, `null` maps to `undefined`, and the IPC contract.

**Mutation checks.** Text ordering of `started_at`, removing the tie-break,
choosing the earliest attempt, a plain join (one row per attempt), reverting
`TauriCompetencyRepository.get` to list everything, and unregistering the new
command each failed the test aimed at it. Every file was restored
byte-identical.

**Not verified.** The new command compiles, is registered, and is checked by
the contract test, but a real IPC round trip has not been exercised, because
`tauri dev` has still never been launched (Phase 7 accepted debt A4).

**Verified:** 265/265 nexus-core, 94/94 desktop, 43/43 Rust — **402 total, 0
failures** (+10). `pnpm -r typecheck` clean. `pnpm -r build` succeeds (286.26
kB). `cargo check --all-targets` and `cargo fmt --check` clean.

---

## Phase 8.3 — Assessment Mode (In Progress: foundation, workspace and live-feedback boundary; blocked on product decisions)

Incorporates Phases 1-8.2.1 in full. **This checkpoint is a foundation, not
the finished feature.** Assessment mode now exists in the domain model and
in the database, and the simulator workspace handles it correctly, but **no
learner can start an assessment session yet**: there is no UI entry point.
Practice and simulation behave exactly as before, so learner-visible
behaviour is unchanged.

**Why no UI entry point yet.** Business Model Spec Section 4 says Assessment
"should be gated by explicit entitlement capabilities", but its tier table
never says which tier includes Assessment. Choosing one would invent a
commercial rule, so exposing the mode to learners is deferred until that is
decided. Nothing in this checkpoint depends on the answer.

**Domain (`nexus-core`).**
- `SimulationMode` is now `"practice" | "simulation" | "assessment"`
  (Architecture Package Section 8 already listed `assessment`; the fourth
  architected mode, `learning`, remains unimplemented).
- `modeAllowsPause(mode)` is the single statement of the rule: false only for
  `assessment`.
- `pauseSession` and `resumeSession` throw the new `PauseNotAllowedError`
  for an assessment session. The mode is checked before the status, so the
  rule cannot be masked by a status error, and resuming a persisted
  assessment session that somehow carries `paused` is refused too. This
  implements Business Model Spec Section 10's "mode flag that disables
  Pause/Resume" in the session machine itself rather than only in a button.
- Completing, abandoning and interrupting behave exactly as for other modes.

**Persistence (`migrations/002_assessment_mode.sql`).** The first real use
of the Phase 8.2.1 migration runner. `simulation_sessions` is rebuilt to
widen its `mode` CHECK to include `'assessment'`, using the table-rebuild
procedure rehearsed in 8.2.1. Every other column, default, the `status`
CHECK and both indexes are unchanged, and the copy names its columns
explicitly. Databases upgrade from version 1 to 2 on next launch; the stored
schema version is now **2**. `001_initial.sql` is unchanged.

**Tests.** +8 `nexus-core` (`session-machine.test.ts`): the pause rule per
mode, starting an assessment session, refused pause, refused resume of a
paused-marked record, mode-before-status ordering, no mutation on refusal,
normal complete/abandon/interrupt, and unchanged practice/simulation pausing.
+4 Rust (`migration_tests.rs`): version 1 rejects `assessment`; a fresh
database accepts all three modes and still rejects `learning` and junk; a
version-1 database with real practice and simulation sessions, attempts and
evaluations upgrades to 2 with all of it intact, no foreign-key violations,
and an assessment session then round-trips through the real persistence
code; and migration 002 keeps the `status` CHECK, foreign-key enforcement
and indexes and leaves no temporary table. Four existing Rust assertions
hard-coded "the shipped schema is version 1": three now assert the latest
version and one now expects the app version 2. One test was renamed from
`..._upgrades_to_version_one_...` to
`..._upgrades_to_the_latest_version_...` accordingly. No assertion was
weakened.

**Workspace (`apps/desktop`).** Found while checking the domain change end
to end: `SimulatorWorkspace` offered the transcript's Continue button only
when `mode === "simulation"`, but assessment also reveals the transcript
one beat at a time, so an assessment learner would have been stuck on the
first beat. It now offers Continue for every mode except practice. The
Pause/Resume button is not rendered for assessment, the mode label shows
"Assessment", and `sessionStore.pause`/`resume` ignore the request for an
assessment session instead of letting `PauseNotAllowedError` escape a click
handler. +6 rendered tests (`SimulatorWorkspace.test.tsx`): no Pause or
Resume in assessment, the Assessment label, Continue still advancing the
transcript, the store ignoring pause without throwing or changing status,
Pause still working in simulation and practice, and no Continue in practice.

**Mutation checks.** With the session-machine pause rule disabled, exactly
the 4 refusal-dependent session-machine tests failed. Reverting the
workspace's Continue condition to simulation-only failed the
progressive-reveal test, and forcing Pause to always render failed the
no-Pause test. Each file was restored byte-identical.

**Verified this checkpoint:** 247/247 nexus-core, 83/83 desktop, 36/36 Rust —
**366 total, 0 failures** (+18 from 348). `pnpm -r typecheck` clean.
`pnpm -r build` succeeds (bundle 285.66 kB, up from 285.30 kB). `cargo check
--all-targets` and `cargo fmt --check` clean. This phase was committed in two
checkpoints: domain and persistence first (360 tests at that commit), then
the workspace changes.

**Live-feedback boundary (third checkpoint).** Authorized by Business Model
Spec §10.2 ("hides live feedback that would compromise exam simulation") and
by the session owner's direct instruction defining the boundary: during an
active Assessment the learner must receive no information that reveals,
confirms, grades, coaches, or materially signals the correctness or quality
of ongoing performance. A trace of every mechanism found **no existing
leak**, but the boundary was held only by call order (`submit` evaluates
after completing) and by routing (`LiveScribing` mounts the summary only for
completed sessions). It is now enforced:
- `nexus-core`: `mayRevealPerformance(session)` is false for an assessment
  session in every status except `completed` — including `interrupted` and
  `abandoned`, since neither submits the attempt. `assertMayRevealPerformance`
  throws the new `LiveFeedbackNotAllowedError`. Practice and simulation are
  unrestricted, because no restriction is authorized for them.
- `sessionStore`: an active assessment's autosaved record never carries an
  evaluation; a leaked one is stripped and the draft is still saved.
  `submit` asserts the boundary at the reveal point.
- `SubmissionSummary`: renders nothing, and computes no recommendations, for
  an assessment that is not completed.

+5 `nexus-core` tests (every status in both directions; the error). +8
desktop tests (`assessmentFeedbackBoundary.test.tsx`): no evaluation through
any in-session action, autosave without an evaluation, a leaked evaluation
stripped while the draft survives, the strip scoped to assessment only,
evaluation revealed after submit, and — with a real evaluation injected into
an active assessment to simulate a future leak — the summary rendering
nothing, the route still showing the workspace with no performance text, and
the workspace showing none while errors are being made. Two of these tests
fail against the previous checkpoint (injected-result summary, autosave
strip); the rest guard paths that already held.

**Mutation checks (live-feedback boundary).** Five defects, each caught:
the predicate always revealing (3 core and 2 desktop tests failed), the
autosave strip removed, the summary guard removed, and live evaluation on
every keystroke (caught by the state test, though nothing renders the
result). Every file was restored byte-identical.

**Product decisions.** Recorded in the new
`docs/PHASE_8_3_ASSESSMENT_MODE.md`, with evidence examined for each:
- **D1 — which tier includes Assessment: BLOCKED.** The spec establishes that
  Assessment is entitlement-gated, not which tier; the tier name "Exam-Ready
  Pro" is not a statement of entitlement. No capability was added, since
  any per-tier values (including all-false) would encode feature availability.
- **D2 — live-feedback boundary: principle AUTHORIZED**, implemented above.
- **D3 — what an Assessment learner sees after submitting: NOT AUTHORIZED.**
- **D4 — whether Assessment is closed-book: NOT AUTHORIZED.**
- **D5 — whether Assessment results count in analytics/competency: NOT
  AUTHORIZED.**
- **D6 — retake/resume after an interrupted Assessment: NOT AUTHORIZED.**
Existing mode-agnostic behaviour was left unchanged for D3–D6.

**Verified (third checkpoint):** 252/252 nexus-core, 91/91 desktop, 36/36
Rust — **379 total, 0 failures** (+13). `pnpm -r typecheck` clean. `pnpm -r
build` succeeds (286.02 kB). `cargo check --all-targets` and `cargo fmt
--check` clean.

**Remaining for Assessment mode:** a decision on D1 (then an entitlement
capability, a learner entry point gated by it, and mode-level start
enforcement), and decisions on D3–D6. Phase 8.3 cannot close until D1 is
decided.

---

## Phase 8.2.1 — Database Migration Infrastructure (Complete)

Incorporates Phases 1-8.2 in full. Clears Phase 7 condition **C1**. A
prerequisite increment: it adds the ability to change the SQLite schema
safely, and deliberately **makes no schema change**. The database is still
at version 1 (`001_initial.sql`), and no table, column, constraint or mode
was added. No learner-visible behaviour changed; the frontend production
bundle is byte-identical to Phase 8.2.

**The problem.** `001_initial.sql` was executed unconditionally on every
boot. That only worked because every statement in it is `CREATE ... IF NOT
EXISTS`, and it offered no way to ship a change that is not naturally
repeatable. Assessment mode needs exactly such a change: widening the
`simulation_sessions.mode` CHECK constraint, which SQLite cannot `ALTER`.

**Added `apps/desktop/src-tauri/src/db/migrations.rs`:**

- Migrations are numbered SQL files in `migrations/`, embedded with
  `include_str!` and listed in order in `MIGRATIONS`. The list is validated
  to be contiguous from 1 before anything runs.
- The authoritative version is `application_metadata['schema_version']`,
  exactly as Architecture Package Section 20 has always specified; until now
  that table was created and never written. A database without the row is
  version 0.
- On open, each migration above the stored version is applied in order,
  **in its own transaction together with its version bump**. A migration
  either fully applies and is recorded, or fully rolls back (DDL included)
  leaving the version unchanged. A failure stops the run, so later
  migrations do not apply on top of a failed one, and `init_connection`
  returns the error rather than opening a half-migrated database.
- **Foreign keys and table rebuilds.** SQLite silently ignores `PRAGMA
  foreign_keys` inside a transaction, and dropping a parent table such as
  `simulation_sessions` fails with enforcement on. Each migration therefore
  runs with enforcement switched off *outside* its transaction, runs `PRAGMA
  foreign_key_check` before committing and rolls back on any violation, and
  switches enforcement back on afterwards whether it succeeded or failed.
- **Refuses unsafe states instead of guessing:** a database whose stored
  version is newer than this build (`DatabaseNewerThanApp`), and a
  `schema_version` that is not a valid integer (`CorruptSchemaVersion`).
  Neither modifies the database.

**Upgrade path for existing databases.** Every database created before this
checkpoint has the full 001 schema but no version row, so it reads as
version 0 and 001 runs again — a no-op, because 001 is idempotent DDL — and
version 1 is recorded. No learner data is touched. `001_initial.sql` is
byte-identical to the previous commit. A test pins 001's idempotency (every
CREATE uses `IF NOT EXISTS`; no DROP, ALTER, INSERT, UPDATE or DELETE) so a
later edit cannot silently break this upgrade path. Only 001 needs that
property; later migrations run exactly once and may use ordinary DDL.

**Changed:** `db/mod.rs` — `init_connection` now calls `run_migrations` and
returns `Result<Connection, MigrationError>` (previously
`rusqlite::Result`). Its only caller, `main.rs`, uses `.expect` and needed
no change. The `INITIAL_MIGRATION` constant, which `init_connection` used to
execute directly, was replaced by the `MIGRATIONS` list. A comment in
the existing `tests.rs` that described the old re-run-every-boot behaviour
was corrected; no assertion changed.

**Tests added (18, `db/migration_tests.rs`), all against real on-disk
SQLite:** the shipped list is contiguous and applies; 001 is idempotent DDL
(static and behavioural); a fresh database starts at version 0, and
`init_connection` brings it to the latest version and records it; pending
migrations apply in order (using a deliberately non-idempotent test
migration and a dependent one); only migrations newer than the stored
version apply; rerunning with nothing pending applies nothing; reopening a
migrated database re-applies nothing and keeps data; **a pre-versioning
database with a real session, attempt and evaluation upgrades to version 1
with all of it intact**; a migration that fails halfway rolls back entirely
(its created table does not survive) and keeps the previous version; a
failure stops later migrations; foreign-key enforcement is restored after a
failure; a fixed migration can then be applied; a migration that orphans
rows is rolled back by the foreign-key check; `init_connection` refuses a
corrupt version; a database from a newer build is refused untouched; a
malformed migration list is rejected before anything applies; and a
**rehearsal of the table rebuild Assessment mode will need**, widening
`simulation_sessions.mode` and verifying the existing session, attempt and
evaluation survive, the new value is accepted, invalid values are still
rejected, foreign keys remain enforced against the rebuilt table, and its
indexes are recreated. The rehearsal uses a placeholder mode value in test
code only; no mode was added to the product.

**Tests verified to detect regressions, not merely pass.** Five defects were
injected one at a time into `migrations.rs` and each was caught: never
disabling foreign keys (failed the rebuild rehearsal and foreign-key-violation
tests), skipping `foreign_key_check` (failed the violation test), never
restoring foreign keys (failed 4 tests including the restore test), ignoring
the stored version (failed the only-newer and rerun tests), and removing the
newer-database guard (failed the newer-build test). The file was restored
byte-identical afterwards. Transaction atomicity itself was not
mutation-tested; it is covered directly by the half-applied rollback test.

**Verified this checkpoint:** 239/239 nexus-core tests, 77/77 desktop tests,
32/32 Rust tests (14 existing + 18 new) — **348 total, 0 failures**, up from
330 at Phase 8.2 (+18, all Rust). No pre-existing test was removed and no
assertion changed; the only edit to an existing test file is the comment
noted above. `pnpm -r typecheck` clean. `pnpm -r build` succeeds with an
unchanged bundle. `cargo check --all-targets` clean, `cargo fmt --check`
clean.

**Explicitly NOT implemented in 8.2.1:** Assessment mode, any new mode
value, subscription or entitlement tables, PayMongo, authentication, and any
change to clinical-training logic. **Remaining C1-adjacent limits:** there is
no downgrade/rollback migration support (a newer database is refused, not
reverted); migrations are not backed up before running; and a migration
cannot currently execute Rust code, only SQL. None is needed by the next
planned migration.

---

## Phase 8.2 — ScenarioLibrary Entitlement Gating (Complete)

Incorporates Phases 1-8.1 in full. The first production-facing consumer of
the Phase 8.1 entitlement model.

**User-visible behaviour change.** This is the first commercialization
checkpoint that changes what a learner can do. Because no subscription
persistence or payment provider exists, every learner resolves to **Free**,
whose ceiling is difficulty 2. In the shipped content, SCRIBE-FM-014
(difficulty 1) remains available and **SCRIBE-IM-032 (difficulty 3) is now
locked** — before this checkpoint both were open to everyone. This follows
directly from the audited Phase 8.1 matrix; it is not a new rule.

**Access contract.** A scenario may start only if its existing 1-6
`difficulty` is at or below the resolved `maxScenarioDifficulty`: Free
D1-D2, Practice D1-D3, Pro D1-D4, Fast-Track D1-D6. The Phase 8.1 matrix is
unchanged; no difficulty metadata or scenario content was altered.

**Enforcement lives below the UI.** A pre-flight map of every way into a
session found four entry points — the library's Practice/Simulation buttons,
"Retry this scenario", a recommendation's retry, and resuming an interrupted
session from the Dashboard — and no route that carries a scenario ID. All
four call `sessionStore.start`, so that is where access is enforced. `start`
now returns `boolean`: it checks entitlements before touching any state, and
on refusal creates no session, draft, transcript, result or persisted
record, and leaves any session already in progress untouched. Gating only
the library would have left three live bypasses.

**Pre-existing data-loss path fixed.** `Dashboard.handleResume` abandoned
the interrupted record *before* starting the new attempt. With `start` now
able to refuse, that order would have abandoned a learner's interrupted
session for an attempt that never began — and such records can genuinely
exist, since before this checkpoint anyone could start the difficulty-3
scenario. The new attempt is now started first; on refusal the interrupted
record is kept and the learner is told why. Both retry paths in
`SubmissionSummary` likewise explain a refusal instead of silently doing
nothing.

**Locked presentation.** Locked scenarios stay **visible**: Business Model
Spec Section 5 asks the free set to "naturally expos[e] the benefit of
additional scenarios", which hiding them would defeat. A locked card shows
its title and difficulty, a text "Locked" badge, and the access level that
includes it (e.g. "Intermediate scenarios are included with Practice
Access."). It renders no buttons, so nothing looks actionable; its accessible
name carries "(locked)", so state is not conveyed by colour alone. No price,
checkout, countdown or scarcity claim appears anywhere.

**Commercial policy stays in the domain.** Added to `nexus-core`:
`TIER_LABELS` (the spec's customer-facing tier names) and
`minimumTierForDifficulty` (derived from `CAPABILITY_MATRIX` at call time,
not a second table). A post-implementation search confirmed every tier
literal and every difficulty comparison in non-test source is inside
`entitlement-engine`; `apps/desktop` contains none. The locked-scenario
wording lives once, in `lockedScenarioMessage.ts`, shared by all three
places that display it.

**Subscription-state source.** `apps/desktop/src/store/entitlementStore.ts`
is the single source. It initialises to `NO_SUBSCRIPTION` (resolves to Free)
and has no code path that defaults anyone upward. Its `setSubscription`
exists for tests only and is not wired to any UI, persisted value or
environment variable. The clock is read at this application boundary and
passed into the pure resolver; `nexus-core` still never reads ambient time.
Entitlements resolve once per subscription change for the whole list, not
once per card. Subscription persistence will replace this store's initial
value without any consumer changing.

**Component-test infrastructure (first in the repository).** Added dev-only
`jsdom` 30.0.1, `@testing-library/react` 16.3.3 and `@testing-library/dom`
10.4.2 to `apps/desktop`. `vitest.config.ts` now includes `*.test.tsx` and
uses the automatic JSX runtime; `node` remains the default environment, and
rendered tests opt into jsdom per file, so the 25 existing desktop tests run
exactly as before. No runtime dependency changed, and the production bundle
grew by about 1 kB.

**Tests added (60).**
- `nexus-core` `resolve.test.ts` +8: `minimumTierForDifficulty` for all six
  levels, agreement with the matrix at every level, and `TIER_LABELS`.
- `store/entitlementGating.test.ts` (35): the full 4-tier x 6-difficulty
  matrix through `sessionStore.start`; bypass tests that call the boundary
  directly with no UI; no side effects on refusal; an in-progress session
  surviving a refused start; valid, bare-string, Free/Practice-purchase and
  expired Fast-Track; the safe Free default; Practice's audited 8.1
  capabilities still locked; no input mutation.
- `live-scribing/ScenarioLibrary.test.tsx` (15, rendered): per-tier
  boundaries and the full six-level matrix as displayed; locked cards
  visible, text-identified, naming the right tier, with no buttons and no
  pricing language; a locked card starting nothing when clicked; Practice
  and Simulation still starting from unlocked cards; re-rendering on
  subscription change; real shipped content under the Free default.
- `routes/Dashboard.test.tsx` (2, rendered): a locked interrupted session is
  kept intact with an explanation; an unlocked one still resumes and is
  abandoned.

**Tests verified to detect regressions, not merely pass.** With the guard
in `sessionStore.start` temporarily disabled, exactly the 16 refusal-
dependent gating tests failed (9 refused cells of the access matrix, 4
bypass tests, 3 Fast-Track refusals) while the 19 allow-path tests passed.
With `Dashboard.handleResume` temporarily reverted to its original order,
the locked-resume test failed. Both files were restored byte-identical
before final verification.

**Commit attribution.** Commit `1306eca` ("Phase 8.1") was made while this
increment was in progress, and captured three early Phase 8.2 changes that
were inert at that commit: the three test devDependencies (and
`pnpm-lock.yaml`), the `TIER_LABELS` export, and the `TIER_ORDER` import in
`resolve.ts`. They are described here because they are Phase 8.2 work; the
Phase 8.1 entry below correctly does not mention them.

**Verified this checkpoint:** 239/239 nexus-core tests (33 files), 77/77
desktop tests (9 files), 14/14 Rust tests — **330 total, 0 failures**, up
from 270 at Phase 8.1 (+60). No pre-existing test was modified or removed:
the only line deleted from any test file is an import widened in place.
`pnpm -r typecheck` clean. `pnpm -r build` succeeds. `cargo check
--all-targets` clean, `cargo test` 14/14, `cargo fmt --check` clean.

**Explicitly NOT implemented in 8.2** (verified absent): subscription
persistence or tables, the migration runner (Phase 7 condition C1 remains
open), any `PaymentProvider`, PayMongo, checkout, billing, webhooks,
authentication, cloud sync, locked score detail or other paywall states,
Assessment mode, and any new scenario content. Phase 7 condition C3 is
addressed only for the scenario library and Dashboard resume; other
surfaces remain without rendered tests. A12 remains open and is now more
visible: only one scenario is startable by default, and no difficulty-4, -5
or -6 content exists for Pro or Fast-Track to unlock.

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

Phase 8 covers commercialization and Phases 9-13 later platform expansion — see `docs/HAA_Nexus_Architecture_Package.md` and `docs/BUSINESS_MODEL_PRODUCT_SPEC.md`. Phase 8.1 (Entitlement Domain Model), Phase 8.2 (ScenarioLibrary Entitlement Gating) and Phase 8.2.1 (Database Migration Infrastructure) are complete. Phase 8.3 (Assessment Mode) is in progress: its domain rule and database migration exist, but it has no UI entry point or entitlement gating yet. No paywall states, locked score detail, subscription persistence, PayMongo, billing, cloud authentication, or web deployment work exists in the repository.

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
