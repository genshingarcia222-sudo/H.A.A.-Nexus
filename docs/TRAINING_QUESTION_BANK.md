# Training Question Bank — canonical architecture

**Status:** schema, validator, repository, loader and tests implemented and
**verified** — 86 question-bank tests green within a 665/665 repository suite,
typecheck, build and preflight clean. Its first consumer, the Training
selector, now exists (`TRAINING_QUESTION_SELECTION.md`); there is still no
learner-facing Training UI, nothing records an answer and nothing scores. None
of the product decisions listed at the end has been answered.

**Owner decision applied:** *Option B — a separate, reusable Training Question
Bank*, recorded 2026-09-19 (`docs/DECISION_REGISTER.md` D11). Each question is
its own record, independent of any lesson. This document describes what was
built; it does not decide anything the owner has not.

---

## 1. Why a bank, and not more lesson fields

A Training question is not a property of a lesson. The same question is wanted
by a future selector, by remediation after a failed scenario, and by Assessment
— none of which is "a lesson". Modelling questions as fields inside
`TrainingLesson` would have made the lesson the canonical question store and
forced every later consumer to go through it.

So the bank is the canonical, reusable representation:

```text
Training Question Bank   (canonical question content)
        ↓
future Training runtime  (selection, runs, replay diversity)
        ↓
optional future lesson references
        ↓
future remediation / Assessment consumers
```

Each arrow is a *future* consumer. None of them exists yet, and no field in the
schema was added in anticipation of one.

## 2. Where it lives

| Thing | Location |
|---|---|
| Schema | `packages/nexus-core/src/question-bank/schema.ts` |
| Validator | `packages/nexus-core/src/question-bank/validate.ts` |
| Repository | `packages/nexus-core/src/question-bank/repository.ts` |
| Loader (platform-neutral) | `packages/nexus-core/src/question-bank/loader.ts` |
| Loader (filesystem discovery) | `packages/nexus-core/src/question-bank/loader-node.ts` |
| Tests | `schema.test.ts`, `validate.test.ts`, `repository.test.ts`, `loader.test.ts`, `loader-node.test.ts`, `content-qa.e2e.test.ts`, `pilot-compatibility.e2e.test.ts` |
| Bank content | `content/question-bank/` (empty; see its README) |
| Pilot 001 fixture | `packages/nexus-core/src/question-bank/__fixtures__/` |

`question-bank` is a sibling engine module under `nexus-core/src`, not a
subfolder of `training-engine`, because its consumers are not only Training.

**`content/question-bank/` was chosen because it is scanned by nothing.**
`content/lessons/` is validated as lessons by `training-engine`'s content-QA
suite, `content/incoming/` as scenario drafts by scenario intake, and
`content/scenarios/**` by both preflight and the scenario content-QA suite. A
bank file in any of those fails a test about something else. The new directory
has its own validator and its own test, and the desktop app discovers content
only by explicit static import, so nothing there can reach a learner by
accident.

## 3. The question record

### Identity
- `questionId` — stable, and unique within a bank (enforced).

### Content
- `question`, `choices[]`, `correctChoiceId`.

Each choice is `{ id, text, why? }`. **Identity is the id, never the position.**
The existing `KnowledgeCheck` shape (`options: string[]` +
`correctOptionIndex`) means reordering options for display silently changes
which answer is correct, and the index is not bounds-checked against the
options. Neither failure is possible here: `correctChoiceId` must match a
declared choice id, and duplicate choice ids are rejected.

This is enough for the feedback behaviour Training will eventually want —
correct/incorrect styling on the selected choice, revealing the correct answer,
showing the rationale, showing why a chosen distractor was wrong — without any
of that UI being built yet.

### Instructional feedback
- `rationale` — required. A question that cannot explain its own answer teaches
  nothing once the learner has guessed.
- `choices[].why` — optional per-choice explanation. Optional because not every
  distractor earns one, and filler text would be worse than its absence.

### Training classification
- `domain`, `skillArea`, `questionType`, `learningObjective`, `difficultyLevel`.

`questionType` is a closed set (`recognition`, `recall`, `interpretation`,
`scenario`, `workflow-sequencing`) so a typo cannot create a silent new category
no consumer knows how to render.

`difficultyLevel` is the same 1–6 scale the scenario side uses. It is restated
in this module rather than imported, so a Training content contract does not
depend on the scenario engine; `schema.test.ts` asserts the two scales agree, so
a drift fails loudly. **It is an authoring signal about the question. It is not
a tier, and nothing in this module maps it to one.**

### Provenance
- `source` — required, in one of two shapes:
  - `{ ref, locator }`, resolved against the bank's `sources` table (enforced:
    a dangling ref is an error);
  - or an inline `{ authority, title, url?, dateOrVersion?, jurisdiction?, locator }`,
    so a single question can stand alone.
  A half-ref/half-inline object is rejected rather than guessed at.
- `codingReference` — optional: `{ system, jurisdiction, release, effectiveFrom?, effectiveTo?, codes[] }`.
  Optional by design: forcing these onto a privacy question would make every
  author supply a meaningless jurisdiction and release.

**Provenance is stored, not judged.** The schema records *which document a
question claims to rest on*. It asserts nothing about whether the question is
medically, legally or clinically correct, and no code path can make that
assertion.

### Lifecycle
```text
candidate → source-verified → content-reviewed → approved → production-eligible
```
plus two states off the ladder: `blocked` and `retired`. A hold state is not
"further along" than anything, and can never be production-eligible.

`reviewStatus` is a separate axis: `pending`, `in-review`, `changes-requested`,
`approved`, `rejected`.

**A question may not claim a status above `candidate` unless a person is
recorded against it** — `verification.humanVerifiedBy` and
`verification.humanVerifiedOn` must both be set. `verification` has no default,
because a verification record that appears by itself is exactly the thing the
field exists to prevent.

`isProductionEligible()` is the one predicate a future selector should ask. It
is read-only and conservative: status, review outcome *and* a recorded human
verification must all line up. A question merely *labelled* production-eligible
does not pass. The workflow that would legitimately *set* those values is
deliberately not implemented.

### Diversity and expiry
- `variantGroup` — groups near-identical questions so a future selector can
  avoid serving two at once. The selector itself does not exist.
- `validUntil` — for content bound to a dated citation, such as a fiscal-year
  guideline.
- `flags[]` — free-form authoring/review markers.

## 4. The validator

`validateTrainingQuestion(raw)` and `validateQuestionBank(raw)` return
`{ success: true, data } | { success: false, errors }`, matching
`validateScenario`. Failures are hard failures, not warnings.

Beyond field types it enforces: unique question ids within a bank, unique choice
ids within a question, a correct-answer reference that resolves, resolvable
source refs, a valid difficulty and lifecycle state, ISO dates, and the
promotion guard above.

### No silent field loss

Every object in the schema is `.strict()`. An unrecognised key is a **hard
error naming the field**, not a silent strip.

This is the one place the bank deliberately departs from the existing lesson
schema's behaviour. `TrainingLessonSchema` drops unknown keys without a word,
which is how a rationale, a citation or a lifecycle status could be authored,
accepted, and then simply not exist. Provenance and review status are precisely
the metadata that must never disappear quietly, so here it cannot.

The existing lesson schema was **not** changed. Making it strict would be a
behaviour change to shipped content validation, which is not this checkpoint's
job.

## 5. Coexistence with `TrainingLesson.knowledgeChecks[]`

**Nothing about lessons changed.** `TrainingLessonSchema`, the three shipped
lesson files, the six knowledge checks in them, the Training screen and the
learner's experience are all exactly as they were. No lesson was migrated, and
no lesson reads the bank.

The two models coexist deliberately:

| | `TrainingLesson.knowledgeChecks[]` | Question Bank |
|---|---|---|
| Unit | a check inside one lesson | a question, standing alone |
| Identity | position in an array | stable `questionId` |
| Answer key | `correctOptionIndex` (unbounded) | `correctChoiceId` (must resolve) |
| Rationale / provenance / lifecycle | none | required / required / required |
| Unknown fields | silently stripped | rejected by name |
| Consumers today | the Training screen | none yet |

The bank is the canonical model for *new* reusable question content. Whether the
six existing knowledge checks stay where they are, coexist, or migrate is an
owner decision that the decision record explicitly left open, and this
checkpoint did not touch it.

## 6. Pilot Batch 001 — a fixture, and only a fixture

Revision 2 of the pilot is held at
`packages/nexus-core/src/question-bank/__fixtures__/nexus-pilot-batch-001.candidates.r2.json`,
byte-identical to the frozen baseline. `pilot-compatibility.e2e.test.ts` asserts
its SHA-256 against the handoff manifest, so a silent edit fails loudly.

It proves one claim: **the canonical model can carry real authored content
without losing a field.** All 12 items validate. Every item-level field maps to
a canonical field (`id` → `questionId` is the only rename). Because the schema
is strict, anything unrepresentable would surface as a named error rather than
vanish.

**The exact gap, stated rather than hidden.** Four batch-level keys are carried
(`batchId` → `bankId`, `revision` → `version`, `sources`, `items` →
`questions`). Nine are not:

`createdOn`, `schemaStatus`, `difficultyScale`, `icdSystemPolicy`,
`sourceVerificationMethod`, `versionNote`, `blockedTopics`, `batchSummary`,
`revisionNotes`.

Every one of them describes the *authoring batch* — how this set of candidates
was produced and what is still unverified about it — rather than any question. A
question record that must be reusable across Training, remediation and
Assessment has no business carrying a note about which fetch tool produced an
extract in September 2026. They stay with the batch document, which remains the
authoritative record for the human review gate. The test pins the split, so a
new pilot field with nowhere to go fails by name.

**What the fixture is not.** It is not content: it is not under `content/`, no
loader reads it, and the desktop app discovers content only by explicit static
import. It is not promoted: all 12 items are `CANDIDATE` /
SOURCE-VERIFICATION-PENDING, human verification stands at **0 of 12**, and
production-eligible is **0**. Tests fail if any of that changes here. No code in
this checkpoint marks anything source-verified, and none can — only a person who
opens the cited document may set `humanVerifiedBy`.

## 7. The repository and the loader

These are the seam every future consumer goes through. Neither chooses, scores
or shows anything.

### `QuestionBankRepository`

Three methods, deliberately:

```ts
getById(questionId): TrainingQuestion | undefined
getAll(): TrainingQuestion[]              // everything, status included
getProductionEligible(): TrainingQuestion[]  // only what a learner may see
```

A future Training run, a remediation surface and a future Learning Assessment
all need *"give me the questions"* and *"give me this one"*. None needs a query
language, and inventing one would encode guesses about selection nobody has
made.

`getProductionEligible()` is a **safety gate, not a query**. It applies
`isProductionEligible`, which already requires content status, review outcome
*and* a recorded human verification to line up. It is how a learner-facing
consumer avoids being handed candidates by default. It promotes nothing.

`InMemoryQuestionBankRepository` mirrors `InMemoryTrainingLessonRepository` —
register validated records, then read — with two guarantees added, because bank
content carries provenance and a review lifecycle that must not drift:

- **Stored records are private, deep-frozen clones.** A consumer cannot edit a
  question's status, rationale or source through a reference it was handed;
  registering does not freeze the caller's own object either.
- **Reads are deterministic.** Registration order every time, and a fresh array
  each call, so a consumer sorting or splicing the result cannot disturb the
  next reader.

A duplicate id throws rather than overwriting: one question would silently
disappear, and with a citation attached that is a question whose source no
longer matches its text.

### The loader

Split in two, and this is a constraint rather than a preference.
`nexus-core` production code contains **no `node:` imports anywhere**, and the
desktop app bundles the package for the browser through Vite. A `node:fs`
import on the public surface would break that build.

- **`loader.ts`** — platform-neutral. Takes file *contents* somebody else has
  read; parses, validates, returns. Exported from the package index.
- **`loader-node.ts`** — filesystem discovery only (`.json`, `_`-prefixed files
  skipped as in scenario intake, sorted by name, a missing directory reads as
  empty). **Not exported from the index**, so the browser never sees it; Node
  callers import it by path. The build is checked: the shipped bundle contains
  no `node:fs` and no loader-node symbol.

Loader behaviour worth knowing:

- **Every problem in every file is reported**, not just the first — an author
  fixing content should see the whole list.
- **Nothing loads unless everything validates.** A partial load means a consumer
  silently working from a subset of a bank that carries provenance.
- **Ids must be unique across the whole bank**, not merely within one file.
- **Status survives untouched.** A candidate that goes in comes out a candidate.
  The loader writes nothing and promotes nothing.

`createQuestionBankRepository(files)` is the one-call path. The repository it
returns holds every question that loaded, whatever its status, because
development and validation tooling needs to see candidates — **being handed the
repository is not permission to show its contents to anybody.**

### The first consumer

**Selection now exists**, in `training-engine`, not here — see
`TRAINING_QUESTION_SELECTION.md`. It consumes `getProductionEligible()` as its
pool and `variantGroup` as its diversity signal, exactly as this document
anticipated, and it re-derives neither. The bank still answers only *what valid
questions exist*.

Still not built: recency, seen-item history and anti-memorisation persistence
(`excludeQuestionIds` is a caller-supplied seam, not a store), adaptive
difficulty, and any learner-facing Training UI.

- **Lesson linkage.** A future `linkedLessonIds`-style field would go on the
  question, not the lesson — but whether bank questions link to lessons at all
  is an open owner decision, so no field was added.

## 7a. Assessment readiness — what was found

Inspected rather than assumed, so a future Learning Assessment is not built on a
guess.

```text
ASSESSMENT READINESS

Implemented:   Assessment exists as a SESSION MODE OVER SCENARIOS, not a
               question-based exam. No-pause session machine
               (PauseNotAllowedError), persisted `assessment` mode (migration
               002, schema v2), entitlement gate `canStartAssessment`,
               closed-book `mayAccessReferenceMaterial` + `ReferenceGate`,
               live-feedback boundary (`mayRevealPerformance`,
               `selectRevealableResult`), and the post-submission summary.
               It grades a documentation draft against a Scenario's
               requiredDocumentation via the evaluation engine.

Documented:    docs/PHASE_8_3_ASSESSMENT_MODE.md — authorized requirements (§1),
               implemented capabilities (§2), decision log (§3), remaining
               work (§5).

Owner-authorized: D1 (requires Pro), D2 (live-feedback principle), D3 (all six
               post-submission surfaces ON), D4 (closed-book), D5 (Assessment
               counts as its own population), D6 (an interrupted Assessment may
               be retaken, not resumed). **Every Phase 8.3 Assessment decision
               is now resolved.**

Question-based Assessment support: NONE, and none is implied. Assessment's input
               is a scenarioId/scenarioVersion and a documentation draft. No
               multiple-choice question model exists anywhere in it, and no
               Assessment code references the Question Bank — verified by
               scanning: the only two mentions outside question-bank/ and
               training-engine/ are a doc comment and the package barrel export.
               A question-based "Learning Assessment" is a DIFFERENT, currently
               non-existent capability.

Blocked:       Outside Assessment mode — D7 (contradictory documentation), D8
               (practice/simulation resume, with A6 as its engineering half),
               D9 (evaluation failure), D10 (web persistence).

Potential Question Bank reuse: the repository interface IS the seam. A future
               question-based Learning Assessment would consume
               `getProductionEligible()`, exactly as the Training selector now
               does, and would bring its OWN selection rules rather than reusing
               Training's. Nothing more is needed from the content model today.

Missing content requirements: before question-based Assessment content can be
               authored, the owner must define coverage (which domains and skill
               areas an assessment spans), length, scoring and pass/fail
               semantics, whether rationale is shown and when — and, most
               consequentially for content integrity, whether Assessment draws
               from the SAME pool as Training or a RESERVED one.
```

**No Assessment consumer interface was created.** The current Assessment
specification defines no question-based content requirement — it is
scenario-based throughout — so there is nothing concrete to anchor one to, and
writing it would mean inventing product semantics. The repository interface is
already consumer-neutral; that is the preparation, and it is enough.

**One engineering observation, flagged not decided.** If Assessment ever draws
from the same pool Training practises on, a learner can meet an exam question
during practice, which defeats the exam. The bank can express either
arrangement — a reserved pool is a `domain`/`skillArea` convention plus a
selector rule, needing no schema change. Which arrangement is correct is
**PRODUCT DECISION — BLOCKED**, and nothing here assumes an answer.

**Shared content does not mean shared behaviour.** Training may randomise,
give immediate feedback and show rationale; Assessment may later differ on
feedback timing, scoring, progression and completion. Those differences belong
to the consumer, not to the content model, and none of them is implemented.

## 8. Explicitly unresolved

None of the following is decided, implied or encoded anywhere in this
implementation:

- **Entitlement** — no Training capability exists, and `difficultyLevel` is not
  mapped to any tier.
- **Seen-item persistence** — depends on D10 (web persistence), unanswered.
- **Runtime selector** — 10-question runs, randomisation, replay controls and
  anti-memorisation logic are all unbuilt.
- **Scoring** — nothing scores a bank question.
- **Competency** — no mapping from `domain`/`skillArea` to a competency domain
  (see A2, also open).
- **Recommendations** — the recommendation engine does not read the bank.
- **Assessment Mode** — no Assessment consumer.
- **Taxonomy** — whether lesson `category` maps to `domain` or `skillArea`.
- **Question id format** — the schema requires a stable unique string and
  nothing more.
- **Medical truth** — not a schema question. It is the human source-verification
  gate, which stands at 0 of 12 for the pilot.
