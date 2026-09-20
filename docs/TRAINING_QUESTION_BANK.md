# Training Question Bank — canonical architecture

**Status:** schema, validator and tests implemented and **verified** — 48
question-bank tests green within a 526/526 repository suite, typecheck, build
and preflight clean. No runtime consumer exists, and none of the product
decisions listed at the end has been answered.

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
| Tests | `schema.test.ts`, `validate.test.ts`, `content-qa.e2e.test.ts`, `pilot-compatibility.e2e.test.ts` |
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

## 7. Extension points

Deliberately left as seams, not built:

- **Selection.** `isProductionEligible()` is the gate a selector should ask
  before a question reaches a learner. `variantGroup` is the signal a selector
  should use to avoid near-duplicates. Neither is consumed by anything.
- **Loading.** `content/question-bank/` has a validator and a content-QA test,
  but no loader. Adding one is a separate, explicit step.
- **Lesson linkage.** A future `linkedLessonIds`-style field would go on the
  question, not the lesson — but whether bank questions link to lessons at all
  is an open owner decision, so no field was added.
- **Repository.** No in-memory bank repository exists yet;
  `InMemoryTrainingLessonRepository` is the pattern when one is wanted.

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
