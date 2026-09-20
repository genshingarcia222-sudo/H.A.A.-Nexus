# Training Question Bank content

Canonical, reusable Training questions live here — one bank file per `.json`,
validated by `validateQuestionBank` in
`packages/nexus-core/src/question-bank/`.

**This directory is empty on purpose.** The schema, validator, loader and
repository exist; no question content has been promoted into the bank. The
checks that guard it (`question-bank/content-qa.e2e.test.ts` and
`loader-node.test.ts`) pass silently while the directory is empty, and start
checking the moment a file arrives.

`loadQuestionBankDirectory()` reads this directory: `.json` files only,
`_`-prefixed files skipped, sorted by name. A file that fails validation fails
the load — every error at once, naming the file — and nothing loads at all
unless everything validates. Loading a question **never** changes its status.

## Why this directory and not another

Three content paths are already scanned by tests or tooling, and a bank file in
any of them is read as something it is not:

| Path | Scanned by | What it expects |
|---|---|---|
| `content/lessons/` | `training-engine/content-qa.e2e.test.ts` | every `.json` is a `TrainingLesson` |
| `content/incoming/` | `scenario-engine/scenario-intake.test.ts` | every `.json` is a draft `Scenario` |
| `content/scenarios/**` | `tools/preflight/preflight.mjs`, scenario content-QA | every `.json` is a released `Scenario` |

`content/question-bank/` is scanned by none of them. It is a sibling under
`content/`, so bank content sits with the rest of the content tree rather than
hiding outside it, but it has its own validator and its own test.

## What may go here

- Bank files that validate against `QuestionBankSchema`.
- Nothing that is not yet cleared for it. A question above `candidate` must
  carry a recorded human verification (`verification.humanVerifiedBy` and
  `humanVerifiedOn`), or it will not validate.

## What may not go here

- **Pilot Batch 001.** Its 12 items are `CANDIDATE` /
  SOURCE-VERIFICATION-PENDING, 0 production-eligible. It is held as a *test
  fixture* at
  `packages/nexus-core/src/question-bank/__fixtures__/nexus-pilot-batch-001.candidates.r2.json`
  to prove the schema can represent it, and it is not content. Moving it here
  would not promote it — promotion is a human gate that stands at 0 of 12 — but
  it would put candidate content in the content tree, which is exactly the
  confusion this directory is arranged to avoid.
- Lesson content. `TrainingLesson.knowledgeChecks[]` is unchanged and still
  lives in `content/lessons/`; see `docs/TRAINING_QUESTION_BANK.md` for how the
  two coexist.

## Not decided here

Entitlement, seen-item persistence, the runtime selector, scoring, competency,
recommendations and Assessment are all out of scope for this directory and for
the schema that validates it. Difficulty is an authoring signal, not a tier.
