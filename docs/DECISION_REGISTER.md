# H.A.A. Nexus — Open Decision Register

**Purpose:** every decision currently blocking engineering work, in one place,
with the evidence already gathered and the options the current architecture
actually supports. Nothing here is decided. Each entry is written so that
answering it takes a sentence, not a research session.

**Status at `aeb56d6`:** 478 tests green (279 nexus-core, 144 desktop, 55
Rust); typecheck, build, `cargo check --all-targets` and `cargo fmt --check`
clean. Every audit below was re-verified against the repository at that commit;
`BUSINESS_MODEL_PRODUCT_SPEC.md` and `HAA_Nexus_Architecture_Package.md` have
not changed since `5a59cb4`.

**How to read an entry.** *Blocked work* is what cannot proceed. *Current
behaviour* is what the code does today, verified. *Options* are the smallest
set the existing architecture supports — they are alternatives, not
recommendations, and none has been chosen or encoded. *Unblocked* is what was
done or can still be done without answering the question.

---

## D1 — Which tier includes Assessment mode? — **RESOLVED**

**Resolved** by the owner on 2026-09-19: **Pro**.

| | |
|---|---|
| **Decision** | D1 — Assessment Mode access tier |
| **Selected value** | **Pro** |
| **Meaning** | Pro is the *minimum* tier that may start Assessment mode |
| **Access** | Free blocked · Practice blocked · Pro allowed · Fast-Track allowed |
| **Owner-authorized** | YES (2026-09-19) |
| **Status** | RESOLVED and implemented |

**Implementation:** a single capability, `canStartAssessment`, in the existing
`Entitlements` shape, with per-tier values in `CAPABILITY_MATRIX` (false, false,
true, true). `canStartMode(entitlements, mode)` in `nexus-core` maps a mode to
its capability, and `sessionStore.start` enforces it beside the existing
difficulty check. The Scenario Library shows an Assessment button only to
entitled tiers. No second tier hierarchy and no "assessment tier" concept was
introduced.

**Verification:** 296 nexus-core and 167 desktop tests pass, including all four
tiers against the single policy, direct invocation of the start boundary with
no UI involved, refusal leaving no session or draft behind, both axes applying
together (Pro may start an Assessment at difficulty 4 but not 5), and
practice/simulation unchanged for every tier. In the live UI at Free: no
Assessment button, and the normal Practice flow still starts.

**Difficulty is unchanged:** 2 / 3 / 4 / 6 across the tiers. Assessment access
and difficulty access are separate axes and both still apply.

**This resolves D1 only.** Assessment being reachable makes existing
mode-agnostic behaviour observable, which is *not* the same as deciding it:
D3 (post-submission experience), D4 (closed-book), D5 (analytics/competency
treatment) and D6 (interrupted policy) remain open, and nothing about them was
changed or implied here.

### Evidence considered while this decision was open

**What it was blocking:** the Assessment entitlement capability and its per-tier
values; a learner entry point in the scenario library; mode-level enforcement
in `sessionStore.start`. Everything downstream of an Assessment a learner can
actually start, including D3–D6.

**Current behaviour:** Assessment exists as a session mode end to end — the
no-pause rule, migration 002, workspace support and the live-feedback boundary
— but **no learner can start one**. There is no entry point and no capability
in `CAPABILITY_MATRIX`.

**Evidence examined:** Business Model Spec §4 tier table names Assessment in
no row; §4 entitlement rules say only *that* it must be gated by an explicit
capability; §9 and §12 give timing, not placement. "Exam-Ready Pro" is a
product name, not a statement of entitlement. Re-audited at `aeb56d6`:
unchanged.

**The options that were on the table** (each is one row of data in
`capability-matrix.ts` plus an entry point):

| Option | Consequence |
|---|---|
| Assessment from Practice upward | The $15 tier gains the exam feature; Pro's incremental value rests on competency/analytics alone |
| Assessment from Pro upward | Matches the "Exam-Ready" naming; Practice stays scoring-only |
| Fast-Track only | Makes Assessment a premium add-on; smallest free/paid surface |
| Free tier included | No paywall on exam mode; conversion rests entirely on difficulty bands |

Adding the capability with `false` everywhere is **not** a neutral option — it
encodes "no tier includes Assessment", which is itself a product decision.

**Unblocked and already done:** the D2 boundary is enforced structurally
(guarded selector plus a source-scanning invariant), so whichever tier is
chosen, an active Assessment cannot leak performance information.

---

## D11 — Where do canonical Training questions live? — **RESOLVED**

**Resolved** by the owner on 2026-09-19: **Option B — a separate, reusable
Training Question Bank.**

| | |
|---|---|
| **Decision** | D11 — canonical Training content architecture |
| **Selected value** | **Option B — separate reusable Question Bank** |
| **Meaning** | each question is its own record, independent of any lesson |
| **Rejected alternative** | extending `TrainingLesson.knowledgeChecks[]` |
| **Owner-authorized** | YES (2026-09-19) |
| **Status** | RESOLVED; schema, validator and tests implemented |

**Implementation:** a new `question-bank` module in `nexus-core` with a strict
schema, a `validateQuestionBank` / `validateTrainingQuestion` pair following the
`validateScenario` convention, and `content/question-bank/` as a content
location scanned by no existing test. Full architecture in
`TRAINING_QUESTION_BANK.md`.

**This resolves D11 only.** The bank is a content contract. It has no consumer:
no selector, no runs, no randomisation, no seen-item tracking, no scoring, no
entitlement mapping. `difficultyLevel` is an authoring signal and is **not**
mapped to a tier — Training entitlement remains undecided, as does seen-item
persistence (depends on D10), competency mapping (A2) and recommendation use
(A7).

**Legacy lessons are untouched.** `TrainingLessonSchema`, the three shipped
lesson files, their six knowledge checks and the Training screen are unchanged.
Whether those checks stay, coexist or migrate is a further owner decision that
this one deliberately did not answer.

**Pilot Batch 001 is unchanged and unpromoted.** Revision 2 is held as a test
fixture, byte-identical and hash-asserted, purely to prove the schema can carry
real authored content. Its 12 items remain `CANDIDATE` /
SOURCE-VERIFICATION-PENDING with 0 production-eligible; human source-locator
verification stands at 0 of 12 and is a human gate no code can advance.

### Evidence considered while this decision was open

**What it was blocking:** every field the pilot carries that the repository
cannot represent — stable item ids, choice ids, per-choice explanations,
rationale, provenance, difficulty on Training content, question type, learning
objective, variant group, lifecycle status, expiry and coding reference. Where
each of those lives depended entirely on this answer.

**Current behaviour at the time:** Training content was lesson-shaped only.
`KnowledgeCheck` carried `{ question, options[], correctOptionIndex }` and
nothing else; unknown keys were silently stripped and `correctOptionIndex` was
not bounds-checked against `options`. Both observations are recorded in
`Claude outputs/nexus-pilot-001-compatibility-report.md` and both are now
impossible in the bank, which rejects unknown fields by name and requires the
correct-answer reference to resolve. The lesson schema itself was not changed.

---

## D12 — Where does non-terminology reference knowledge live?

**Blocked work:** turning Pilot Batch 001 (and any future regulatory or
reference material) into canonical Knowledge records.

**Current behaviour, verified 2026-09-20:** the only Knowledge Base in the
product is the terminology lookup. Its schema is
`{id, layTerm, clinicalTerm, acceptedAlternatives, category, context, explanation, commonMistakes}`
and a search of `terminology-engine/schema.ts` for
`jurisdiction|effectiveFrom|humanVerified|locator|provenance` returns **zero**
matches. It carries no provenance, jurisdiction, effective-date, verification
state or source-question relationship.

**Why it cannot simply be reused:** the schema maps a *lay term to a clinical
term* for scribe documentation. "Protected health information (PHI)" has no
lay/clinical pair, and "October 1 2026 to September 30 2027" is not a
terminology entry. Putting regulatory statements there would change the
meaning of the surface learners reach during Practice (and which D4 closes
during an Assessment), not just its contents.

**Why it was not decided autonomously:** the Pilot Batch integration gate
(§C2) records the carrying schema as *"an owner-level product shape decision;
do not resolve it silently."* Adding a Knowledge record type is that decision.

**Options the architecture supports:**

| Option | Consequence |
|---|---|
| Extend the terminology schema | One lookup surface; dilutes a focused lay-to-clinical mapping with regulatory material that has different lifecycle and expiry needs |
| A distinct Knowledge record type | Clean provenance, jurisdiction and effective dates; a second content system to load, validate, QA and gate |
| Keep regulatory material as Question Bank items only | No new system; the material is only ever reachable as questions, never as reference |

**Independent of this decision:** no Pilot 001 item may become learner-facing
until a person completes the verification worksheet. All 12 carry
`HUMAN-VERIFY-REQUIRED` with `humanVerifiedBy`/`humanVerifiedOn` null, and
`question-bank/schema.ts` states that only a person who opened the cited
document may fill them. **Both gates are separate**: deciding where knowledge
lives does not verify it, and verifying it does not decide where it lives.

**Unblocked:** nothing is waiting on engineering. The Question Bank schema,
validator, repository, loader, selector and run lifecycle are all implemented
and tested.

---

## D10 — What persists a web learner's progress?

**Blocked work:** roadmap step 4 (web-deployed build). Step 5 (PayMongo)
depends on step 4 plus provider credentials.

**Current behaviour, verified in a real browser:** the production `dist/` runs
outside Tauri with no console errors, all six routes render, routing is
hash-based (static hosting needs no rewrite rules), and Free-tier gating
behaves exactly as on desktop. `repositories.ts` falls back to **in-memory**
repositories whenever `__TAURI_INTERNALS__` is absent, so **a refresh loses the
session**. `localStorage` is available but unused.

**Evidence examined:** Business Model Spec §3 step 4 ("a lightweight cloud
persistence layer so refreshes do not lose progress") states the goal, not the
mechanism; §2 lists web deployment and cloud persistence as not implemented.

**Options the architecture supports** (the repository interfaces already
abstract storage, so each is an implementation behind the same contract):

| Option | Consequence |
|---|---|
| Browser-local (IndexedDB/localStorage) | Refresh-safe per device; no accounts, no provider, no auth; progress does not follow the learner |
| Hosted database | Progress follows the learner across devices; requires a provider **and** an account model, which pulls in authentication |
| Both (local cache, server of record) | Best continuity; largest surface, and still requires the account decision |

The distinguishing question is not technical: it is whether the product
promises continuity across devices.

**Unblocked:** everything except choosing the layer. The web target is
verified browser-capable; repository contracts, serialization fixtures and the
Tauri/in-memory split already exist and would not change.

**Development-only scaffolding (2026-09-19, autonomous):** `pnpm dev:desktop`
now persists to `localStorage` so a reload does not wipe the session while
this decision is open. It is gated on `import.meta.env.DEV`, excluded from
test mode, and absent from any production bundle. It has no migration story,
no schema versioning and no account model, and **does not** resolve D10 in
either direction - `persistenceMode` reports which backend is live.

---

## A2 — The module registry declares 12 competency domains; the evaluator produces 7

**Blocked work:** making the registry honest, in either direction.

**Current behaviour, verified:** `apps/desktop/src/modules.ts` declares 12
human-readable domains ("Chief Complaint", "HPI", "ROS", …). The evaluator
scores **7** category domains (`accuracy`, `completeness`, `terminology`,
`relevance`, `structure`, `pertinentPosNeg`, `timeEfficiency`), and those are
what `submit` folds into competency. Nothing reads `competencyDomains` — it is
declared and unused.

**Evidence examined:** Architecture Package §5 specifies `NexusModule` with
`competencyDomains: string[]` and the example `["HPI", "ROS", "Terminology", …]`
— i.e. the architecture describes *section-level* domains, while the evaluator
implements *category-level* scoring. Architecture §21 lists per-section domains
individually.

**Options:**

| Option | Consequence |
|---|---|
| Align the registry to the evaluator's 7 | Field becomes truthful immediately; contradicts the §5 example and drops the section-level model from the contract |
| Implement per-section scoring (7 → 12) | Matches §5/§21; changes what competency *means* and what learners see, and needs a competency migration |
| Remove the field from `NexusModule` | Removes dead data; changes a documented architecture contract |

**Why this is not mine to pick:** options 2 and 3 change either grading
semantics or a documented contract; option 1 silently retires the
section-level model the architecture describes.

**Unblocked:** nothing needed — the field is inert, so there is no defect to
fix while the question is open.

---

## A9 — Scenarios have no schema-version concept

**Current behaviour, verified:** `modules.ts` carries
`scenarioSchemaVersion: "0.0.0-unbuilt"` with a comment saying the real engine
arrives in Phase 2 (long since shipped). There is **no** canonical scenario
*schema* version anywhere in `nexus-core` — scenario files carry a per-scenario
content `version` ("1.0"), which is a different thing. Nothing reads the field.

**Trace:** scenario JSON → Zod `validate.ts` → `Scenario` domain model →
`SessionRecord.scenarioVersion` (content version, persisted) → replay via
content hash. Compatibility today rests on the **content hash gate** (A3,
cleared): a released scenario cannot be edited without a version bump.

**Options:**

| Option | Consequence |
|---|---|
| Leave as is | The field stays dead and visibly stale |
| Introduce a real schema version | Needs a policy: when it increments, what a mismatch does at load time, and how old persisted sessions are treated |
| Remove the field from `NexusModule` | Same contract change as A2 option 3 |

**Why it is blocked:** writing any value there is a claim about compatibility
policy that no source defines; inventing "1.0" would be fabricating a fact.

---

## A6 — Exact mid-transcript resume is not implemented

**Blocked work:** persisting transcript reveal position and restoring an
interrupted attempt in place. **Blocked because:** resuming changes elapsed
time, which feeds `timeEfficiencyRatio` and therefore the score, so attempt
identity and time accounting are product decisions — this is the engineering
half of **D8**, and Assessment resume is separately blocked by **D6**.

**Current behaviour, verified:** `revealedCount` is **not** part of
`SessionRecord` — it appears nowhere in the persistence types or the IPC
fixtures. Drafts, flags, timings and status are persisted; transcript position
is not. Interrupted sessions are surfaced on the Dashboard and the learner is
offered a fresh attempt.

**Evidence:** Architecture §20 ("surfaced as *Resume interrupted session?*") and
§10 (autosave so "interrupted sessions must not lose work"). Neither says what
resuming does to the attempt.

**Dependency:** this is the engineering half of **D8**. Resuming changes
elapsed time, which feeds `timeEfficiencyRatio`, which feeds the score — so
attempt identity and time accounting are product decisions, not
implementation details. Assessment resume is separately blocked by **D6**.

**Unblocked:** adding `revealedCount` to the record is a small, decision-free
schema addition **only if** resume is authorized; doing it first would be
speculative infrastructure.

---

## A7 — Recommendations ignore competency trends

**Current behaviour, verified:** `recommendation-engine` contains no reference
to `CompetencyRecord` or competency at all; recommendations are driven by
error frequency from session history.

**Blocked because:** what a learner is told to do next is product behaviour.
Weighting recommendations by competency trend changes the guidance learners
receive, and no source defines that weighting.

**Unblocked:** nothing pending — the current rules are deterministic and
tested.

---

## A12 — Content inventory is too thin for a paid tier

**Current behaviour, verified:** 2 scenarios exist, at difficulty 1 and 3.
Free unlocks 1 of 2; Practice, Pro and Fast-Track unlock the same 2. No
difficulty 2, 4, 5 or 6 content exists.

**Consequence:** three of four tiers currently deliver identical content. This
is a commercial-readiness gap, not an entitlement defect — gating is correct
and tested against the six-level matrix using test-only fixtures, so no content
was fabricated to make tiers look complete.

**Blocked because:** authoring clinical scenarios is content work requiring
clinical review, not an engineering decision.

**Concrete consequence, measured 2026-09-20:** the released inventory is one
difficulty-1 and one difficulty-3 scenario. Difficulty 3 is unlocked from
**Practice** upward, so **no authored content exercises Pro's difficulty-4
ceiling or Fast-Track's exclusive 5-6 range at all**. The entitlement ladder is
implemented and enforced; there is simply nothing above difficulty 3 for the
two paid tiers to unlock, which is a content gap rather than an engineering
one.

**Authoring on-ramp (2026-09-19, autonomous):** `content/incoming/` holds a
template and an intake suite that validates drafts against the real schema
and reports actionable errors per file, so authoring does not require reading
the schema first. It checks structure only — clinical truth remains a human
judgement, and no content was authored or approved.

---

## D3–D9 (Assessment and evaluation policy)

Recorded in full in `PHASE_8_3_ASSESSMENT_MODE.md`: post-submission experience
(D3), closed-book access (D4), analytics/competency treatment (D5),
interrupted-Assessment policy (D6), contradictory-documentation grading (D7),
practice/simulation resume (D8), evaluation-failure behaviour (D9). D2 is
authorized and enforced. **D3, D4, D5, D6 and D7 were all answered on
2026-09-20. Every Phase 8.3 Assessment decision is resolved, and D7 with them;
D8 and D9 remain open.**

**D7 — contradictory documentation — answered 2026-09-20 under delegated
authority.** A note that documents a pertinent negative and asserts the
opposite in the same section is a `critical_documentation_error`, at critical
severity, counting against accuracy like any other unsupported assertion.
Before this it cost nothing at all: the first match satisfied the requirement,
so "No fever. Fever present." scored **accuracy 100 with no error**. No new
error type, severity or scoring formula was invented -
`critical_documentation_error` already existed with a critical floor and no
evaluator produced it, and the score effect reuses the existing
false-assertion counter. Scoped to pertinent negatives, where the existing
negation machinery detects the contradiction reliably; this is not general
contradiction detection. The note comparison's status union was extended in
the same change, because otherwise a contradicted requirement would read back
as "Documented" while the feedback list called it critical. Full record in
`PHASE_8_3_ASSESSMENT_MODE.md` D7.

**D6 — interrupted Assessments — answered 2026-09-20 under delegated
authority.** A learner may **retake** an interrupted Assessment as a new
attempt; exact in-place resume is **not** offered. The interrupted attempt is
recorded as `abandoned`, not deleted, and contributes nothing. Resume was not
selectable: it is the engineering half of **D8** (restoring an attempt changes
elapsed time, which feeds the score), so choosing it would have decided D8. A
terminal "no retake" lock was rejected as destructive and unsourced - and the
score-shopping worry behind it does not apply, because **D2** shows the learner
no performance during an active Assessment and **D5** means an interrupted
Assessment carries no evaluation and counts in neither population. **No
production change was required**: the existing Dashboard flow already did
exactly this, and is now pinned by `interruptedAssessment.test.tsx`. Full
record in `PHASE_8_3_ASSESSMENT_MODE.md` D6.

**D5 — analytics and competency treatment — answered 2026-09-20.** Assessment
results count **separately** from Practice results in both. The distinction is
carried through the domain (`ResultPopulation`), the competency record, the
repository key, SQLite (migration 003: `UNIQUE(user_id, population, domain)`)
and the aggregation (`computeAnalytics` takes the population as a required
argument), so a merged total cannot be produced by forgetting to filter.
Simulation still counts as practice - D5 said nothing about it. Recommendations
still read both populations, deliberately: D5 governs competency and analytics,
and scoping recommendations would have invented a policy nobody supplied.
Full record in `PHASE_8_3_ASSESSMENT_MODE.md` D5.

**D4 — reference access during an Assessment — answered 2026-09-20.**
Closed-book: Knowledge Base OFF, Training OFF, direct route access BLOCKED, and
no tier exception. Enforced by `mayAccessReferenceMaterial` in `nexus-core` and
`ReferenceGate` on the two routes, so a typed URL or a programmatic navigate is
blocked and not merely unlinked. The books reopen on submission, which is what
leaves D3 intact. **The knowledge archive is not restricted** - `content/` stays
fully available to authoring and validation tooling; D4 closes a runtime learner
surface during an attempt, not the content that feeds it. Full record in
`PHASE_8_3_ASSESSMENT_MODE.md` D4.

**D3 — Assessment post-submission experience — answered 2026-09-20.** All six
surfaces ON: score, category breakdown, WHAT/WHY/HOW feedback, expected-answer
comparison, recommendations, immediate retry. The characterization performed
earlier the same day showed the existing mode-agnostic summary already did all
six, so the decision required no behaviour change - it was implemented by
protecting what existed with a contract test
(`assessmentPostSubmission.test.tsx`), not by writing new results code. Full
record in `PHASE_8_3_ASSESSMENT_MODE.md` D3.

*What D3 did not decide:* Knowledge Base access during an Assessment (D4),
whether Assessment attempts should count in analytics and competency (D5), and
what happens to an interrupted Assessment (D6). Assessment attempts do count
today; D3 left that exactly as it was rather than ratifying it.

---

## Roadmap steps 4 and 5

| Step | State |
|---|---|
| 4 — web-deployed build | Frontend verified browser-capable; **blocked on D10** for persistence |
| 5 — PayMongo billing | Blocked on step 4, plus provider credentials and account configuration that must not be fabricated |

---

## What is not blocked

As of `aeb56d6`, no substantive engineering work remains that does not depend
on one of the decisions above. The most recent unblocked items have been
completed: runtime IPC verification and the `tauri dev` fix, the release build
and installers, the Content Security Policy, the §34(10) note comparison, and
atomic competency folding. Phase 7 accepted debt A1, A3, A4, A5, A8, A10 and
A13 are cleared; A2, A6, A7, A9 and A12 are the entries above.

The one non-decision prerequisite outstanding is operational: remote Session
Monitor access needs a tunnel provider account and a local install, which is an
owner action, not an engineering task.
