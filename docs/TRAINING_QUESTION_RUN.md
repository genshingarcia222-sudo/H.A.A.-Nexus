# The Training question run — answer, submit, see why

**Status:** implemented and verified — 89 run/UI tests green within a 778/778
repository suite, typecheck, build and preflight clean, and verified in a real
browser through a complete ten-question run, its completion boundary and a
restart.

**What it is not:** it scores nothing, stores nothing and remembers nothing. No
number, no percentage, no pass/fail, no mastery, no history, no tier. It is the
interaction layer between a selected run and the learner.

---

## 1. Where the rules live

```
Question Bank   what valid questions exist
Selector        which of them this run receives
Run             what the learner may do next        <- this document
Entitlement     who may access it                   (not consulted)
Persistence     what has been seen                  (nothing is stored)
Scoring         how performance is evaluated        (nothing is graded)
```

The run state machine is `packages/nexus-core/src/training-engine/question-run.ts`
— pure, framework-free, and the single owner of every rule about what may happen
next. `apps/desktop/src/training/QuestionRun.tsx` renders it and decides nothing:
every transition goes through `selectChoice`, `submitAnswer` or
`advanceToNextQuestion`.

That split is the point. A rule enforced in a component is reachable only by
rendering, and tends to be enforced twice — slightly differently — the moment a
second surface appears.

## 2. State is derived, not accumulated

There is no `isSubmitted` flag beside an `isCorrect` flag beside a
`showRationale` flag. Independent booleans can express "submitted but still
editable" or "correct and incorrect at once", and eventually do.

Instead there is one `submission`, absent or complete:

```ts
interface TrainingRunState {
  questions: readonly TrainingQuestion[];
  index: number;
  selectedChoiceId: string | null;
  submission: TrainingAnswerSubmission | null;   // { selectedChoiceId, correctChoiceId, isCorrect }
}
```

`isSubmitted`, `isCorrect` and the reveal all read from it, so they cannot
disagree. The correct answer shown to the learner is the same value the grade
was computed from.

```
ready ──select──> selected ──submit──> submitted (correct | incorrect)
  ^                                            │
  └──────────────── advance ───────────────────┘
```

## 3. Refusals, not exceptions

Every transition returns either `{ status: "ok", state }` or
`{ status: "rejected", reason, state }` — and the rejected state is the
**unchanged** one. A refused click therefore cannot leave the run
half-transitioned. Reasons: `no-selection`, `already-submitted`,
`unknown-choice`, `malformed-question`, `not-submitted`, `run-complete`.

## 4. Correctness is canonical identity

Grading resolves through `correctChoiceId` — never position, display order or
answer text. Reordering choices for display cannot change which answer is right,
and two choices with identical text are still distinguishable. This is the
failure the legacy `correctOptionIndex` shape invites, and it is structurally
impossible here.

`evaluateAnswer` returns `null` — refusing to grade — when the submitted id is
not one of the question's choices, or when the question's own `correctChoiceId`
resolves to nothing. **An ungradable answer is never treated as correct.** The
schema already prevents the second case; the runtime checks anyway, because data
can reach a runtime boundary from outside a validator.

## 5. Feedback

After submission, for both outcomes: the learner's choice is marked, the
**canonical correct choice is revealed**, the rationale is shown, and per-choice
explanations appear where the content has them.

**Never colour alone.** Each choice carries a text marker ("Correct answer",
"Your answer — incorrect"), an `aria-label` containing it, a `data-state`
attribute and a `✓`/`✗` glyph, in addition to border and fill. The correct
answer is identifiable with no colour perception at all.

**Rationale is never fabricated.** It is required by the bank schema, so a valid
question always has one and no "unavailable" state is reachable. Nothing is
generated when content is thin — if a question could not explain itself it would
not validate. Per-choice explanations are supplemental: their absence changes
neither evaluation, feedback nor the reveal.

## 6. Locking

Locking is a **state rule**, not a `disabled` attribute. Choices are disabled in
the DOM *and* `selectChoice` refuses once `submission` exists, so a keyboard
activation, an assistive-technology click or a synthetic event cannot change a
submitted answer. Verified in the browser by dispatching `keydown` and a bare
`MouseEvent` at a locked choice.

**Submit is never replaced by Next in the same position.** React reuses the DOM
node when one button swaps for another in the same slot, so the second half of a
double-click would land on Next and advance the run — skipping the feedback the
learner just earned. Submit stays put and goes inert; Next appears beside it.
This was found by a test and fixed in the component, not worked around in the
test.

A second submit is refused rather than re-evaluated, so a burst of clicks
produces exactly one transition and one feedback block.

## 6a. The run as a lifecycle

A run is **created once, walked through, finished, and restarted only on
purpose.**

**Exactly ten, or an explicit shortfall.** With ten or more eligible questions
the run holds exactly ten distinct ones. With nine, the selector returns
`insufficient-eligible-content { requested: 10, available: 9 }` — there is no
short run, no padding, no widened filter and no candidate content pulled in to
make up the number.

**The selector runs once per run, never per question.** Measured with a counting
repository: one `getProductionEligible()` call at creation, and **zero more**
across ten answers and nine advances. The sequence is chosen once and is stable
from the first question to the last. A new run costs exactly one further call.

**Submission is not progression.** Submitting never advances; the feedback and
the revealed answer stay until the learner presses Next. One accepted advance
per Next — four rapid activations move the run forward exactly one question,
because only the first finds a submission to advance past.

**Question ten is terminal.** Advancing past it completes the run:
`answeredCount` reports ten of ten, there is no eleventh question, the index
does not wrap to zero, and `selectChoice`, `submitAnswer` and
`advanceToNextQuestion` all refuse with `run-complete` and the state object
unchanged. Completion performs **no selection** — the run does not restart
itself, and the call count proves it.

**A new run inherits nothing.** Restarting resets to question one with no
selection, no submission, no correctness, no rationale, no per-choice
explanation, no lock and no completion state, and re-invokes the selector so the
sequence is genuinely new.

**No learner history is created.** Across three consecutive full runs the bank
still reports twelve questions and twelve production-eligible. Nothing is marked
seen, used or spent; question records stay frozen and unmodified. Where a
seen-item history should live remains undecided, and `excludeQuestionIds` stays
a caller-supplied seam rather than a store.

`answeredCount(state)` counts **progress through the run, not performance**.
Nothing here knows how many answers were right.

### A development-only wrinkle worth knowing

`main.tsx` wraps the app in `<React.StrictMode>`, which deliberately
double-invokes `useState` initialisers in development. `QuestionRun` creates its
run in such an initialiser, so **in the dev browser the selector runs twice at
mount** and an injected `RandomSource` is advanced twice.

This is development-only and is not a correctness defect: the rendered run is
still exactly ten valid, eligible, distinct questions, stable thereafter, and
the invariant that matters — *the selector is not re-invoked per question* —
holds. Determinism is a property of `selectTrainingQuestions` given a source and
is tested there; reproducing a run requires a **fresh** seeded source. Recorded
so a doubled dev-mode call is not later mistaken for a lifecycle bug.

## 7. Progression resets everything

`advanceToNextQuestion` builds the next state from the questions and the new
index alone — selection and submission are *replaced with their initial values*,
never carried. Nothing from the previous question can survive: no selection, no
correctness, no rationale, no per-choice explanation, no lock.

Tested per transition and across a full ten-question run, including that a
choice id belonging to the previous question is rejected as `unknown-choice` on
the next.

## 8. Content safety at the runtime boundary

Questions arrive only through `selectTrainingQuestions`, whose pool is
`getProductionEligible()`. The component re-derives no eligibility, no
difficulty filter and no diversity rule.

When the run cannot be filled, the surface says so — the requested and available
counts — and renders no question. **Nothing is fabricated, no filter is widened,
no difficulty is lowered and no candidate content is pulled in to make up the
number.** Today that is the ordinary state of the real bank: it is empty,
because no authored question has passed human source verification, and Pilot
Batch 001 remains candidate-only.

## 9. The development preview fixture

The preview run uses `apps/desktop/src/preview/previewQuestionBank.ts`:
twelve **synthetic, non-medical** questions *about the Nexus Training runtime
itself*. They cannot be mistaken for clinical guidance, and they cannot leak
into the content archive — they live in `src/preview/`, not under `content/`, so
no loader, content-QA suite or preflight scan discovers them; every one carries
the `SYNTHETIC-DEV-FIXTURE` flag; the `source` cites that file rather than an
authority; and `humanVerifiedBy` says plainly that no person verified it.

They do go through the real validator and the real eligibility gate, because a
preview that bypasses the production path proves nothing.

Real medical content authoring belongs to the Nexus content archive under its
authoritative-source rules and reaches the bank through human verification —
never through a fixture.

## 10. Explicitly not decided or implemented here

Scoring · pass/fail · mastery · competency · recommendations · adaptive
difficulty · entitlement · seen-item or cross-session persistence · replay
policy · Assessment.

**Assessment is untouched and remains scenario-based**: its input is a
`scenarioId`/`scenarioVersion` and a documentation draft, and it has no question
model. A future question-based Learning Assessment would bring its own selection
and assessment rules, and the **shared-versus-reserved question pool question
remains a blocked product decision**.
