# H.A.A. Nexus — Phase 8.3: Assessment Mode

**Status:** **IN PROGRESS — blocked on product decisions**
**Purpose:** Current-state record for Assessment mode: what is implemented, what is authorized, and which product decisions remain open. This document is the durable home for the Phase 8.3 decision log.

---

## 1. Authorized requirements

| Requirement | Source | Evidence tier |
|---|---|---|
| Assessment is a no-pause mode | Business Model Spec §3 step 3 ("Build **Assessment (no-pause)** mode"); §10.2 ("a mode flag that disables Pause/Resume") | B — product specification |
| Assessment is built on the existing session state machine | Business Model Spec §10.2 | B |
| Assessment hides live feedback that would compromise exam simulation | Business Model Spec §10.2 | B |
| Live-feedback boundary: during an active Assessment the learner must not receive information that reveals, confirms, grades, coaches, or materially signals the correctness or quality of ongoing performance when doing so would compromise exam-style simulation | Session owner's direct instruction (5-hour session, 2026-09-17) | A1 — direct instruction |
| Assessment is gated by an explicit entitlement capability, not scattered UI conditionals | Business Model Spec §4 entitlement rules | B |
| `assessment` is a persisted session mode | Architecture Package §8 schema | C — technical contract |
| Assessment mode is operational before commercial launch | Business Model Spec §12 launch gate | B |

## 2. Implemented and verified

| Capability | Where | Checkpoint |
|---|---|---|
| `assessment` session mode; pause/resume refused by the session machine (`PauseNotAllowedError`), mode checked before status | `nexus-core` `simulation-engine` | `02ddb7f` |
| Database accepts `assessment` (migration 002 table rebuild; schema version 2) | `src-tauri/migrations/002_assessment_mode.sql` | `02ddb7f` |
| Workspace hides Pause/Resume, keeps progressive transcript reveal, labels the mode; store ignores pause/resume | `SimulatorWorkspace.tsx`, `sessionStore.ts` | `97c533b` |
| **Closed-book Assessment (D4)**: `mayAccessReferenceMaterial` in the domain; `ReferenceGate` on the `/knowledge-base` and `/training` routes; nav links hidden to match | `session-machine.ts`, `ReferenceGate.tsx`, `App.tsx`, `AppShell.tsx` | D4 checkpoint |
| **Live-feedback boundary enforced as state** (see §4) | `mayRevealPerformance` / `assertMayRevealPerformance` in `nexus-core`; `sessionStore.ts`; `SubmissionSummary.tsx` | `621855e` |
| **Boundary enforced structurally**: one guarded selector plus a source-scanning invariant, so no future surface can reveal performance by forgetting the rule | `selectRevealableResult` / `useRevealableResult` in `sessionStore.ts`; `liveFeedbackBoundary.invariant.test.ts` | Phase 8.3 hardening (see CHANGELOG) |

| **Assessment gated by entitlement (D1 = Pro)**: `canStartAssessment` capability, `canStartMode` mapping in the domain, enforced in `sessionStore.start`, entry point in the scenario library | `capability-matrix.ts`, `resolve.ts`, `sessionStore.ts`, `ScenarioLibrary.tsx` | `34f727c` |

**Reachable since `34f727c`:** Pro and Fast-Track learners can start an Assessment. Free and Practice cannot. What happens *after* an Assessment is submitted was decided on 2026-09-20 (D3): all six post-submission surfaces ON, delivered by the same mode-agnostic summary Practice uses.

## 3. Product decision log

Every Phase 8.3 decision is classified against the evidence hierarchy. A decision is **AUTHORIZED** only when a direct instruction or a current product specification explicitly establishes it. Current behaviour, tests, tier names and "obvious" defaults are not authorization.

### D1 — Which subscription tier includes Assessment? — **RESOLVED**

**Owner decision, 2026-09-19: Pro.** Pro is the *minimum* tier that may start
Assessment: Free blocked, Practice blocked, Pro allowed, Fast-Track allowed.
Implemented and verified at `34f727c`; the full record is in
`DECISION_REGISTER.md`. The evidence gathered while it was open is kept below,
because it explains why the answer could not be inferred.

*Audited 2026-09-18, while blocked: the Business Model Spec Section 4 tier table named Assessment in no row; the entitlement rules established only that it must be gated by an explicit capability. "Exam-Ready Pro" is a product name, not a statement of entitlement.*

- **Evidence examined:** Business Model Spec §4 tier table (Assessment appears in no row); §4 entitlement rules ("Assessment … should be gated by explicit entitlement capabilities"); §9 monetization roadmap ("Add Assessment mode" — timing only); §12 launch gate; Architecture Package §24/§25; `capability-matrix.ts`.
- **Why insufficient:** the specification establishes *that* Assessment is gated, not *which* tier. The tier name "Exam-Ready Pro" suggests an exam feature but is not a statement of entitlement. Adding a capability with any per-tier values — including `false` everywhere — would encode feature availability.
- **What it was blocking:** the Assessment entitlement capability and its matrix values; a learner entry point in the scenario library; mode-level enforcement in `sessionStore.start`. All three now exist.
- **Answer:** Pro.

### D2 — What is prohibited live feedback during Assessment? — **PRINCIPLE AUTHORIZED**

- **Evidence:** Business Model Spec §10.2; the session owner's boundary (§1 above).
- **Implemented:** see §4. Enforcement is limited to information that actually signals ongoing performance. No broader restriction was invented.

### D3 — What does an Assessment learner see after submitting? — **RESOLVED**

**Owner decision, 2026-09-20. All six post-submission surfaces ON:**

| Surface | D3 |
|---|---|
| `score` | ON |
| `category_breakdown` | ON |
| `what_why_how` | ON |
| `expected_answer_comparison` | ON |
| `recommendations` | ON |
| `immediate_retry` | ON |

**No behaviour changed.** The characterization performed earlier the same day
established that the existing mode-agnostic summary already did all six.
Implementing D3 therefore meant *protecting* what existed, not writing new
results code: `routes/LiveScribing.tsx` still renders `SubmissionSummary` for
any completed session, and `SubmissionSummary` still branches on no mode.
There is no Assessment-specific results renderer, and adding one would have
been a second surface to keep in sync for no gain.

**`recommendations = ON` means the whole engine.** The Assessment results
surface exposes whatever `generateRecommendations` legitimately produces for
the completed attempt - every rule, in the engine's order, including none. The
surface does not filter, reorder or cap. All four rules the engine supports
are covered by tests through the real component: `repeated-hpi-omission` and
`repeated-terminology-errors` (lesson), `repeated-time-failures` (scenario
retry), and `fabrication-detected`, which fires from a single occurrence and
therefore also proves the attempt just submitted is part of the history the
summary reads. No rule, threshold or recommendation type was invented,
changed, or reordered by D3.

**`immediate_retry = ON` does not mean unrestricted.** Retry goes through
`sessionStore.start` like every other entry point, so a learner whose
entitlement no longer allows Assessment is refused and told why. D3 grants a
retry action; it does not grant entitlement, and no cooldown or quota was
added in either direction.

**Contract test:** `assessmentPostSubmission.test.tsx` (15 tests), which
replaces the same-day characterization file that said it expected to be
rewritten once D3 was answered. Four mutation checks confirmed it bites:
suppressing the recommendation card, rendering only the first recommendation,
dropping the expected column, and retrying in the wrong mode each failed it,
and every file was restored byte-identically.

- **Evidence examined while this decision was open:** Business Model Spec §5 and §10.2 (both about *live* feedback); Architecture Package §34 (mode-agnostic acceptance criteria).
- **Why it was insufficient:** post-submission results are not live feedback, and no source defined Assessment results policy (score, breakdown, WHAT/WHY/HOW feedback, recommendations, retry). The answer had to come from the owner, and did.
- **Note, unchanged by D3:** the matrix capability `canViewDetailedScoreBreakdown` is declared for every tier but read by no application code, so the category breakdown is shown to all tiers in all modes. D3 sets the breakdown ON for Assessment; it says nothing about tier-based filtering, which remains a separate question.

### D4 — Is Assessment closed-book? — **RESOLVED**

**Owner decision, 2026-09-20: closed-book.**

```
knowledge_base_during_assessment = OFF
training_during_assessment       = OFF
direct_route_access              = BLOCKED
tier_specific_reference_access   = NO
```

**One boundary, in the domain.** `mayAccessReferenceMaterial(session)` in
`nexus-core` answers it: `null` (no attempt) and practice/simulation are
unrestricted; an assessment is blocked unless `status === "completed"`. It
takes a session and no tier, so Pro and Fast-Track cannot diverge - D1 decides
who may enter an assessment, D4 decides the conditions inside it.

**Guarded at the route, not the nav rail.** `ReferenceGate` wraps
`/knowledge-base` and `/training` in `App.tsx`, so a typed URL, a bookmark and
a programmatic `navigate()` are all blocked, because all three render the route
element. `AppShell` also hides the two links, which is a courtesy so a learner
is not offered something that would refuse them - the route guard is the
protection. Both files import the same `REFERENCE_ROUTES` list, so a third
reference surface cannot be added to one and forgotten in the other.

**The `completed` test is what keeps D3 intact:** the books reopen exactly when
the attempt is submitted, so the post-submission experience - including the
expected-answer comparison - is untouched.

**Verification:** 12 domain tests (every mode × every status, the assert form,
no mutation, and that the rule takes no tier) and 17 desktop tests that render
the **real router at a real URL** rather than the route components, because
"blocked" has to mean the route is blocked. Three mutation checks confirmed
they bite - removing the route guard so only the nav rail restricted access
failed 5 tests, which is exactly the failure mode this decision forbids - and
every file was restored byte-identically.

---

**The audit that preceded this decision** is kept below, because it is the
evidence the decision was made on.

### D4 — evidence gathered while this decision was open

- **Evidence examined:** no source mentions Knowledge Base or Training access during Assessment.
- **Why insufficient:** reference material does not signal the correctness of ongoing performance, so it falls outside the authorized D2 boundary. Restricting navigation would be a new learner-facing rule.
- **Decision required:** whether Assessment is open-book or closed-book.

**Current behaviour, characterized 2026-09-20 (evidence, not policy).** An
active Assessment is **fully open-book, by omission rather than by decision**.

| Reference surface | Reached by | Guard |
|---|---|---|
| Knowledge Base (terminology lookup) | nav rail link, `#/knowledge-base` | none |
| Training (lessons: explanation, examples, knowledge checks with correct answers) | nav rail link, `#/training` | none |

`App.tsx` declares six flat routes with no guards, no redirects and no
`useBlocker`. `AppShell` renders the same nav rail regardless of session
state. `KnowledgeBase.tsx`, `Training.tsx`, `AppShell.tsx` and `App.tsx`
contain **zero** references to `useSessionStore`, `useEntitlementStore`,
`currentEntitlements` or the session mode - the reference surfaces do not know
a session exists, so there is nothing to bypass and no hidden button to find.
Navigating away and back leaves the session running and the clock advancing.

**The material detail for this decision:** the Knowledge Base is keyed
lay-term → clinical-term with accepted alternatives, and the evaluator scores
the Terminology category on exactly those conversions. In `SCRIBE-FM-014` the
requirements are "document the cough as non-productive" and "document absence
of shortness of breath using clinical terminology"; searching the Knowledge
Base for "shortness of breath" during an active session returns **dyspnea**,
plus the accepted forms. Reference material here is therefore not neutral
background - for one scored category it is close to an answer key. Stated as a
fact about the content, not as an argument for either policy.

**Also relevant, not decided:** an Assessment cannot pause, so time spent in
the Knowledge Base is counted against the learner by the Time Efficiency
category. Whether that is an acceptable natural cost or an unfair one is part
of the same decision.

**Verified in-browser at Practice** (the only mode reachable at the default
Free tier): mid-session navigation to the Knowledge Base returned the dyspnea
entry, Training listed all three lessons, and returning to Live Scribing found
the session still in progress with the timer advanced. **Assessment itself
could not be exercised in-browser** - it requires Pro and no tier-switching
surface exists (D10). The Assessment path is established from source instead,
which is conclusive here precisely because the surfaces contain no mode logic
at all.

**No characterization test was added.** The finding is the *absence* of a
guard, provable from the route table and the four files above; a test
asserting "the Knowledge Base renders during an Assessment" would fail the
moment D4 is answered in the restrictive direction, which is the next expected
change. No production behaviour was altered to make the audit easier.

- **The decision surface as it was put to the owner:** (1) is the Knowledge Base available during an active Assessment; (2) is Training/lesson content available; (3) if either is restricted, is that enforced at the route or only in the nav rail; (4) does the answer differ by tier. **Answered: (1) no, (2) no, (3) at the route, (4) no.**

**The knowledge archive is not what D4 restricts.** `content/` - scenarios,
terminology, lessons and the question bank - remains available in full to
authoring, validation and content tooling, and `content/scenarios.ts` still
loads every repository at startup exactly as before. D4 closes a *runtime
learner surface during an attempt*; it does not touch the archive that feeds
that surface, and the boundary test explicitly permits the content layer to
read those repositories. No archive content was moved, deleted, gated or given
entitlement metadata.

### D5 — Do Assessment results count in analytics and competency? — **RESOLVED**

**Owner decision, 2026-09-20: separately.** A completed Assessment contributes
to Assessment competency and Assessment analytics, and to nothing else. It
must not mutate, overwrite, or become indistinguishable from Practice
competency, and must not be folded into Practice aggregates. Practice and
Assessment are two authoritative signals measuring different things: training
activity, and performance under formal exam conditions.

**Simulation counts as practice.** D5 separated Assessment from Practice and
said nothing about simulation, so it stays exactly where it has always
counted. Giving it a third population would be deciding something nobody
decided.

**The distinction survives persistence.** It is not a label, a UI filter, or
something reconstructed from a merged total:

| Layer | Boundary |
|---|---|
| Domain | `ResultPopulation` (`practice` \| `assessment`) and `resultPopulationFor(mode)` |
| Competency record | `CompetencyRecord.population`; `updateCompetencyRecord` **throws** rather than fold a score into another population's record |
| Repository | `get(population, domain)` - there is no call that returns "the" record for a domain, because there is no longer one |
| SQLite | migration 003: `UNIQUE(user_id, population, domain)`, id rebuilt as `user-population-domain` |
| Analytics | `computeAnalytics(population, …)` - population is a **required** argument and the filtering happens inside, so no caller can produce a merged total |
| UI | Two labelled sections; no combined figure is rendered anywhere |

**Migration 003 assigns existing rows to `practice`.** Provenance was checked
rather than assumed: the Assessment entry point first existed at `34f727c`
(D1), so **every competency record written before that commit is unambiguously
practice or simulation** - no learner could start an Assessment at all. Between
`34f727c` and D5 an Assessment could in principle have folded into the shared
record, but only for a Pro or Fast-Track subscription, and there is no
subscription persistence or tier-switching surface (D10), so no production path
existed. The classification is therefore safe for real data and, in the one
theoretical window, is the conservative choice: it preserves the learner's
history rather than discarding rows whose provenance cannot be proven. The
dev-browser store applies the same rule to records predating the field.

**Recommendations were deliberately left alone.** `generateRecommendations`
still reads all evaluated sessions across both populations. D5 governs
competency and analytics, which recommendations are neither, and no
recommendation policy was supplied - so scoping them to a population would
have been inventing one. **This is the open question D5 did not answer:**
should recommendations after an Assessment be derived from Assessment history,
Practice history, or both? Recorded here rather than decided.

**Verification:** 23 domain tests, 9 end-to-end tests through the real
`sessionStore.submit`, and 55 Rust tests including the rebuilt schema. Four
mutations confirmed the suite bites - dropping the population from the
persistence key, dropping the analytics filter, swapping the two populations,
and collapsing them into one each failed it, and every file was restored
byte-identically.

<details><summary>The audit that preceded this decision</summary>

### D5 — evidence gathered while this decision was open

- **Evidence examined:** Architecture Package §14/§18 (mode-agnostic); Business Model Spec §4 (competency and analytics tiering only).
- **Why insufficient:** merging or separating exam results changes what learners are shown about their competency.
- **Current state:** analytics and competency remain mode-agnostic, unchanged.
- **Decision required:** whether Assessment results are counted with, separately from, or instead of practice results.

**Audited 2026-09-20 (evidence, not policy). Still NOT AUTHORIZED - no option was chosen.**

**Nothing is partially implemented.** `sessionStore.submit` folds an attempt's
seven category scores into competency with no mode check; `computeAnalytics`
filters only on "has a finite evaluation", never on mode; the Dashboard history
lists every record's score without distinguishing mode. An Assessment attempt is
today indistinguishable from a Practice attempt everywhere downstream.

**The three options do not cost the same, and that is the finding.**

| | Analytics | Competency |
|---|---|---|
| **Counted with practice** (today) | no change | no change |
| **Counted separately** | no schema change - `mode` is already persisted on every `SessionRecord` and `computeAnalytics` simply does not read it | **migration required** - `competency_records` is `UNIQUE(user_id, domain)` with no mode dimension, so separation needs migration 003, the Rust DTO and repository, and the `CompetencyRecord` shape |
| **Counted instead of practice** | no schema change | no schema change, but changes what practice contributes to an existing learner's record |

So "separately" is cheap for analytics and expensive for competency, and the
two halves of this decision can be answered independently if the owner wants
them to be.

**D5 changes D3's inputs.** `generateRecommendations` reads *all* evaluated
sessions with no mode filter, so recommendations after any attempt are derived
partly from Assessment history. Separating or excluding Assessment results
silently changes which recommendations D3 surfaces. D3 authorized the
recommendation *surface*, not which attempts feed it, so this needs stating
rather than assuming.

**A related gap that belongs to no decision.** D4 closed the Knowledge Base and
Training during an active Assessment; Analytics and the Dashboard were
deliberately excluded from that decision and remain reachable mid-attempt,
showing aggregate performance from previous attempts. That is not D2 (which
covers *this* attempt's performance), not D4 (answered for reference material
only), and not D5 as worded (which is about what *counts*, not what is
*visible during*). Flagged so it is a decision rather than an oversight.

**The tier axis is also unenforced, and is not D5.** `CAPABILITY_MATRIX`
declares `canTrackCompetency` and `canViewAnalytics` as false/false/true/true,
but no application code reads either, so every tier currently gets competency
tracking and analytics. That is a separate pre-existing gap on the tier axis;
D5 as worded is about mode. Wiring it up would decide it by implementation, so
it was left alone.

- **The decision as it was put to the owner:** (a) together with practice, (b) separately, or (c) instead of practice. **Answered: (b), separately, for both competency and analytics.** The predicted cost held - analytics needed no schema change, competency needed migration 003.

</details>

### D6 — After an interrupted Assessment, may the learner start again or resume? — **RESOLVED**

**Decision, 2026-09-20, under delegated authority: a learner may retake an
interrupted Assessment as a new attempt. Exact in-place resume is not
offered.** The interrupted attempt is recorded as `abandoned` rather than
deleted, and contributes nothing.

**Why resume was not selectable.** A6 records that exact mid-transcript resume
is unimplemented and is *the engineering half of D8*: restoring an attempt
changes elapsed time, which feeds `timeEfficiencyRatio` and therefore the
score. Choosing it would have decided D8, which is not this decision's to make.
So the real option space was **retake** or **no retake at all**.

**Why retake rather than a terminal lock.** A "no retake" rule would
permanently cost a learner a scenario because their machine crashed - a
destructive, irreversible outcome invented by no source. The exam-integrity
worry behind such a rule is score-shopping, and it does not apply here: **D2**
means the learner sees no performance information whatsoever during an active
Assessment, so there is nothing to shop against, and the abandoned record keeps
the audit trail. Under **D5** an interrupted Assessment carries no evaluation,
so it counts in neither population - a retake cannot launder a bad score,
because no score exists.

**No production change was required.** The existing Dashboard flow already
implements exactly this: it offers "Start a new attempt" and "Discard", never a
resume, and it starts the new attempt *before* abandoning the old record so a
refused start cannot destroy the learner's work. D6 authorizes that behaviour
and `interruptedAssessment.test.tsx` now pins it, including that D1 still
refuses a tier that may not start an Assessment.

**Verified:** 7 tests through the real Dashboard. Two adversarial checks
confirmed the boundary is load-bearing - abandoning the record before the start
succeeds failed 2 tests, and carrying the old attempt's id forward (a disguised
resume) failed 1 - and both files were restored byte-identically.

**Still open, deliberately:** whether an interrupted *practice or simulation*
attempt may be resumed in place is **D8**, and the transcript-position
persistence it needs is **A6**. Neither was touched.

<details><summary>The entry as it stood while this decision was open</summary>

### D6 — evidence gathered while this decision was open

- **Evidence examined:** the Dashboard's interrupted-session flow (implementation only).
- **Why insufficient:** retake and resume rules are exam-integrity policy, a learner-facing restriction.
- **Current state:** the generic "Start a new attempt" flow is unchanged.
- **The decision as it was framed:** the retake/resume policy for interrupted Assessments. **Answered: retake allowed, resume not offered.**

</details>

### Related open decision outside Assessment

#### D7 — How is contradictory learner documentation graded? — **RESOLVED**

**Decision, 2026-09-20, under delegated authority: a note that documents a
pertinent negative and asserts the opposite in the same section is a
`critical_documentation_error`, at critical severity, counting against accuracy
like any other unsupported assertion.**

**What it was before.** Nothing. `findFirstMatch` returns the *first* match, so
"No fever. Fever present." satisfied the requirement and the contradiction was
never looked at: measured before implementing, that note scored **accuracy 100
with no error at all**. Architecture §28 requires "contradictory learner input"
as an edge-case fixture but states no expected outcome, which is precisely the
gap this decision fills.

**No new classification was invented.** `critical_documentation_error` already
existed in the taxonomy with a **critical** severity floor in `severity.ts`,
and no evaluator path produced it - the architecture had reserved the type for
defects dangerous regardless of category, which is exactly what a
self-contradictory note is. The score effect reuses the existing
`fabricationLikeCount`, whose own comment already described it as assertions of
something false. No new error type, no new severity, no new scoring formula.

**The option space, classified.** Two things are distinguished here because
they are different: an option that *could* have been chosen and was not, and
an option that was never available to choose.

| Option | Status | Reason |
|---|---|---|
| No error (keep current behaviour) | SELECTABLE — not selected | Available, but ratifies a grading hole: a self-contradictory note scoring 100 |
| `fabrication` | SELECTABLE — not selected | Means a value the encounter never provided; a contradiction fabricates no value, and reuse would blur a tested meaning |
| `incorrect_negative` | SELECTABLE — not selected | Means a clean reversal; would collide with the existing `negationReversed` path and mislabel a note that *did* contain the correct negative |
| `incorrect_positive` | SELECTABLE — not selected | Closer, but describes only half the defect - the danger is the contradiction, not the positive |
| **`critical_documentation_error`** | **SELECTED** | Already in the taxonomy with a critical severity floor and no evaluator path producing it; the type the architecture reserved for defects dangerous regardless of category |
| A new error type | EXCLUDED — authority conflict | §11-13 fix the error taxonomy; adding a member would invent a classification no source contemplates |
| General contradiction detection | EXCLUDED — later-policy dependency | Grading contradictions between arbitrary positive findings requires positive-finding semantics no source defines, which is a separate product question |

**Scope, stated honestly.** The rule covers **pertinent negatives**, where the
existing negation machinery detects the contradiction reliably by reusing
`detectReversedNegative`. It is not general contradiction detection and does
not claim to be.

**The downstream fix that came with it.** `critical_documentation_error`
carries a `relatedRequirementId`, but was not in the note comparison's
`REQUIREMENT_STATUSES` - so a contradicted requirement would have read back as
"Documented" while the feedback list called it critical, the exact divergence
that component exists to prevent. The status union and the desktop labels were
extended to show **Contradictory**.

**Verified:** 11 tests. Three mutations confirmed the boundary bites - never
detecting a contradiction failed 4, dropping the pertinent-negative scope guard
failed 1, and reporting it without any score effect failed 1 - all restored
byte-identically. **Browser-verified inside a real Assessment**: accuracy 60,
one "critical documentation error", and "Contradictory" in the note comparison.

<details><summary>The entry as it stood while this decision was open</summary>

#### D7 — evidence gathered while this decision was open

- **Evidence examined:** Architecture Package §28 lists "contradictory learner input" as a required edge-case fixture but states no expected outcome; §11–§13 (evaluation, scoring, error classification) do not address documentation that asserts both a fact and its negation (for example, "No fever. Fever present."); Business Model Spec §6 (deterministic scoring) is silent.
- **Why insufficient:** a fixture needs an expected result, and that result is scoring policy — which error type, what severity, what score effect. Pinning the evaluator's current behaviour as "expected" would silently convert implementation behaviour into a grading rule.
- **Current state:** the evaluator's existing behaviour is unchanged and untested for this case.
- **The decision as it was framed:** how contradictory documentation should be classified and scored. **Answered: `critical_documentation_error`, critical severity, accuracy-affecting.**

</details>

#### D8 — May an interrupted practice or simulation attempt be resumed? — **NOT AUTHORIZED**

- **Evidence examined:** Architecture Package §20 ("on app launch, any session with `status = in_progress` and no `completed_at` is surfaced as *Resume interrupted session?*"), §10 (autosave so "interrupted sessions must not lose work"), §30 acceptance ("recovery from a forced interruption"). The Dashboard already surfaces interrupted sessions and offers a fresh attempt; the draft is already persisted, so no work is lost on disk.
- **Why insufficient:** the architecture states that interrupted sessions are *surfaced* and that drafts are *saved*, but not what resuming does to the attempt itself. Restoring a draft into a running attempt would carry prior work into a newly timed session, and elapsed time feeds `timeEfficiencyRatio`, which feeds the score. Whether a resumed attempt is the same attempt, and how its time is accounted, is scoring policy.
- **Current state:** unchanged — interrupted sessions are surfaced, the draft remains persisted and recoverable from the database, and the learner is offered a new attempt.
- **Decision required:** whether an interrupted practice/simulation attempt may be resumed, and if so how its elapsed time and attempt identity are treated. Assessment is explicitly excluded here; that is D6.

#### D9 — What happens when evaluation itself fails? — **NOT AUTHORIZED**

- **Evidence examined:** `SessionStatus` already includes `evaluation_failed` (`simulation-engine/types.ts`), and the SQLite `status` CHECK accepts it — now proven by test. Nothing produces it. `sessionStore.submit` calls `evaluateAttempt` outside its try/catch, so a throw would reject the promise `handleSubmit` awaits: the session stays `in_progress`, nothing is saved, and the learner sees no response to pressing Submit. Architecture Package §28 lists a simulated *write* failure as a required fixture, but not an evaluation failure.
- **Why insufficient:** the status exists, but what the learner is told, whether the attempt may be retried, and whether a failed evaluation still counts as an attempt are all learner-facing policy. Encoding any of them — including "silently do nothing", which is today's behaviour — would be inventing a rule.
- **Current state:** unchanged and untested. Deterministic evaluation over validated content makes a throw unlikely, which is why this is recorded rather than treated as a live defect.
- **Decision required:** what a learner sees when evaluation fails, and what happens to the attempt.

#### D10 - What persists a web learner's progress? - **NOT AUTHORIZED**

- **Evidence examined:** Business Model Spec §3 step 4 ("a lightweight cloud persistence layer so refreshes do not lose progress"); §2 ("Web deployment and lightweight cloud persistence are not yet implemented"); `apps/desktop/src/persistence/repositories.ts`, which falls back to in-memory repositories whenever `__TAURI_INTERNALS__` is absent. Verified in a real browser: the web build runs and gates correctly, but a refresh loses the session.
- **Why insufficient:** the spec names the goal (a refresh must not lose progress) but not the mechanism. A browser-local store keeps progress per device; a hosted database makes it follow the learner across devices and implies accounts. That difference is a product promise about continuity - and an account model would also pull in authentication, which is not authorized.
- **Current state:** unchanged. The web target uses in-memory repositories; no browser or cloud persistence was added.
- **Decision required:** whether web progress is per-browser, per-account across devices, or both, and if cloud, which provider and account model.

## 4. Live-feedback trace and enforcement

### Trace (mechanisms that could reveal performance during an active session)

| Mechanism | Where | Signals ongoing performance? | Finding |
|---|---|---|---|
| Evaluation (`evaluateAttempt`) | `sessionStore.submit` only, after `completeSession` | Yes, if run early | Held by call order only → **now enforced** |
| Score, category breakdown, WHAT/WHY/HOW feedback | `SubmissionSummary`, mounted by `LiveScribing` only when status is `completed` | Yes | Held by routing only → **now enforced** in the component as well |
| Recommendations (`generateRecommendations`) | `SubmissionSummary` effect | Yes (performance-derived) | **Now guarded** |
| Competency updates | `sessionStore.submit` only | Yes | Held by `submit`; nothing reveals them in-session |
| Autosaved session record | `sessionStore.persistDraft` → repository | Would, if it carried an evaluation | `evaluation` was always `null` in practice → **now enforced** |
| Dashboard History, Analytics | Past persisted sessions only | No — past attempts, not the ongoing one | Outside the boundary |
| Elapsed timer | `SimulatorWorkspace` | No — elapsed time, not quality | Outside the boundary |
| Transcript reveal, learner flags, documentation fields | `SimulatorWorkspace` | No | Outside the boundary |
| Knowledge Base, Training lessons | Separate routes | No — reference material | Outside the boundary; see D4 |

### Enforcement

- **Domain:** `mayRevealPerformance(session)` in `nexus-core` is false for an assessment session in any status except `completed`, including `interrupted` and `abandoned`. `assertMayRevealPerformance` throws `LiveFeedbackNotAllowedError`. Practice and simulation are unrestricted, because no restriction is authorized for them.
- **State:** the autosaved record of an active assessment never carries an evaluation; a leaked one is stripped and the draft is still saved. `submit` asserts the boundary at the reveal point.
- **Presentation:** the store exposes `selectRevealableResult` / `useRevealableResult`, which return `null` while an assessment is active. `SubmissionSummary` reads the result only through that selector, so its score, breakdown, feedback and recommendations are gated by one decision rather than by checks each component must remember. `state.result` stays raw for `submit` (evaluate, persist, competency) and is no longer read by any UI.
- **Invariant:** `apps/desktop/src/store/liveFeedbackBoundary.invariant.test.ts` scans every non-test source file and fails if any file other than the store reads the raw evaluation, or if the desktop app re-implements the rule instead of importing it from `nexus-core`.

### Verification

- `nexus-core`: 5 tests, covering every status in both directions.
- Desktop: 12 tests (`liveFeedbackBoundary.invariant.test.ts`) covering the guarded selector for every mode and status, and the source-level invariants.
- Desktop: 8 tests (`assessmentFeedbackBoundary.test.tsx`), several of which inject a real evaluation into an active assessment to simulate a future leak.
- Mutation checks: the predicate always revealing, the autosave strip removed, the summary guard removed, and live evaluation on every keystroke were each caught by the test aimed at them.

## 5. Remaining Phase 8.3 work

| Work | Status |
|---|---|
| Assessment entitlement capability + matrix values | **DONE** — D1 = Pro, `34f727c` |
| Learner entry point and mode-level start enforcement | **DONE** — `34f727c` |
| Assessment results presentation | **DONE** — D3 = all six surfaces ON, satisfied by the existing summary and protected by tests |
| Closed-book navigation restriction | **DONE** — D4 = closed-book, enforced at the route |
| Analytics/competency separation | **DONE** — D5 = separate populations, enforced in the domain, the schema and the aggregation |
| Interrupted-Assessment policy | **DONE** — D6 = retake allowed, resume not offered; already satisfied, no production change |

**Assessment is now verifiable in a real browser.** The website preview client
(see the CHANGELOG entry "Website: Dark Theme and Persistent Fast-Track
Preview") runs at the highest tier through the real capability matrix, which
closed a limitation reported at every checkpoint from D1 onward: D4's
closed-book boundary, D5's separate assessment population and D7's contradiction
grading have each now been confirmed in a live Assessment, not only by tests.

D1, D3, D4, D5 and D6 are all decided: Assessment is reachable, runs closed-book, gives the full results experience on submission, counts as its own population, and may be retaken if interrupted. **Every Phase 8.3 Assessment decision is now resolved.** What remains open is outside Assessment mode: D7 (contradictory documentation), D8 (practice/simulation resume, with A6 as its engineering half), D9 (evaluation failure) and D10 (web persistence).
