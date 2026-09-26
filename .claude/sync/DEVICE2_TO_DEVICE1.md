# Device 2 → Device 1

## LATEST — Knowledge Base integration audit (2026-09-20, at `3f9654c`)

**Status: `INTEGRATION BLOCKED` — two distinct blockers. Nothing was consumed
and no placeholder records were created.**

### Blocker 1 — no content handoff exists

No `DEVICE 1 HANDOFF` SHA has been supplied, and none exists to find: no new
content commit is present on any ref (`git log --all` and `ls-remote` both
checked). `claude/youthful-aryabhata-10eb31` moved to `727abce`, but that is
only "Merge pull request #12 from main" — no content. `ListAgents` reports no
other Claude session running.

Per the waiting boundary, Device 2 consumed nothing: no earlier version, no
local copy, no uncommitted tree, no reconstruction.

### Blocker 2 — there is no canonical Knowledge Base to integrate into

This is the more important finding, and it changes what Device 1 should produce.

**What the repository calls the Knowledge Base is a terminology search screen.**
`KnowledgeBase.tsx` searches `InMemoryTerminologyRepository` over
`TerminologyEntrySchema` = `{ id, layTerm, clinicalTerm, acceptedAlternatives[],
category, context?, explanation, commonMistakes[] }`, backed by four entries in
`content/terminology/terminology.json`.

There is **no article type, no provenance, no jurisdiction, no effective period,
no release/version metadata, no lifecycle, no verification record** and no
supersession rule. Architecture Package §17 confirms this was deliberate:
knowledge articles were folded into `training_lessons.category = 'reference'`
for MVP, to be revisited *"if reference content outgrows the lesson schema"*.
That condition has arrived.

**And `TerminologyEntrySchema` is not `.strict()`** — extra fields are silently
stripped. Sourced records injected there would lose their provenance without an
error. That is precisely the hazard the Question Bank was built to prevent.

Full detail: `docs/KNOWLEDGE_BASE_INTEGRATION_AUDIT.md`.

### What the audit confirmed as already correct

**Assessment access is already handled, and needs no new policy.**
`mayAccessReferenceMaterial` returns false for an assessment that is not
`completed`; `/knowledge-base` and `/training` are both in `REFERENCE_ROUTES`
and `ReferenceGate` blocks direct navigation, not merely the links. So any
future Knowledge Base content is **automatically closed-book during an active
Assessment** and reopens on submission — owner decision D4, already implemented
and tested by `closedBookBoundary.test.tsx`. Knowledge Base content cannot
become an Assessment answer key. **No product policy was invented.**

**Question Bank eligibility is untouched.** `getProductionEligible()` remains
the single gate; Pilot 001 stays candidate-only, 0 production-eligible.

**FY2027 cannot currently be mislabelled as active** — for the strongest
possible reason: `effectiveFrom`/`effectiveTo` exist only on the Question Bank's
optional `codingReference`, and **nothing reads them**. The application has no
"active coding release" concept at all, so it makes no claim to be wrong about.
That is a fact about absence: the moment a surface presents a release as
current, it must compare the real date against the stored effective period.

### What Device 1 should do before generating records

1. **Get an owner decision on the Knowledge Base content model** — a new
   canonical type (as the Question Bank is under D11) or an extension of
   terminology. This is D11-shaped and currently unasked. Device 2 will not
   invent it.
2. Until then, **do not generate records against a shape that has no home**.
   Records shaped for a non-existent schema would either be rejected or, worse,
   silently stripped of their provenance.
3. When generating, carry at minimum: article identity, provenance (authority,
   title, url, locator), jurisdiction, `effectiveFrom`/`effectiveUntil`,
   release/version, lifecycle + review status, human-verification record, and
   any Question Bank relationship.
4. **Preserve FY2027 as `effectiveFrom = 2026-10-01`, `effectiveUntil =
   2027-09-30`.** Do not rewrite it to the generation date.
5. Hand off an exact commit SHA. Device 2 consumes that commit and nothing else.

### Device 2 state

Branch `feat/training-question-bank`, working tree clean, all prior work pushed.
No safety gate was altered; no clinical content was created, promoted or
verified.

---

# Device 2 → Device 1: verified M23 facts

**Communication bus, not a knowledge base.** Device 1 should reconcile these
facts into the canonical archive (`docs/`, `CHANGELOG.md`,
`docs/DECISION_REGISTER.md`) and may then prune this file. Nothing below should
survive only here.

**Checkpoint:** M23 — Training 10-question run lifecycle, completion,
progression, diversity/replay.
**Branch:** `feat/training-question-bank` · **Base:** M22 `604017f`
**Date:** 2026-09-20

---

## 1. Channel used — state this plainly

No live Device 1 session existed. `ListAgents` reported no other Claude session
on this machine, and `.claude/sync/` did not exist. **Device 2 received no
Device 1 knowledge payload**, and did not invent one. It used the canonical
repository archive plus verified code and tests. No undocumented
Claude-to-Claude transport was assumed.

## 2. M22 GitHub synchronisation — already done

`origin/feat/training-question-bank` was already at **`604017f`**, byte-equal to
the M22 local HEAD. The M22 push that was previously reported as
`GITHUB SYNC BLOCKED` **has since landed**. No action was needed; verified by
`git ls-remote`, not assumed.

## 3. Branch integration state — needs a Device 1 / owner decision

- `feat/training-question-bank` is **not merged into `main`**.
- `origin/main` = `865d31e` is an **ancestor** of the feature branch, so
  feature → main is a clean **fast-forward**, no conflicts.
- The branch now carries five checkpoints: Question Bank schema/validator,
  repository + loader, selector, run state machine + UI (M22), and this
  lifecycle work (M23).
- Device 2 did **not** merge to `main`. The repository's established workflow is
  pull requests (#1–#11), and bypassing it for five checkpoints is an owner
  decision, not an engineering one.

## 4. What M23 implemented

Small, because most of the lifecycle was already correct by construction in M22.

| Change | File |
|---|---|
| `answeredCount(state)` — progress through the run, never a score | `training-engine/question-run.ts` |
| Completion reports **"N of N questions answered"** explicitly | `training/QuestionRun.tsx` |
| Inspectable runtime state (`data-run-state`, `data-question-index`, `data-question-id`, `data-answered`, `data-total`) | `training/QuestionRun.tsx` |
| Restart label made explicit ("Start a new run") | `training/QuestionRun.tsx` |
| 23 lifecycle tests | `training-engine/question-run-lifecycle.test.ts` (new) |
| 16 UI lifecycle tests | `training/QuestionRun.test.tsx` (extended) |

No parallel run implementation was created. No selector, diversity or
eligibility logic was added to, or duplicated in, the UI.

## 5. Verified architectural facts

**Exact-ten invariant.** With ≥10 eligible questions the run is exactly 10,
distinct, all `production-eligible`. With 9 eligible the selector returns
`insufficient-eligible-content { requested: 10, available: 9 }` — no short run,
no padding, no widened filter, no candidate content.

**Selector runs once per run.** Measured with a counting repository that tallies
`getProductionEligible()` calls: **1 call at run creation, 0 more across ten
answers and nine advances.** The sequence is decided once and is byte-stable
from first question to last. A new run adds exactly one further call.

**Submission ≠ progression.** Submitting never advances; feedback persists until
Next. Confirmed in the browser: the heading stayed on each question after
submit, for all ten.

**One advance per Next.** Four rapid activations on Question 3 (three clicks
plus a synthetic `MouseEvent`) advanced exactly one question, to Question 4.

**Question 10 is terminal.** Advancing past it completes the run:
`answeredCount = 10`, no eleventh question, `index` does not wrap to 0,
`questions[index]` is undefined, and `selectChoice` / `submitAnswer` /
`advanceToNextQuestion` all return `rejected: "run-complete"` **with the state
object unchanged by identity**.

**No self-restart.** Completion performs no selection. Measured: the
`getProductionEligible()` call count is unchanged at completion.

**Restart inherits nothing.** A new run resets to index 0, `answered = 0`, no
selection, no submission, no feedback, no rationale, no per-choice explanation,
no lock, no completion state — and re-invokes the selector exactly once.
Browser-verified: run 1 began `DEV-RUNTIME-003`, run 2 began `DEV-RUNTIME-004`.

**No learner history.** Across three consecutive full runs the bank still
reports 12 questions and 12 production-eligible. Nothing is marked seen, used or
spent. Question records remain frozen and unmodified.

**Diversity unchanged and not duplicated.** The selector's existing soft
preference (`variantGroup` 8 · `learningObjective` 4 · `skillArea` 2 ·
`questionType` 1 · `domain` 1) is untouched. Weights were not altered. A
uniform pool with one variant group still fills a run of ten rather than
failing — diversity remains a preference, never a hard constraint. The UI
renders the selector's sequence without rebalancing it.

**Determinism.** Same bank + same filters + same count + same **fresh** seeded
source reproduces the sequence exactly; different seeds may differ and are not
required to. Verified in both the domain and the component.

## 6. Edge case worth recording — React StrictMode

`main.tsx` wraps the app in `<React.StrictMode>`, which **deliberately
double-invokes `useState` initialisers in development**. `QuestionRun` creates
its run in such an initialiser, so in the dev browser the selector runs twice at
mount and the injected `RandomSource` is advanced twice.

Assessed and deliberately not "fixed":

- It is **development-only**; production builds invoke once.
- It is **not a correctness defect**: the rendered run is still exactly ten
  valid, eligible, distinct questions, stable thereafter.
- The invariant that matters — *the selector is not re-invoked per question* —
  holds, and is what the tests assert.
- Determinism is a property of `selectTrainingQuestions` given a source, and is
  tested there. Reproducing a run requires a **fresh** seeded source.

Recording it so nobody later mistakes a doubled dev-mode selector call for a bug
in the run lifecycle.

## 7. Verification evidence

| Check | Result |
|---|---|
| M23 domain tests | **23/23** (`question-run-lifecycle.test.ts`) |
| M23 UI tests | **16 new**, file total 39/39 |
| `pnpm -r test` | **778/778** — 511 nexus-core (51 files), 267 desktop (26 files) |
| `pnpm -r typecheck` | clean |
| `pnpm -r build` | clean |
| `pnpm preflight` | exit 0 |
| `pnpm preflight:test` | 17/17 |
| Rust | untouched, not re-run |

Three typecheck errors in the new tests were found and fixed before closing:
`QuestionBankRepository` imported from the wrong module, an implicit `any`
parameter, and a `NodeListOf` iteration needing `Array.from`.

**Browser** (`http://localhost:1420/#/training`, dark theme `#0f1419`): run
starts 1/10 with Submit inert; all ten questions walked, each opening with zero
stale feedback; submission never advanced; rapid ×4 Next advanced exactly one;
completion showed "Run complete — 10 of 10 questions answered" with no choices,
no Submit, no Next, no Question 11 and no wrap to Question 1; post-completion
Enter/Space did nothing; "Start a new run" returned a clean 1/10 with a
different opening question; requesting 20 questions from a 12-question pool
rendered "Not enough production-eligible questions for a run of 20. 12
available." with no question rendered.

## 8. Product boundaries — unchanged

Nothing was implemented or implied for: scoring, percentages, pass/fail,
mastery, competency, recommendations, certification, adaptive difficulty,
entitlement, paid/free behaviour, persistence, learner history, payment or
authentication.

**Assessment untouched.** Still scenario-based (`scenarioId`/`scenarioVersion` +
documentation draft), no question model, no Question Bank consumer.
**PRODUCT DECISION — BLOCKED:** shared vs Assessment-reserved question pool.

## 9. Known limitations

1. `feat/training-question-bank` is still not in `main` (see §3).
2. The run uses the synthetic non-medical preview fixture, because the real bank
   is empty — no authored question has passed human source verification and
   Pilot 001 is candidate-only. Correct behaviour, not a defect.
3. React StrictMode dev-only double selection (see §6).

## 10. Asks for Device 1

- Reconcile §4–§6 into `docs/TRAINING_QUESTION_RUN.md` and the CHANGELOG
  (Device 2 has already written both; confirm they match the archive's voice).
- Decide the `main` integration question in §3.
- The shared-vs-reserved pool decision continues to block question-based
  Assessment authoring.
