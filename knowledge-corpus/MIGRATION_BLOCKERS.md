# P9-011 migration blockers — why the 432 records cannot migrate yet

**Generated evidence, not an opinion.** Re-run `npm run kb:migrate` to reproduce
every number here. The engine is `tools/knowledge-corpus/kb-migrate.mjs`, pinned
by 20 tests in `kb-migrate.test.mjs`.

**Status: the contract B extension is DONE; the record transform is BLOCKED on
content that does not exist.** This is not an engineering shortfall and more
engineering will not clear it.

## What is finished

| Piece | State |
|---|---|
| **O5** — optional multi-select in contract B, scored all-or-nothing | **implemented**, 24 tests |
| **O6** — the 17 carried policy and safety fields | **implemented**, 19 tests |
| `accessClasses` drop | **enforced** by `.strict()` and by the transform, with its measured cost reported |
| The field disposition table (all 54 properties) | **implemented**, 19 tests |
| The transform engine | **implemented**, 20 tests, deterministic, isolated, invents nothing |

## Why every one of the 432 is still blocked

The engine carries everything contract A can supply. Five required contract B
fields it cannot, and **a migration may not invent them**: fabricated content in
a clinical training corpus is worse than an unmigrated corpus.

| Required by contract B | Records | Why contract A cannot supply it |
|---|---|---|
| `skillArea` | **432** | Contract A has no skill area. `domain` is already consumed by `domain`, and `moduleIds` are ids |
| `learningObjective` | **432** | Contract A has none. `goldBehavior` describes what a correct *response* does, not what the item *teaches* — treating one as the other is a semantic conversion, not a mapping |
| `questionType` | **432** | Contract A's 27 task types do not map onto contract B's `QUESTION_TYPES` without an authoring judgement per type |
| `source` | **432** | Contract A carries *authoring* provenance, not a source citation. **The declared source archive is absent from the repository (O3)**, so there is no citation to carry |
| `difficultyLevel` | **432** | **Blocked on O4.** Contract A carries a band (`EASY`/`MODERATE`/`HARD`); contract B needs a 1–6 level. The band-to-level mapping is advisory and unaccepted, so applying it would resolve O4 as a side effect |
| `choices` (3–5 required) | **114** | **Structural**, see below |

## The structural blocker — 114 records have no home in contract B

Contract B's ITEM family **extends a multiple-choice question bank**:
`choices` has `.min(2)` and `correctChoiceId` is required. 114 of the 432
records are free-text or structured-output tasks with **zero** choices and an
`expectedOutput` instead — 59 `DOCUMENTATION_TASK`, 24 `QUESTION`, 16
`WORKFLOW`, 15 `SCENARIO`.

They cannot become ITEMs without weakening the question-bank contract, which is
**D11/D12 owner-decided territory** and would remove validation that works.
Giving contract B a family or response format for an open response is a
**content-model decision**, not an implementation detail, and it is not taken
here.

## The decision this needs — proposed as O9

*How does contract B represent a free-text task, and where do `skillArea`,
`learningObjective`, `questionType` and `source` come from for a machine-drafted
corpus whose source archive is missing?*

Four options, with their real costs:

| Option | Cost |
|---|---|
| **Author the missing fields** | 432 × 3 fields of genuine authoring. Needs a human; cannot be generated without fabricating |
| **Make them optional for corpus-origin records** | Weakens D11/D12's contract for every consumer, and `source` exists precisely so a human can check a clinical claim later |
| **Add an open-response family to contract B** | Clears the 114 structurally. Still leaves the four unsourceable fields |
| **Keep the corpus in the authoring layer** and migrate only what a runtime genuinely needs | Smallest change; concedes that 432 authored records are not yet runtime content |

**Nothing here is decided.** O3 (the missing archive) and O4 (the difficulty
mapping) are prerequisites for two of the five, and both are open.

## What has not happened

- **No record was migrated.** `migratable today: 0`.
- **No record moved toward review or production eligibility.** All 432 remain
  `pendingHumanReview`, 0 approved, and a migration is not a reviewer.
- **The canonical corpus was not modified.** The engine writes only to
  `knowledge-corpus/migrated/`, which is generated and git-ignored.
- **No value was invented**, and a test fails if one ever is.
