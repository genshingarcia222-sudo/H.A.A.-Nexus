# Training question selection — the 10-question run

**Status:** implemented and verified — 33 selection tests green within a 665/665
repository suite, typecheck, build and preflight clean.

**What this is not:** there is no Training UI for it, nothing records an answer,
nothing scores, nothing remembers what a learner has seen, and no tier governs
access. This is the layer that decides *which questions a run receives*, and
only that.

---

## 1. Why selection is not part of the bank

The concerns this architecture keeps apart:

| Concern | Question |
|---|---|
| **Question Bank** | What valid questions exist? |
| **Selector** | Which of them should *this run* receive? |
| **Entitlement** | Who may access them? |
| **Persistence** | What has this learner already seen? |
| **Scoring** | How is performance evaluated? |
| **Assessment** | How does Assessment behave? |

The selector lives in `packages/nexus-core/src/training-engine/question-selection.ts`,
**not** in `question-bank/`. The bank is a reusable content source; selection is
Training's runtime policy. Putting the selector inside the bank would make the
content model responsible for one consumer's rules, and a future Learning
Assessment — which will want different ones — would inherit Training's by
default.

`question-selection.boundary.test.ts` enforces the separation by scanning the
source: the selector may import only from `question-bank/`, may name no
subscription tier, may not re-derive eligibility, and may hold no module-level
mutable state. The boundary is checked, not trusted — the same approach
`liveFeedbackBoundary.invariant.test.ts` takes on the Assessment side.

## 2. The contract

```ts
selectTrainingQuestions(repository, request?, random?): TrainingSelectionResult
createTrainingQuestionSelector(repository, random?): TrainingQuestionSelector
```

**Request** — only constraints that are justified today:

```ts
{
  count?: number;                            // default 10
  difficultyLevels?: QuestionDifficultyLevel[];
  domains?: string[];
  skillAreas?: string[];
  excludeQuestionIds?: string[];
}
```

There is no subscription field, no learner id, no history field and no scoring
field. Adding one would move a product decision into this module.

**Result** — three outcomes, explicit:

```ts
| { status: "success"; questions: TrainingQuestion[] }
| { status: "insufficient-eligible-content"; requested: number; available: number }
| { status: "invalid-request"; errors: string[] }
```

An invalid request is reported before the pool is consulted: the caller's bug is
the actionable one.

## 3. The 10-question run

`DEFAULT_TRAINING_RUN_SIZE` is 10.

- Returns **exactly** the requested count, never more.
- **Never repeats a question** to fill a run. Seven eligible questions against a
  request for ten is `insufficient-eligible-content` with `requested: 10,
  available: 7` — a short run a learner can see is honest; a padded one is not.
- **Never silently widens a filter.** Six level-2 questions against a request for
  ten level-2 questions is insufficiency, not four level-5 questions quietly
  mixed in. A learner told they practised level 2 must have practised level 2.

## 4. Eligibility

The pool is `repository.getProductionEligible()` — the bank's own gate, which
already requires content status, review outcome *and* a recorded human
verification to agree. The selector does **not** re-derive eligibility; there is
one definition of "may a learner see this" and it lives with the content.

Consequence worth stating plainly: **a bank of candidates is an empty pool.**
Pilot Batch 001, with all 12 items `CANDIDATE`, yields
`insufficient-eligible-content` with `available: 0`. That is tested.

## 5. Determinism

Randomness is injected, never reached for:

```ts
type RandomSource = () => number;          // [0, 1)
createSeededRandom(seed: number): RandomSource
```

Same request + same pool + same source ⇒ **same run, every time**. Different
seeds may produce different valid runs. `Math.random` is the default only when
no source is supplied.

This exists so "why did the learner get these ten?" is answerable. A selector
sprinkled with ambient `Math.random()` cannot be reproduced, and therefore
cannot be debugged or fairly reviewed. `createSeededRandom` is mulberry32 —
deterministic and well-distributed, **not** cryptographic; nothing
security-related should use it.

```text
selection request
      ↓  validate (invalid-request)
eligible pool  ← getProductionEligible() + filters
      ↓  too small? (insufficient-eligible-content)
deterministic shuffle  ← injected RandomSource
      ↓
greedy diversity pass
      ↓
exactly N questions
```

## 6. Diversity — a preference, not a constraint

A greedy pass picks, at each step, the remaining question that would least
concentrate the run, with ties broken by the deterministic shuffle. Weights:

| Field | Weight | Why |
|---|---|---|
| `variantGroup` | 8 | the field exists to mark near-identical questions |
| `learningObjective` | 4 | two questions teaching one point is redundant |
| `skillArea` | 2 | |
| `questionType` | 1 | |
| `domain` | 1 | a shared domain is barely a problem |

Undefined metadata contributes nothing — questions with no variant group are not
treated as all belonging to one.

**Diversity never fails a run and never overrides a filter.** A uniform pool of
ten still yields ten. Making `variantGroup` a *hard* constraint would convert a
content-shape problem into a learner-visible insufficiency error, and where that
line belongs is a product question — deliberately not settled here.

## 7. It changes nothing

The selector is read-only. It returns the bank's own frozen records; it does not
modify questions, source metadata, rationale, review status or production
eligibility, and it holds no state between calls. `excludeQuestionIds` is a
list the *caller* supplies — the selector neither produces nor stores it, and
takes no position on where a seen-item history should live.

## 8. Explicitly not decided here

- **Entitlement** — no tier mapping. `difficultyLevel` is content metadata.
- **Seen-item persistence** — depends on D10; `excludeQuestionIds` is a seam,
  not an answer.
- **Scoring, competency, recommendations** — untouched.
- **Adaptive difficulty** — not implemented.
- **Whether a hard `variantGroup` constraint should cause insufficiency.**
- **Assessment selection** — Assessment defines its own runtime behaviour; see
  the readiness section in `TRAINING_QUESTION_BANK.md`.
