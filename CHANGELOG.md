# Changelog

This is a single, continuously-built monorepo. Every phase below is
**cumulative** — each phase's checkpoint includes all prior phases' code,
tests, and content, verified together in one test/typecheck/build run. No
phase has ever been delivered as an isolated patch against a different base.

Status legend: **Complete** (implemented + tested this checkpoint) · **In
Progress** (started, not yet verified) · **Not Started** (by design, per the
phase order in `docs/HAA_Nexus_Architecture_Package.md`).

---

## D6 Resolved — An Interrupted Assessment May Be Retaken (2026-09-20)

**Decision under delegated authority. No production code changed.** A learner
may retake an interrupted Assessment as a new attempt; exact in-place resume is
not offered. The interrupted attempt is recorded as `abandoned` rather than
deleted, and contributes nothing.

**Resume was not selectable, and that is a rule rather than a preference.** A6
records that exact mid-transcript resume is unimplemented and is *the
engineering half of D8*: restoring an attempt changes elapsed time, which feeds
`timeEfficiencyRatio` and therefore the score. Selecting it would have decided
D8. The real option space was retake, or no retake at all.

**Retake rather than a terminal lock.** A "no retake" rule would permanently
cost a learner a scenario because their machine crashed - destructive,
irreversible, and invented by no source. The exam-integrity worry behind such a
rule is score-shopping, and it does not apply: **D2** shows the learner no
performance information during an active Assessment, so there is nothing to
shop against, and **D5** means an interrupted Assessment carries no evaluation
and counts in neither population. A retake cannot launder a bad score because
no score exists. The abandoned record keeps the audit trail.

**Why no production change was required.** The existing Dashboard flow already
implements exactly this policy: it offers "Start a new attempt" and "Discard",
never a resume, and it starts the new attempt *before* abandoning the old
record so a refused start cannot destroy the learner's work. D6 authorizes that
behaviour; `interruptedAssessment.test.tsx` (7 tests) is what now stops it
being changed by accident.

**Adversarial checks confirmed the boundary is load-bearing:** abandoning the
record before the start succeeds failed 2 tests, and carrying the old attempt's
id forward - a disguised resume - failed 1. Both files restored byte-identically.

**D5 acceptance, in the same pass.** The historical competency migration was
re-checked against repository history rather than assumed: the Assessment entry
point first existed at `34f727c`, so every competency record written before it
is unambiguously practice or simulation. Between then and D5 an Assessment
could in principle have folded into the shared record, but only under a Pro or
Fast-Track subscription, and no persistence or tier-switching surface exists
(D10) - so no production path did. `Simulation → Practice`, the preserved
recommendation behaviour and the unchanged Dashboard were each re-verified;
the recommendation engine and Dashboard are untouched by D5.

**Verification.** 379/379 nexus-core, 215/215 desktop (+7), 55/55 Rust
unchanged and not re-run (D6 touched no Rust), typecheck clean, build clean,
17/17 preflight.

**Browser.** The interrupted-session flow was exercised at
`http://localhost:1420/`: a paused Practice attempt appeared under "Interrupted
session" offering only "Start a new attempt" and "Discard" - no resume - and
taking the retake moved the old record to `abandoned` in the history and
started a fresh attempt. **This was a Practice session, not an Assessment**:
an interrupted Assessment needs Pro and no tier-switching surface exists (D10).
It is the same Dashboard code path, but that is the shared path, not an
Assessment run.

**Every Phase 8.3 Assessment decision is now resolved (D1-D6).** D7, D8 (with
A6) and D9 remain open and are outside Assessment mode.

---

## D5 Resolved — Assessment Results Count Separately from Practice (2026-09-20)

**Owner decision.** A completed Assessment contributes to **Assessment**
competency and **Assessment** analytics, and to nothing else. It must not
mutate, overwrite, or become indistinguishable from Practice competency, and
must not be folded into Practice aggregates. The two are separate
authoritative signals: training activity, and performance under formal exam
conditions.

**Separate means separate through persistence, not a label or a filter.**
`ResultPopulation` and `resultPopulationFor(mode)` in the domain;
`CompetencyRecord.population`; the repository keyed `get(population, domain)`,
so there is no call that returns "the" record for a domain any more; **migration
003** rebuilding `competency_records` as `UNIQUE(user_id, population, domain)`
with the id as `user-population-domain`; and `computeAnalytics(population, ...)`
where the population is a *required* argument and the filtering happens inside
the domain function - so no caller can produce a merged total by forgetting to
filter. `updateCompetencyRecord` throws rather than fold a score into another
population's record.

**Simulation counts as practice**, exactly where it always counted. D5
separated Assessment from Practice and said nothing about simulation; giving it
a third population would have been deciding something nobody decided.

**Migration 003 assigns existing rows to `practice`.** Every record written
before this came from the old mode-agnostic fold, and Assessment was
unreachable for most of that period. That keeps a learner's training history;
it does not claim those attempts were assessments. The dev-browser store
applies the same rule to records that predate the field.

**Recommendations were deliberately left alone, and that is the open
question.** `generateRecommendations` still reads all evaluated sessions across
both populations. D5 governs competency and analytics, which recommendations
are neither, and no recommendation policy was supplied - scoping them would
have invented one. **Still undecided: should recommendations after an
Assessment be derived from Assessment history, Practice history, or both?**

**No access control changed.** D5 is about how completed results are counted.
Analytics and the Dashboard remain reachable exactly as before, no route guard
or nav change was added, and D4's `ReferenceGate` still covers only the
Knowledge Base and Training. The content archive was not touched: no repository
was coupled to session mode and no content gained competency metadata.

**Files.** `types/result-population.ts` (new), `competency-engine/index.ts`,
`persistence/competency-repository.ts`, `analytics-engine/compute.ts`,
`store/sessionStore.ts`, `routes/Analytics.tsx`, `tauriCompetencyRepository.ts`,
`devBrowserRepositories.ts`, `migrations/003_competency_population.sql` (new),
`db/competency.rs`, `db/models.rs`, `db/migrations.rs`, `commands.rs`, and the
`competency-record.json` IPC fixture.

**Mutation-checked.** Dropping the population from the persistence key (6
failures), dropping the analytics filter (7), swapping the two populations (28)
and collapsing them into one (11) each failed the suite. Every file restored
byte-identically.

**Verification.** 379/379 nexus-core (+23), 208/208 desktop (+9), **55/55 Rust**
with `cargo fmt --check` and `cargo clippy --all-targets` clean, typecheck clean
across the workspace, build clean, 17/17 preflight. Rust *was* re-run this time,
because D5 changed the schema.

**Browser.** At `http://localhost:1420/` the Analytics page now shows two
labelled sections and no combined figure. A real Practice submission moved the
Practice section from 3 to 4 scored sessions and updated its competency, while
the Assessment section stayed at zero attempts. **The populated Assessment side
could not be exercised in-browser** - it requires Pro and no tier-switching
surface exists (D10) - so that half is covered by the end-to-end tests through
the real submit path, not by clicking.

**D1-D4 intact. D6 remains unresolved and untouched.**

---

## D5 Audit — Analytics and Competency Treatment Remains Undecided (2026-09-20)

**An audit, not a decision. No production code changed.** D5 - whether
Assessment attempts count in analytics and competency - is recorded as
NOT AUTHORIZED and no option was supplied, so none was chosen.

**Nothing is partially implemented.** `sessionStore.submit` folds an attempt's
seven category scores into competency with no mode check, `computeAnalytics`
filters only on "has a finite evaluation" and never on mode, and the Dashboard
history lists every record's score without distinguishing mode. An Assessment
attempt is indistinguishable from a Practice attempt everywhere downstream.

**The three options do not cost the same, which is the point of the audit.**
Separating *analytics* needs no schema change at all - `mode` is already
persisted on every `SessionRecord` and `computeAnalytics` simply does not read
it. Separating *competency* needs a migration: `competency_records` is
`UNIQUE(user_id, domain)` with no mode dimension, so it would require migration
003, the Rust DTO and repository, and a change to the `CompetencyRecord` shape.
The two halves can therefore be answered independently, and an owner choosing
"separately" should know one half is nearly free and the other is not.

**D5 changes D3's inputs.** `generateRecommendations` reads all evaluated
sessions with no mode filter, so recommendations are derived partly from
Assessment history. D3 authorized the recommendation surface, not which
attempts feed it - separating or excluding Assessment results would quietly
change what D3 shows.

**A gap that belongs to no decision.** D4 closed the Knowledge Base and
Training during an active Assessment. Analytics and the Dashboard were
deliberately excluded from D4 and remain reachable mid-attempt, showing
aggregate performance from earlier attempts. That is not D2 (this attempt's
performance), not D4 (answered for reference material only), and not D5 as
worded (what counts, not what is visible during). Recorded so it is a decision
rather than an oversight.

**The tier axis is unenforced too, and is not D5.** `CAPABILITY_MATRIX`
declares `canTrackCompetency` and `canViewAnalytics` false/false/true/true, but
no application code reads either, so every tier gets both. Wiring it up would
decide that by implementation, so it was left alone.

**No tests were added.** There is no D5 rule to pin, and no enforcement
boundary exists to mutation-test. Characterizing today's mode-agnostic fold
would pin behaviour that the pending decision is expected to change.

**Verification.** Documentation only. 356/356 nexus-core, 199/199 desktop,
desktop typecheck clean, build clean, 17/17 preflight - run to confirm D1-D4
remain intact, not because this checkpoint touched code. Rust untouched and not
re-run.

**Left untouched:** the pre-existing repo-wide typecheck failure at
`question-bank/schema.test.ts:48` from the merged D11 work, which is being
handled separately.

**D1-D4 intact. D5 remains BLOCKED - owner decision required. D6 unresolved and
untouched.**

---

## Question Bank Repository and Read-Only Loader (2026-09-20)

**The seam, not the runtime.** The canonical Question Bank had a schema and a
validator but no way to get content into a consumer. This adds that layer and
nothing beyond it: **there is still no selector.** Nothing randomises, sequences,
builds a 10-question run, tracks seen items or decides what a learner sees.

**`QuestionBankRepository` — three methods, deliberately.** `getById`,
`getAll`, and `getProductionEligible`. A future Training run, a remediation
surface and a future Learning Assessment all need *"give me the questions"* and
*"give me this one"*; none needs a query language, and inventing one would
encode guesses about selection nobody has made. *Implementation decision —
autonomous.*

`getProductionEligible()` is a **safety gate, not a query** — it applies the
existing `isProductionEligible`, which already requires content status, review
outcome *and* a recorded human verification to agree. It is how a learner-facing
consumer avoids being handed candidates by default, and it promotes nothing.

**`InMemoryQuestionBankRepository`** mirrors `InMemoryTrainingLessonRepository`,
with two guarantees added because bank content carries provenance and a review
lifecycle that must not drift: stored records are **private, deep-frozen
clones** (a consumer cannot edit a question's status, rationale or source
through a reference it was handed, and registering does not freeze the caller's
own object), and **reads are deterministic** (registration order every time, a
fresh array each call). A duplicate id throws rather than overwriting — one
question would silently disappear, and with a citation attached that is a
question whose source no longer matches its text.

**The loader is split in two, and that is a constraint rather than a
preference.** `nexus-core` production code contains no `node:` imports anywhere
and the desktop app bundles the package for the browser through Vite, so
`node:fs` on the public surface would break that build. `loader.ts` is
platform-neutral and takes file contents somebody else has read; `loader-node.ts`
does filesystem discovery and is **deliberately absent from the package index**.
Verified, not assumed: the shipped browser bundle contains no `node:fs` and no
loader-node symbol. *Implementation decision — constrained by existing
requirements.*

Loader behaviour: every problem in every file is reported rather than the first;
**nothing loads unless everything validates**, because a partial load means a
consumer silently working from a subset of a bank that carries provenance; ids
must be unique across the whole bank, not merely within a file; and **status
survives untouched** — a candidate that goes in comes out a candidate.

**Assessment readiness — inspected, and deliberately not built on.** The finding
matters: **Assessment today is a session mode over *scenarios*, not a
question-based exam.** It grades a documentation draft against a Scenario's
`requiredDocumentation` through the evaluation engine, and contains no question
model at all. D1, D2, D3 and D4 are owner-authorized; D5 and D6 remain blocked.

**No Assessment consumer interface was created**, because the current Assessment
specification defines no question-based content requirement to anchor one to —
writing it would mean inventing product semantics. The repository interface is
already consumer-neutral, and that is the preparation.

One engineering observation, flagged rather than decided: if a future Assessment
draws from the same pool Training practises on, a learner can meet an exam
question during practice, which defeats the exam. The bank can express either
arrangement with no schema change. Which is correct is **PRODUCT DECISION —
BLOCKED**. Nothing here assumes an answer, and no Assessment scoring, pass
threshold, entitlement, completion rule or certification semantics was written.
No medical Assessment content was generated — authoring belongs to the Nexus
Project archive under its source rules, not to Claude Code.

**Pilot 001 unchanged.** Still `05fa24d0…aaf3d`, still 12 items
`CANDIDATE` / SOURCE-VERIFICATION-PENDING, still 0 production-eligible. It now
also proves the *repository layer* can carry real authored content: adapted in
memory, loaded through the real loader, every canonical field intact, and
`getProductionEligible()` returns an empty list. It remains development/test
data — not under `content/`, read by no loader in the application.

**Verification.** 593/593 tests (394 nexus-core across 44 files — the previous
356 plus 38 new — and 199 desktop across 22), typecheck clean, build clean,
preflight exit 0 with 17/17 preflight self-tests. Question-bank suite: 86 tests
across 7 files. Re-verified after merging the D5 analytics/competency audit from
`main`. Rust untouched and not re-run.

---

## D4 Resolved — Assessment Runs Closed-Book (2026-09-20)

**Owner decision.** Knowledge Base OFF, Training OFF, direct route access
BLOCKED, no tier exception. Supplied explicitly; recorded as the owner's
decision, not an engineering choice.

**One boundary, in the domain.** `mayAccessReferenceMaterial(session)` in
`nexus-core` decides it: no attempt and practice/simulation are unrestricted,
an assessment is blocked unless it is `completed`. It takes a session and no
tier, so Pro and Fast-Track cannot diverge - D1 decides who may *enter* an
assessment, D4 decides the conditions *inside* it.

**Guarded at the route, because the nav rail is not a boundary.**
`ReferenceGate` wraps `/knowledge-base` and `/training` in the router, so a
typed URL, a bookmark and a programmatic `navigate()` are all blocked - they
all render the route element. Hiding the two nav links is a courtesy so a
learner is not offered something that would refuse them. The router and the
nav rail import the same `REFERENCE_ROUTES` list, so a third reference surface
cannot be added to one and forgotten in the other.

**The `completed` test is what keeps D3 intact.** The books reopen exactly when
the attempt is submitted, so the full post-submission experience - including
the expected-answer comparison - is unchanged. A test walks the whole
lifecycle: allowed before, blocked during, allowed again after.

**The knowledge archive was not restricted, and that distinction is the point.**
`content/` - scenarios, terminology, lessons and the new question bank -
remains available in full to authoring, validation and content tooling, and
`content/scenarios.ts` still loads every repository at startup exactly as
before. Nothing was moved, deleted, gated, or given entitlement metadata, and
no repository was coupled to session state. D4 closes a runtime learner surface
during an attempt; it does not touch the archive that feeds it. The boundary
test caught this itself - it first flagged the content layer as an offender,
and the fix was to scope the scan to *consumers*, not to restrict the content.

**Mutation-checked.** Removing the route guard so that only the nav rail
restricted access failed 5 tests - that is precisely the UI-only enforcement
this decision forbids. Making the rule always allow failed 6; making it block
every mode rather than assessment failed 4. Every file restored
byte-identically.

**Verification.** 356/356 nexus-core (+12), 199/199 desktop (+17), desktop
typecheck clean, build clean, 17/17 preflight. Rust untouched and not re-run.

**A pre-existing failure, not mine, and not fixed here.** `pnpm -r typecheck`
fails on one strict-null error in `question-bank/schema.test.ts:48`
(`parsed.choices[0].why`), introduced by the merged D11 question-bank work and
untouched by this checkpoint. It is reported rather than silently fixed,
because a one-line edit to someone else's in-flight test does not belong in a
D4 diff.

**Browser.** Verified at `http://localhost:1420/`: with no session the
Knowledge Base renders in full, and during an active **Practice** session it
still renders with all six nav links present - D4 left practice untouched.
**The blocked Assessment state could not be exercised in-browser**: it requires
Pro and no tier-switching surface exists (D10), and adding one would be
production scaffolding for a test. Assessment enforcement is covered by 17
tests that render the real router at a real URL, which is the same code path a
typed URL takes.

**D1 and D3 intact. D5 and D6 remain unresolved and untouched** - competency
and analytics treatment, and interruption/resume behaviour, were neither
examined for policy nor modified.

---

## D4 Audit — Assessment Is Open-Book by Omission (2026-09-20)

**An audit, not a decision. No production code changed.** D4 - whether an
Assessment is closed-book - remains the owner's to answer.

**Finding.** An active Assessment is fully open-book, and nothing enforces
anything. `App.tsx` declares six flat routes with no guards, no redirects and
no `useBlocker`; `AppShell` renders the same nav rail whatever the session is
doing. `KnowledgeBase.tsx`, `Training.tsx`, `AppShell.tsx` and `App.tsx`
contain **zero** references to the session store, the entitlement store or the
session mode. There is no hidden button to find and no direct-URL bypass to
report, because there is no boundary in the first place - the reference
surfaces do not know a session exists.

**The detail that matters for the decision.** The Knowledge Base is keyed
lay-term → clinical-term with accepted alternatives, and the evaluator scores
the Terminology category on exactly those conversions. Searching it for
"shortness of breath" mid-session returns **dyspnea** - which is what
`SCRIBE-FM-014` requires the learner to document. For one scored category the
reference material is close to an answer key. That is a fact about the
content, offered as evidence for either policy, not an argument for one.

**Also recorded:** an Assessment cannot pause, so time spent reading reference
material counts against Time Efficiency. Whether that is a fair natural cost
is part of the same question.

**Browser.** Verified at Practice, the only mode reachable at the default Free
tier: mid-session navigation to the Knowledge Base returned the dyspnea entry,
Training listed all three lessons, and returning to Live Scribing found the
session still running with the clock advanced. **Assessment could not be
exercised in-browser** (requires Pro; no tier-switching surface exists, D10).
The Assessment path is established from source instead - conclusive here
precisely because the surfaces contain no mode logic at all.

**No test was added, deliberately.** The finding is the *absence* of a guard,
provable from the route table and those four files. A test asserting "the
Knowledge Base renders during an Assessment" would fail the moment D4 is
answered restrictively, which is the next expected change - a tripwire on
planned work is not coverage. No production behaviour was altered to make the
audit easier, and no tier-switching scaffolding was added.

**D1, D2 and D3 unchanged. D5 and D6 remain unresolved and untouched** -
competency/analytics treatment and interruption behaviour were not examined
for policy and not modified.

**D4 remains BLOCKED — owner decision required.** The surface: whether the
Knowledge Base is available during an active Assessment; whether Training is;
if restricted, whether that is enforced at the route or only in the nav rail;
and whether the answer varies by tier.

---

## D3 Resolved — Assessment Post-Submission, All Six Surfaces ON (2026-09-20)

**Owner decision.** An Assessment learner receives the full post-submission
experience: score, category breakdown, WHAT/WHY/HOW feedback,
expected-answer comparison, recommendations, and immediate retry. Supplied
explicitly by the owner; recorded as their decision, not an engineering
choice.

**No behaviour changed, and that is the finding.** The characterization done
earlier the same day had already established that the existing mode-agnostic
summary does all six. Implementing D3 therefore meant protecting what exists
rather than writing new results code. No Assessment-specific renderer was
added - a second results surface would be one more thing to keep in sync, for
no gain. The one production change in this checkpoint is none: the diff is a
test file and documentation.

**"Already true" is not "protected".** Before this, nothing failed if an
Assessment quietly stopped showing its score, its feedback or its
recommendations. `assessmentPostSubmission.test.tsx` (15 tests) now pins all
six surfaces through the real component.

**Recommendations means the whole engine.** The results surface exposes
whatever `generateRecommendations` produces for the completed attempt - every
rule, in the engine's order, including none - and does not filter, reorder or
cap. All four supported rules are covered through the real component:
`repeated-hpi-omission` and `repeated-terminology-errors` (lesson),
`repeated-time-failures` (scenario retry), and `fabrication-detected`. That
last one fires on a single occurrence, which is what proves the attempt *just
submitted* is part of the history the summary reads - otherwise
"recommendations for the completed attempt" would quietly mean "for the
previous ones". The multi-recommendation test asks the engine itself what a
seeded history should produce and asserts the rendered list equals it, so the
test can never disagree with the engine about the rules. **No rule, threshold,
type or ordering was invented or changed.**

**Retry does not bypass D1.** It goes through `sessionStore.start` like every
other entry point. A test drops the entitlement between submission and retry
and asserts the retry is refused, the learner is told why, and the completed
session is left untouched. D3 grants a retry action; it does not grant
entitlement. No cooldown or quota was added in either direction.

**Mutation-checked.** Four mutations confirmed the tests bite: suppressing the
recommendation card (4 failures), rendering only the first recommendation (1),
dropping the note comparison's expected column (1), and retrying in the wrong
mode (2). Every file was restored byte-identically afterwards.

**Verification.** 296/296 nexus-core, 182/182 desktop (+10 net), typecheck
clean, build clean, 17/17 preflight. Rust untouched and not re-run.

**Browser.** A Practice attempt was submitted at `http://localhost:1420/`
containing a fabricated vital sign. The results page showed all six surfaces
for real, including **two simultaneous recommendations in the engine's order**
(HPI Fundamentals, then Accuracy and Unsupported Inference) with working
"Open lesson" actions, and the critical fabrication error explained in
WHAT/WHY/HOW form. The scenario library still showed **no Assessment button**
at Free, confirming D1 intact. **An Assessment itself could not be exercised
in the browser** - the app has no tier-switching surface because subscription
persistence is D10, and adding one purely to obtain evidence would be
production scaffolding for a test. Since the Assessment and Practice paths are
the same component with no mode branch, the browser evidence covers the code
an Assessment runs, but it is not an Assessment run: stated rather than
implied.

**D4, D5 and D6 remain unresolved and were not changed.** The expected-answer
comparison after submission does not authorize Knowledge Base access *during*
an Assessment (D4). Assessment attempts still count in competency and
analytics exactly as before - D3 left that untouched rather than ratifying it
(D5). Interruption, abandonment and resume behaviour is untouched (D6).

---

## D3 Characterized, Not Decided — Assessment Post-Submission (2026-09-20)

**An audit, not a feature.** D1 made Assessment reachable, which made its
post-submission behaviour something learners actually see. That behaviour was
traced and written down. **No product policy was selected, and no Assessment
behaviour changed.**

**What the code does today.** `routes/LiveScribing.tsx` renders
`SubmissionSummary` for *any* completed session, and `SubmissionSummary`
branches on nothing but the data - there is no mode check anywhere in the
post-submission path. A submitted Assessment therefore receives exactly what
Practice receives: the overall score out of 100 with active time and flag
count, all seven category scores, per-error WHAT/WHY/HOW feedback, the
§34(10) note comparison *including the expected column*, performance-derived
recommendations, the learner's own draft played back, and two controls - "Back
to library" and "Retry this scenario", with no cooldown, attempt limit or
review lock. The attempt is saved to history carrying its evaluation and
folded into competency and analytics like any other.

**That list is evidence, not policy.** Every item predates Assessment being
reachable. Recording it here does not approve it, and D3 remains the owner's
to answer.

**Characterization test added.**
`assessmentPostSubmission.characterization.test.tsx` (5 tests) pins the
observable behaviour, including that Assessment and Practice render the same
surfaces. It says in its own header that it is expected to fail and be
rewritten once D3 is decided - that is the point of it: to make a change to
the Assessment results experience deliberate rather than incidental.

**A pre-existing gap found while tracing, and deliberately not fixed.** Three
matrix capabilities - `canViewDetailedScoreBreakdown`, `canTrackCompetency`
and `canViewAnalytics` - are declared per tier but read by no application
code. The full category breakdown is shown to every tier, competency is folded
for every tier, and analytics counts everything. This is older than D1 and is
not an Assessment behaviour. Wiring any of them up would decide D3 or D5 by
implementation, so nothing was wired.

**Stale status text corrected.** `PHASE_8_3_ASSESSMENT_MODE.md` still said no
learner could start an Assessment and listed D1 as blocked. D1 is now recorded
as resolved there, with the evidence gathered while it was open kept for the
record, and the remaining-work table updated. D3-D6 remain blocked.

**Verification.** 296/296 nexus-core, 172/172 desktop (+5), typecheck clean,
build clean, 17/17 preflight. Browser: a Practice attempt was submitted at
`http://localhost:1420/` and the full post-submission surface was observed
end to end (78/100, three feedback items, note comparison, draft playback,
both controls). **An Assessment could not be exercised in the browser** - the
app has no tier-switching surface, because subscription persistence is D10,
and adding one purely to obtain evidence would have been production
scaffolding for a test. Assessment post-submission behaviour is therefore
evidenced by tests and by the shared code path, not by clicking. Rust was
untouched and not re-run.

**D3 remains BLOCKED - owner decision required.**

---

## D11 Resolved — Canonical Training Question Bank (2026-09-19)

**Product decision — owner authorized.** The owner selected **Option B —
Separate Reusable Training Question Bank**: canonical Training questions are
their own records, independent of any lesson. This was supplied explicitly and
is recorded as the owner's decision, not an engineering choice. Recorded in
`docs/DECISION_REGISTER.md` D11.

**What was built — the content contract, and nothing downstream of it.** A new
`question-bank` module in `nexus-core`: a schema, a reusable validator
(`validateTrainingQuestion`, `validateQuestionBank`) following the
`validateScenario` convention of hard failures rather than warnings, and four
test files. A question carries a stable id, id-addressed choices, a required
rationale, optional per-choice explanations, required provenance, optional
coding/ICD metadata, a variant group, a content lifecycle and a verification
record.

Two failure modes the current `KnowledgeCheck` shape allows are impossible
here: `correctChoiceId` must resolve to a declared choice (today's
`correctOptionIndex` is not bounds-checked against `options`), and choice
identity is an id rather than a position, so reordering for display cannot
silently change the answer.

**No silent field loss.** Every object is `.strict()`: an unrecognised key is a
hard error naming the field. The lesson schema's behaviour — dropping unknown
keys without a word — is how a rationale or a citation could be authored,
accepted, and then simply not exist. *Implementation decision — constrained by
existing requirements*, and the one place the bank deliberately departs from
lesson-schema behaviour. `TrainingLessonSchema` itself was not changed.

**A candidate cannot become production-ready by being parsed.** A question may
not claim a lifecycle state above `candidate` unless a person is recorded
against it (`verification.humanVerifiedBy` and `humanVerifiedOn`), and
`verification` has no default. `isProductionEligible()` is read-only and
conservative — status, review outcome and a recorded verification must all line
up — and the promotion workflow that would legitimately set those values is
deliberately not implemented.

**Pilot Batch 001 is a fixture, unchanged and unpromoted.** Revision 2 is held
byte-identical at
`packages/nexus-core/src/question-bank/__fixtures__/`, with its SHA-256 asserted
against the handoff manifest. All 12 items validate against the canonical model
and every item-level field is preserved (`id` → `questionId` is the only
rename). Nine batch-level keys are **not** carried — `createdOn`,
`schemaStatus`, `difficultyScale`, `icdSystemPolicy`,
`sourceVerificationMethod`, `versionNote`, `blockedTopics`, `batchSummary`,
`revisionNotes` — all of which describe the authoring batch rather than any
question; the test pins that split so a new pilot field with nowhere to go fails
by name. The 12 items remain `CANDIDATE` / SOURCE-VERIFICATION-PENDING with 0
production-eligible, human source-locator verification stands at **0 of 12**,
and nothing in this checkpoint marks any item source-verified.

**Legacy lessons untouched.** `TrainingLessonSchema`, the three shipped lesson
files, their six knowledge checks and the Training screen are unchanged. No
lesson was migrated and no learner behaviour changed. The two models coexist by
design; whether those checks stay, coexist or migrate is a further owner
decision this one did not answer.

**Implementation decisions — autonomous.** `question-bank` as a sibling engine
module rather than a subfolder of `training-engine` (its consumers are not only
Training). `content/question-bank/` as the content location — scanned by none of
`content/lessons/`, `content/incoming/` or `content/scenarios/**`, with its own
content-QA test, shipped empty. Supporting both a shared `sources` ref and a
self-contained inline citation. Closed sets for question type and review status,
drawn from content that exists rather than invented. `blocked` and `retired` as
lifecycle hold states. Restating the 1–6 difficulty scale locally with a test
asserting it agrees with the scenario side, rather than coupling a Training
content contract to the scenario engine.

**Explicitly not decided, and not encoded anywhere:** entitlement (no Training
capability exists; `difficultyLevel` is an authoring signal, not a tier),
seen-item persistence (depends on D10), the runtime selector and 10-question
runs, randomisation and anti-memorisation, scoring, competency mapping,
recommendations, Assessment Mode, and medical truth. **This is a foundation, not
a Training feature** — the bank has no runtime consumer at all.

**Documentation.** `docs/TRAINING_QUESTION_BANK.md` (new), `docs/DECISION_REGISTER.md`
D11, Architecture Package §16, and a README in `content/question-bank/`.

**One incidental fix.** A `.gitattributes` (the repository's first) marks the
Pilot 001 candidate files `-text`. They are identified by SHA-256 in the handoff
manifest and in the compatibility test; on a Windows checkout git would have
rewritten their line endings and changed those bytes, failing the integrity
check for a reason unrelated to their content.

**Verification — INCOMPLETE. No Node toolchain on this device.** `node`, `npm`
and `pnpm` are not installed and `node_modules` is absent, so `pnpm -r test`,
`pnpm -r typecheck`, `pnpm -r build` and `node tools/preflight/preflight.mjs`
**could not be run**. This entry therefore claims no test count, and the
question-bank suite has **never been executed**. What *was* verified, with a
standalone Node binary and no project dependencies: every file parses, and an
independent dependency-free restatement of the schema's rules, run against the
real pilot fixture, passes — 12 questions, 7 sources, hash matching the manifest,
0 above candidate, 0 human-verified, 0 production-eligible, no unrepresented
field. That checks the *data* against the contract; it does not execute the
TypeScript. **The suite must be run before this work is relied on.** Rust was
untouched. Delivered on a feature branch for exactly this reason.

---

## D1 Resolved — Assessment Mode Requires Pro (2026-09-19)

**Owner decision.** The owner selected **Pro** as the minimum subscription
tier that may start Assessment mode: Free and Practice blocked, Pro and
Fast-Track allowed. This was supplied explicitly and is recorded as the
owner's decision, not an engineering choice.

**Implementation.** One capability, `canStartAssessment`, added to the existing
`Entitlements` shape with per-tier values in `CAPABILITY_MATRIX`.
`canStartMode(entitlements, mode)` in `nexus-core` maps a mode to the
capability it needs, `sessionStore.start` enforces it beside the existing
difficulty check, and the Scenario Library renders an Assessment button only
for entitled tiers. No parallel entitlement mechanism and no "assessment
tier" concept.

**Enforcement is not the button.** The start boundary refuses a blocked tier
whether it is reached from the library, a retry, a resume, or a direct call,
and a refusal creates no session, draft, transcript or record. Tests call that
boundary directly, with no UI involved, which is what a bypass would do.

**An invariant caught a genuine mistake mid-implementation.** The first
version wrote `mode === "assessment"` inside `sessionStore`, and
`liveFeedbackBoundary.invariant.test.ts` failed: that test forbids the
desktop app re-implementing a rule that belongs in the domain. It was right.
The mode-to-capability mapping moved into `nexus-core` as `canStartMode`,
which is where the matrix already lives. The test was not weakened to
accommodate the code.

**Tests updated, not weakened.** The Phase 8.3 live-feedback and workspace
suites started assessments under the default Free subscription, which D1 now
blocks. They grant Pro in their fixture and say why: those suites test the D2
boundary and the workspace, not who may start.

**Verification.** 296/296 nexus-core (+13), 167/167 desktop (+13), typecheck
clean, build clean (830ms), 17/17 preflight. Rust was untouched and not
re-run. In the live UI at `http://localhost:1420/`, Free shows Practice and
Simulation but **no Assessment button**, and the normal Practice flow still
starts (session, transcript and Pause all present).

**Limitation.** Pro and Fast-Track could not be exercised *through the
browser*: the app has no tier-switching surface, because subscription
persistence is D10 and remains unresolved. Those tiers are verified at the
authoritative boundary by tests, not by clicking. Stated rather than implied.

**Nothing else was resolved.** Assessment being reachable makes existing
mode-agnostic behaviour observable, which is not the same as deciding it:
D3–D6 remain open, along with D7–D10, A2, A6, A7, A9 and A12. Difficulty
limits (2/3/4/6) are unchanged, and no payment, authentication or subscription
persistence was added.

---

## Scenario Intake for Clinical Authoring (2026-09-19)

**Autonomous implementation decision.** A12 is blocked on clinical authoring,
not on engineering — but an author should not have to discover the schema by
trial and error, or wait for a reviewer to find a missing field.
`content/incoming/` is now a staging folder with a template and an intake
suite that reports, per file, exactly which fields are missing or malformed.

**One definition of valid.** Intake calls the same `validateScenario` the
application uses. It deliberately does not restate the schema, because a
second definition would drift from the first.

**What it checks:** drafts satisfy the real schema; no draft reuses the
`scenarioId@version` of released content (which would break the content-hash
gate and make a stored attempt ambiguous about what it was scored against); no
two drafts collide; and the template itself still validates, so an author
starts from something that passes.

**What it does not check: clinical truth.** Whether a finding is correct,
safe, internally consistent or appropriate for its difficulty is a human
judgement no schema can make. Passing intake means a draft is *structurally
reviewable*, nothing more. No clinical content was authored or approved here —
the template contains `REPLACE:` markers, not medicine.

**Nothing shipped changed.** The app loads scenarios from
`content/scenarios/`; the staging folder is not on that path, and preflight
still reports the real released inventory (2 scenarios, difficulty 1 and 3,
with D2/D4/D5/D6 empty).

**Verified:** +4 nexus-core tests. A mutation check removed `title` from the
template and the template test failed as intended, then the file was restored
byte-identically. 283/283 nexus-core, 154/154 desktop, typecheck clean. Rust
untouched and not re-run (55 from the previous checkpoint).

**A12 remains blocked** on clinical authoring and review, which is owner work.

---

## Development-Only Browser Persistence (2026-09-19)

**Autonomous implementation decision, not a product decision.** Running the
frontend in a browser falls back to in-memory repositories, so every reload
wiped the session and made looking at the developing UI needlessly painful.
Three `localStorage`-backed repositories now implement the existing
`SessionRepository` / `CompetencyRepository` / `ProfileRepository` contracts, wired in
only when `import.meta.env.DEV` is true, the app is not inside the Tauri
shell, and storage actually works.

**This does not answer D10.** What persists a real web learner's progress -
per-browser, per-account across devices, or both - remains open in
`docs/DECISION_REGISTER.md`. This has no migration story, no schema
versioning and no account model; the DEV guard is what keeps it out of any
shipped web build. `persistenceMode` now reports which of the three backends
is in use, so the distinction is visible rather than assumed.

**Test determinism.** `import.meta.env.DEV` is also true under vitest, and
jsdom provides a `localStorage` - so jsdom tests were silently getting
browser storage instead of the in-memory repositories they are written for.
They still passed, which is precisely the problem: the suite's behaviour
depended on which environment a file happened to use. Test mode is now
excluded explicitly.

**Failure paths are part of the contract.** Storage is probed rather than
assumed (it throws in a private window, with site data blocked, or when a
quota is exhausted); corrupt stored JSON reads as empty rather than breaking
the app on boot; a failed write is swallowed so a development convenience can
never take the app down.

**Verified.** +10 desktop tests covering the reload lifecycle (a new
repository over the same storage, which is what a page load does), newest-first
ordering matching SQLite, interrupted-session recovery, batch competency
writes, unavailable storage, corrupt data and namespaced keys. Then in the
real browser at `http://localhost:1420/`: started a Practice attempt, typed a
chief complaint, submitted (scored 73/100), confirmed `nexus.dev.sessions` and
`nexus.dev.competency` were written with 7 competency domains, reloaded the
page, and saw the attempt restored in History.

**Totals:** 279/279 nexus-core, 154/154 desktop, typecheck and build clean.
Rust was untouched and not re-run; it remains at 55 from the previous
checkpoint.

---

## Preflight: Readiness and Decision-Register Validation (2026-09-19)

**What changed:** `tools/preflight/` reports, in one command, what state the
repository is actually in — git state, decision status parsed from the
register, scenario inventory and difficulty coverage, the A2 domain mismatch,
the A9 schema-version placeholder, and provider readiness. `pnpm preflight`
prints it; `pnpm preflight:test` runs its tests. No dependencies were added.

**Why:** the same questions were being re-answered by hand at the start of
every session — is the tree clean, which decisions are open, how much content
exists, is a tunnel installed, is PayMongo configured. Measuring them costs a
second and removes the temptation to answer them from memory.

**It observes; it never decides.** Preflight does not edit the register, does
not resolve a decision, and does not gate on a blocked one — a blocked decision
is this project's normal state. It exits non-zero only when the register itself
is malformed, which is a defect in the record rather than a product question.

**Secrets.** Provider readiness reports configured variable *names* and a mode
derived from a key prefix (`test`, `live`, `unconfigured`, `unknown`). No value
is printed, returned or logged, and a test asserts that no key-shaped value can
reach the report.

**It found a real defect on its first run.** The A6 entry in
`docs/DECISION_REGISTER.md` described its blocker only in prose, so it parsed
as neither blocked nor resolved — an entry that reads as settled at a glance
with nothing to contradict it. A6 now records its blocker explicitly: it is the
engineering half of **D8**, because resuming changes elapsed time, which feeds
the score.

**Verification:** 17 preflight tests pass (register parsing and
classification, duplicate ids, broken document references, range-heading
pointers, provider modes, secret non-exposure, and the shipped register parsing
cleanly). Focused by design: no application source changed, so the previous
verified baseline of 478 tests remains the baseline and was not re-run to
restate an unchanged number.

**Known limitations:** preflight reads the last fetched `origin/main` rather
than reaching the network, and says so in its output. Its tests run through
`pnpm preflight:test`, not `pnpm -r test`, because `tools/` is deliberately not
a workspace package.

**Unresolved decisions are unchanged:** D1, D10, A2, A9, A6, A7, A12 and D3–D9
all remain open. Nothing in this milestone resolves any of them.

---

## Open Decision Register (2026-09-18)

**What changed:** a new `docs/DECISION_REGISTER.md` consolidates every decision
currently blocking engineering work — D1, D10, A2, A6, A7, A9, A12, with
pointers to D3–D9 in the Phase 8.3 document — into one place, with the evidence
already gathered and the options the current architecture actually supports.

**Why:** the blockers were accurate but scattered across a phase document, an
audit table and commit messages, so answering any one of them started with a
research session. Each entry now states what is blocked, what the code does
today (re-verified at this commit, not taken from notes), what evidence was
examined, and the smallest set of alternatives the architecture supports.

**Nothing was decided.** Options are listed with their consequences and none is
selected or encoded. Where an apparently neutral choice would in fact be a
decision — adding an Assessment capability set to `false` for every tier, for
example — that is called out rather than taken.

**Re-verified during the audit**, first-hand rather than from earlier notes:
`revealedCount` is absent from `SessionRecord` and the IPC fixtures, so exact
mid-transcript resume is structurally impossible today (A6); the recommendation
engine contains no competency reference (A7); the module registry declares 12
domains against the evaluator's 7 (A2); `scenarioSchemaVersion` is still
`"0.0.0-unbuilt"` and no scenario *schema* version concept exists (A9); content
remains 2 scenarios at difficulty 1 and 3 (A12); the web build still falls back
to in-memory repositories, so a refresh loses the session (D10). The Business
Model Spec and Architecture Package are unchanged since `5a59cb4`, so the D1
evidence stands.

**Verification:** documentation only — no source changed. 279/279 nexus-core,
144/144 desktop, 55/55 Rust — **478 total, 0 failures**, unchanged. Typecheck,
build, `cargo check --all-targets` and `cargo fmt --check` clean.

**Known limitation:** the register records the state of decisions, not their
resolution. Every item in it still requires a human product, architecture or
content decision, and remote monitor access still requires an owner-configured
tunnel account.

---

## Competency Folding Is Now All-or-Nothing (data-integrity fix)

Submitting an attempt folds its category scores into seven competency
domains. That ran domain by domain - read, compute, write, repeat - so a
failure partway through left the attempt counted in some domains and not
others. Because `submit` is idempotent (a second call finds the session
already `completed` and returns), **nothing could ever finish the fold**: the
inconsistency was permanent, silent, and would quietly skew every figure
derived from competency.

Sessions were already written in one transaction; competency was not.

**The fix.** `CompetencyRepository` gains `upsertMany`, and `submit` now reads
and computes every domain first, then writes them as one batch. The Tauri
repository sends a single new command, `upsert_competency_records`, which
writes the whole batch inside one SQLite transaction - so an attempt lands in
every domain or in none. The fold also stamps one timestamp across all seven
domains rather than reading the clock per domain, which had made a single
attempt look like several events spread over time.

**No product decision.** Nothing about what competency means, how it is
computed, or what a learner sees changed. This makes the existing intent - one
attempt counts once in every domain - actually hold.

**Tests.** +7 desktop (`competencyFold.test.ts`): the fold is one batch and
not seven calls; a failing batch leaves no domain written; a read failure
partway leaves no domain written; one attempt counts exactly once in every
domain; a repeated submit does not double-count; all seven domains share one
timestamp; and a failed fold still leaves the attempt saved in history,
because a derived roll-up must not cost the learner their work. +2 Rust: a
batch containing a row SQLite rejects commits nothing, and a valid batch
writes every record.

**Mutation checks.** Four run, three caught: reverting the store to per-domain
writes (2 tests failed), reading the clock per domain (1), and removing the
transaction from the Rust batch (1). The fourth - removing the "staging" in
the in-memory repository - was **not** caught, and that was correct: a
synchronous loop cannot be observed partway, so the staging guaranteed
nothing. It was deleted rather than kept as reassuring-looking code, and the
comment now says where the real guarantee lives.

**Verified:** 279/279 nexus-core, 144/144 desktop, 55/55 Rust - **478 total, 0
failures** (+9). `pnpm -r typecheck` clean. `pnpm -r build` succeeds.
`cargo check --all-targets` and `cargo fmt --check` clean.

---

## Note Comparison - the Last Unimplemented MVP Acceptance Criterion (A8 cleared)

Architecture Package Section 34 lists thirteen things a learner must be able
to do entirely offline. Twelve were implemented. Number 10 - "Review a note
comparison (encounter vs. learner vs. expected)" - never was, and was carried
as Phase 7 accepted debt A8.

After submitting, the summary now shows a table with one row per documentation
section and three columns: the encounter as it happened, what the learner
wrote, and what the scenario required.

**It decides nothing.** `buildNoteComparison` in `nexus-core` is a pure
derivation over data that already exists: the encounter column is the
scenario's own per-section content, the learner column is the draft, and the
expected column is the requirement set the evaluator already scores against.
Every requirement's status is **read back out of the evaluation's errors**
rather than recomputed, so the comparison cannot contradict the feedback shown
directly above it - if the evaluator called something an omission, the
comparison says "Missing" for exactly that reason, and the four
requirement-linked error types map straight through
(`omission`, `incorrect_negative`, `wrong_section`, `incorrect_terminology`).

**Two details worth recording:**

- `additionalNotes` has no encounter counterpart, so its encounter cell is
  empty rather than filled with something approximate.
- Only `requiredDocumentation` appears. The evaluator raises
  requirement-linked errors for required items alone, so an optional item has
  no status to read back - including one would mean recomputing whether it was
  documented, which is precisely the second opinion this view must not have. A
  test pins that exclusion and its reason.

**No product decision.** This adds no scoring rule and changes no grading. The
view lives inside the submission summary, so it inherits the Phase 8.3
live-feedback boundary unchanged: an active assessment reaches none of it, and
a test asserts that. What an Assessment learner sees after submitting is still
**D3**, still open, and is not decided by this being present in the shared
summary.

**Tests.** +12 `nexus-core` (column mapping, section grouping, the
pertinent-negative flag, every status read back from the evaluation, errors
that name no requirement being ignored, optional exclusion, and no mutation of
its inputs). +6 desktop, rendered against the **real shipped scenario** rather
than a fixture shaped to suit the component, plus +1 assessment-boundary test.

**Mutation checks.** Five, each caught: recomputing status instead of reading
the evaluation (2 tests failed), mapping the encounter column to the wrong
field (1), showing optional documentation as required (4), dropping the
per-section grouping (5), and rendering the summary without the assessment
boundary (2). Every file was restored byte-identical.

**Verified:** 279/279 nexus-core, 137/137 desktop, 53/53 Rust - **469 total, 0
failures** (+19). `pnpm -r typecheck` clean. `pnpm -r build` succeeds
(291.37 kB, up from 287.71). `cargo test` unchanged.

---

## Content Security Policy, and Installers Actually Built (A5 and A4 cleared)

### A Content Security Policy now exists (A5)

The audit recorded `"csp": null` as debt that had to be resolved before web
deployment: with no policy, the webview would execute script from anywhere.
The app now ships a real policy, plus a separate development policy so the
Vite dev server and HMR keep working:

- Production: `default-src 'self'`, `script-src 'self'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'none'`, `frame-ancestors 'none'`, and
  `connect-src 'self' ipc: http://ipc.localhost` so Tauri IPC still resolves.
- Development adds `'unsafe-inline' 'unsafe-eval'` for scripts and the
  `ws://localhost:1420` origin, which HMR needs and production does not.

**`style-src` keeps `'unsafe-inline'`, deliberately.** The UI styles elements
through React `style` props, and Vite injects stylesheets as inline `<style>` tags
in development. Removing it would require moving every inline style into
stylesheets - a real change worth making later, not something to claim now.

**Verified at runtime, not by inspection.** The production binary was launched
and driven over the webview's debugging protocol: the page loads from
`http://tauri.localhost/` (embedded assets, so the production policy is the one
in force), the UI renders with styles applied, `get_profile` returns real data
over IPC, and the console contains **zero messages** - no CSP violations, no
errors.

A first attempt at this check was invalid and was redone: a stray Vite dev
server left over from an earlier `tauri dev` run was still listening, and a
binary built with plain `cargo build --release` loads the dev URL, so the page
came from `localhost:1420` and exercised the *development* policy. Only a build
through `tauri build` exercises the production one.

### Installers build (A4 now fully cleared)

`tauri build` completes end to end and produces both bundles:

| Artifact | Size |
|---|---|
| `haa-nexus-desktop.exe` (release) | 9.8 MB |
| `H.A.A. Nexus_0.1.0_x64_en-US.msi` | 3.6 MB |
| `H.A.A. Nexus_0.1.0_x64-setup.exe` (NSIS) | 2.5 MB |

**This corrects the previous entry.** That entry reported bundling as blocked
by a DNS failure while Tauri downloaded the WiX toolset
(`No such host is known`). The failure was transient: the same command, run
again unchanged, downloaded WiX and produced both installers. The earlier
report was accurate about what happened at the time and wrong as a conclusion
about the repository. Phase 7 debt A4 is therefore fully cleared - `tauri dev`,
`tauri build`, runtime IPC and installer bundling have all now been exercised
on a real machine. Installer *signing*, auto-update and release hardening
remain Phase 9 and remain unattempted.

**Verified:** 267/267 nexus-core, 130/130 desktop, 53/53 Rust - **450 total, 0
failures**, unchanged by this work. `pnpm -r typecheck` clean. `pnpm -r build`
succeeds (287.71 kB). `cargo check --all-targets` and `cargo fmt --check` clean.

---

## Release Build and Web-Target Runtime Verification (Build-priority steps 2 and 4)

Business Model Spec Section 3 step 2 asks for the Tauri + Rust build to be
verified on a real machine, and step 4 for a web-deployed build to be stood up
"in parallel" using the existing browser-capable frontend. Both were measured
rather than assumed.

### Release build (`tauri build`)

The **release binary compiles and runs**: the optimized profile finished in
1m 39s, producing `haa-nexus-desktop.exe`. Launched directly - no dev server, no
Vite - it serves its embedded assets from `tauri.localhost` and performs the
same real IPC calls verified in dev, against the same SQLite database. The
production asset path is therefore verified too, not just the dev path.

**Bundling could not be verified here.** After building the exe, Tauri tries to
fetch the WiX toolset to produce the MSI, and the download failed with
`io: No such host is known. (os error 11001)` - a DNS failure in this
environment, not a repository defect. Installer bundling remains unverified and
stays Phase 9; it needs either network access to that host or a pre-installed
WiX/NSIS toolchain.

### Web target

The production `dist/` was served as plain static files and driven in a real
browser with no Tauri present:

| Check | Result |
|---|---|
| App boots outside the shell | yes - no console errors, no blank screen |
| `__TAURI_INTERNALS__` absent | yes, so the in-memory repositories were in use, as `repositories.ts` intends |
| All six routes render | Dashboard, Live Scribing, Training, Knowledge Base, Analytics, Settings |
| Routing style | hash routing (`#/live-scribing`), so static hosting needs **no** server rewrite rules |
| Entitlement gating | identical to desktop: the difficulty-1 scenario is actionable, the difficulty-3 scenario shows "Locked - Intermediate scenarios are included with Practice Access" |
| Browser storage available | `localStorage` writable |

So the spec's premise holds: the frontend is genuinely browser-capable, and
Free-tier gating enforces itself there with no extra work.

**The gap is persistence.** Outside Tauri the repositories are in-memory, so a
refresh loses the session. That is what step 4's "lightweight cloud persistence
layer" is for - but which layer (a hosted database, a browser-local store, or
both) determines whether progress follows a learner across devices, and that is
a product promise rather than an implementation detail. Recorded as **D10** in
`docs/PHASE_8_3_ASSESSMENT_MODE.md`; no persistence layer was chosen.

**Verified:** 267/267 nexus-core, 130/130 desktop, 53/53 Rust - **450 total, 0
failures**, unchanged by this work. `pnpm -r typecheck` clean. `pnpm -r build`
succeeds (287.71 kB). `cargo check --all-targets` and `cargo fmt --check`
clean.

---

## Runtime IPC Verified in the Real Tauri Shell (Phase 7 debt A4, partly cleared)

Until now every claim about TypeScript ↔ Rust communication rested on tests
that each ran on one side of the boundary. `pnpm tauri dev` had never been
executed, so nothing proved a single `invoke` call worked end to end. This
runs it.

**A real defect surfaced immediately.** `tauri dev` starts the Vite dev server
first, then cargo builds into `src-tauri/target`. Vite's file watcher tried to
watch the executable cargo was writing and died with
`EBUSY: resource busy or locked ... haa_nexus_desktop.exe`, which failed the
`beforeDevCommand` and aborted the whole run. The app could not start at all on
this platform. Fixed by ignoring the Rust tree in the dev server's watcher
(`server.watch.ignored = ["**/src-tauri/**"]`), which is what Tauri's own Vite
guidance specifies; cargo already watches its own sources.

**Verified live**, by attaching to the running WebView2 instance over its
remote debugging port and calling commands in the page:

| Check | Result |
|---|---|
| Real shell detected (`__TAURI_INTERNALS__`, `invoke` present) | yes — so the Tauri repositories, not the in-memory fallback, were in use |
| `get_profile` | `{ displayName: "Learner", updatedAt: 1789710033038 }` — Rust → SQLite → TypeScript with the exact camelCase names the M6 fixtures pin |
| `list_sessions`, `list_competency_records` | empty arrays on a fresh database |
| `get_session` for an unknown id | `null`, not an error — the contract `TauriSessionRepository` depends on |
| `get_competency_record("accuracy")` | `null` on a fresh database |
| Wrong argument name (`sessionId` instead of `id`) | rejected: *invalid args `id` for command `get_session`* — the argument-name contract M6 checks statically is enforced at runtime |
| `save_profile` then `get_profile` | write path works; the value was saved back unchanged, so no local data was altered |
| Window and UI | renders "Welcome back, Learner" (that name came over IPC), Modules and History; no error overlay, no Rust panic |

The migration runner also ran for real: the app opened a live database, applied
migrations and created the local user row, which is how `get_profile` had a row
to return.

**What this does and does not clear.** A4 covered two things. Runtime IPC is
now verified, and the `tauri dev` path works on Windows. **`tauri build`
(MSI/NSIS bundling) is still unrun**, so installer packaging remains unverified
and stays Phase 9 work.

**Verified:** 267/267 nexus-core, 130/130 desktop, 53/53 Rust — **450 total, 0
failures**. `pnpm -r typecheck` clean. `pnpm -r build` succeeds (287.71 kB).
`cargo check --all-targets` and `cargo fmt --check` clean. The dev-server
watcher change affects `vite dev` only, not the production build.

---

## Domain Unions vs SQLite CHECK Constraints (Complete)

`SessionStatus`, `SimulationMode` and `CompetencyLevel` are TypeScript string
unions. The columns that store them are SQLite `CHECK` constraints written in
a different language, in a different file, with nothing connecting the two. A
value added to a union typechecks, passes every test, and then fails the first
time a real session is written, because the column rejects it.

Five of the eight session statuses are exactly that risk today:
`not_started`, `interrupted`, `abandoned`, `evaluation_failed` and `retried`
are part of the union but nothing writes them yet, so nothing would have
noticed if a migration lost one.

**TypeScript** (`src/persistence/schemaContract.test.ts`, +5 tests): each union
is listed with a compiler-checked `satisfies Record<T, true>`, so the list
cannot drift from the type, and is compared to the CHECK list parsed out of
the migration that currently owns the column - the *last* migration defining
it, which is how the 002 table rebuild supersedes 001. One test pins the
reason 002 exists: 001 alone would reject `assessment`.

**Rust** (`src-tauri/src/db/contract_tests.rs`, +2 tests): all 24
status × mode combinations are saved to real file-backed SQLite and read back,
asserting the stored value is unchanged; and a status outside the union is
asserted to be *rejected*, so the constraint is proven to be doing work rather
than sitting inert.

**Mutation checks.** Three, each caught: dropping `assessment` from the mode
constraint (the TypeScript comparison failed, and SQLite refused the write
with `CHECK constraint failed`), adding a status the domain does not have (1),
and removing the status constraint entirely (the rejection test failed). Every
file was restored byte-identical.

**Recorded while testing the statuses.** `evaluation_failed` exists in the
union and is accepted by the column, but nothing produces it, and
`sessionStore.submit` calls `evaluateAttempt` outside its try/catch — so a
throw there would leave the learner pressing Submit with no response. What the
learner is told, and whether the attempt may be retried, is learner-facing
policy, so it is recorded as **D9** in `docs/PHASE_8_3_ASSESSMENT_MODE.md`
rather than decided here.

**No product decision.** These tests describe what the schema already accepts.
Nothing was added to a union, no unused status was given behaviour, and no
learner-facing rule changed.

**Verified:** 267/267 nexus-core, 130/130 desktop, 53/53 Rust — **450 total, 0
failures** (+7). `pnpm -r typecheck` clean. `pnpm -r build` succeeds (287.71
kB). `cargo check --all-targets` and `cargo fmt --check` clean.

---

## Phase 8.3 — Live-Feedback Boundary Enforced Structurally (Complete)

The Phase 8.3 boundary (decision D2) was real but *conventional*: each
component that wanted to show a score had to remember to call
`mayRevealPerformance` first. `SubmissionSummary` did. A future surface that
forgot would leak performance information into an active assessment, and no
test would have caught it, because each existing test covers only the
component it was written for.

**The rule now lives in one place.** `selectRevealableResult` (and its
`useRevealableResult` binding) applies the boundary in the store and returns
`null` while an assessment is active. `state.result` remains the raw field
that `submit` needs in order to evaluate, persist and fold the attempt into
competency; it is no longer what the UI reads. `SubmissionSummary` now
consumes the guarded selector, so its score, category breakdown, WHAT/WHY/HOW
feedback and recommendations are all gated by one decision instead of three
checks it had to repeat.

**Enforced, not documented.** `liveFeedbackBoundary.invariant.test.ts` scans
every non-test source file under `apps/desktop/src` and fails if any file
other than the store reads the raw evaluation out of session state. The same
file also fails if the desktop app re-implements the rule locally
(`mode === "assessment"`) instead of importing it from `nexus-core`, so the
domain stays the single authority.

**No product decision was made or changed.** Practice and simulation remain
unrestricted, because no restriction is authorized for them. Assessment still
reveals nothing before `completed`, exactly as before. What changed is where
the rule is enforced, not what it says.

**Tests.** +12 desktop: the selector is proven for every session status in
every mode, including `interrupted` and `abandoned`, and for the
no-session/no-result cases; plus the four source-scanning invariants. The
assessment helper sets `paused` directly, because the machine correctly
refuses to pause an assessment at all.

**Mutation checks.** Three, each caught: dropping the boundary from the
selector (5 tests failed, including the existing rendering test), the summary
reaching around the selector for the raw field (3), and re-implementing the
rule in the desktop app instead of importing it (1). Every file was restored
byte-identical.

**Still blocked (unchanged).** D1 was re-audited against the Business Model
Spec this session: Section 4's tier table names Assessment in no row, and the
entitlement rules state only *that* it must be gated. No authoritative source
says which tier includes Assessment, so no tier was encoded and Assessment
still has no learner entry point. D3–D7 remain unauthorized; a new D8
(resuming an interrupted practice/simulation attempt) is recorded in
`docs/PHASE_8_3_ASSESSMENT_MODE.md`.

**Verified:** 267/267 nexus-core, 125/125 desktop, 51/51 Rust — **443 total, 0
failures** (+12). `pnpm -r typecheck` clean. `pnpm -r build` succeeds (287.71
kB). `cargo check --all-targets` and `cargo fmt --check` clean.

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
