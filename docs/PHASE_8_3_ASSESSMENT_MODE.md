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
| **Live-feedback boundary enforced as state** (see §4) | `mayRevealPerformance` / `assertMayRevealPerformance` in `nexus-core`; `sessionStore.ts`; `SubmissionSummary.tsx` | `621855e` |
| **Boundary enforced structurally**: one guarded selector plus a source-scanning invariant, so no future surface can reveal performance by forgetting the rule | `selectRevealableResult` / `useRevealableResult` in `sessionStore.ts`; `liveFeedbackBoundary.invariant.test.ts` | Phase 8.3 hardening (see CHANGELOG) |

**Not implemented:** no learner can start an Assessment. There is no entry point and no entitlement capability, because the tier is undecided (D1).

## 3. Product decision log

Every Phase 8.3 decision is classified against the evidence hierarchy. A decision is **AUTHORIZED** only when a direct instruction or a current product specification explicitly establishes it. Current behaviour, tests, tier names and "obvious" defaults are not authorization.

### D1 — Which subscription tier includes Assessment? — **BLOCKED**

*Re-audited 2026-09-18: unchanged. The Business Model Spec Section 4 tier table names Assessment in no row; the entitlement rules establish only that it must be gated by an explicit capability. "Exam-Ready Pro" is a product name, not a statement of entitlement.*

- **Evidence examined:** Business Model Spec §4 tier table (Assessment appears in no row); §4 entitlement rules ("Assessment … should be gated by explicit entitlement capabilities"); §9 monetization roadmap ("Add Assessment mode" — timing only); §12 launch gate; Architecture Package §24/§25; `capability-matrix.ts`.
- **Why insufficient:** the specification establishes *that* Assessment is gated, not *which* tier. The tier name "Exam-Ready Pro" suggests an exam feature but is not a statement of entitlement. Adding a capability with any per-tier values — including `false` everywhere — would encode feature availability.
- **Blocked work:** the Assessment entitlement capability and its matrix values; a learner entry point in the scenario library; mode-level enforcement in `sessionStore.start`.
- **Decision required:** which tier(s) include Assessment.

### D2 — What is prohibited live feedback during Assessment? — **PRINCIPLE AUTHORIZED**

- **Evidence:** Business Model Spec §10.2; the session owner's boundary (§1 above).
- **Implemented:** see §4. Enforcement is limited to information that actually signals ongoing performance. No broader restriction was invented.

### D3 — What does an Assessment learner see after submitting? — **NOT AUTHORIZED**

- **Evidence examined:** Business Model Spec §5 and §10.2 (both about *live* feedback); Architecture Package §34 (mode-agnostic acceptance criteria).
- **Why insufficient:** post-submission results are not live feedback, and no source defines Assessment results policy (score, breakdown, WHAT/WHY/HOW feedback, recommendations, retry).
- **Current state:** the existing mode-agnostic summary is unchanged. It is unreachable for Assessment until D1 is decided.
- **Decision required:** what an Assessment learner sees after submitting.

### D4 — Is Assessment closed-book? — **NOT AUTHORIZED**

- **Evidence examined:** no source mentions Knowledge Base or Training access during Assessment.
- **Why insufficient:** reference material does not signal the correctness of ongoing performance, so it falls outside the authorized D2 boundary. Restricting navigation would be a new learner-facing rule.
- **Decision required:** whether Assessment is open-book or closed-book.

### D5 — Do Assessment results count in analytics and competency? — **NOT AUTHORIZED**

- **Evidence examined:** Architecture Package §14/§18 (mode-agnostic); Business Model Spec §4 (competency and analytics tiering only).
- **Why insufficient:** merging or separating exam results changes what learners are shown about their competency.
- **Current state:** analytics and competency remain mode-agnostic, unchanged.
- **Decision required:** whether Assessment results are counted with, separately from, or instead of practice results.

### D6 — After an interrupted Assessment, may the learner start again or resume? — **NOT AUTHORIZED**

- **Evidence examined:** the Dashboard's interrupted-session flow (implementation only).
- **Why insufficient:** retake and resume rules are exam-integrity policy, a learner-facing restriction.
- **Current state:** the generic "Start a new attempt" flow is unchanged.
- **Decision required:** the retake/resume policy for interrupted Assessments.

### Related open decision outside Assessment

#### D7 — How is contradictory learner documentation graded? — **NOT AUTHORIZED**

- **Evidence examined:** Architecture Package §28 lists "contradictory learner input" as a required edge-case fixture but states no expected outcome; §11–§13 (evaluation, scoring, error classification) do not address documentation that asserts both a fact and its negation (for example, "No fever. Fever present."); Business Model Spec §6 (deterministic scoring) is silent.
- **Why insufficient:** a fixture needs an expected result, and that result is scoring policy — which error type, what severity, what score effect. Pinning the evaluator's current behaviour as "expected" would silently convert implementation behaviour into a grading rule.
- **Current state:** the evaluator's existing behaviour is unchanged and untested for this case.
- **Decision required:** how contradictory documentation should be classified and scored.

#### D8 — May an interrupted practice or simulation attempt be resumed? — **NOT AUTHORIZED**

- **Evidence examined:** Architecture Package §20 ("on app launch, any session with `status = in_progress` and no `completed_at` is surfaced as *Resume interrupted session?*"), §10 (autosave so "interrupted sessions must not lose work"), §30 acceptance ("recovery from a forced interruption"). The Dashboard already surfaces interrupted sessions and offers a fresh attempt; the draft is already persisted, so no work is lost on disk.
- **Why insufficient:** the architecture states that interrupted sessions are *surfaced* and that drafts are *saved*, but not what resuming does to the attempt itself. Restoring a draft into a running attempt would carry prior work into a newly timed session, and elapsed time feeds `timeEfficiencyRatio`, which feeds the score. Whether a resumed attempt is the same attempt, and how its time is accounted, is scoring policy.
- **Current state:** unchanged — interrupted sessions are surfaced, the draft remains persisted and recoverable from the database, and the learner is offered a new attempt.
- **Decision required:** whether an interrupted practice/simulation attempt may be resumed, and if so how its elapsed time and attempt identity are treated. Assessment is explicitly excluded here; that is D6.

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
| Assessment entitlement capability + matrix values | **BLOCKED** — D1 |
| Learner entry point and mode-level start enforcement | **BLOCKED** — D1 |
| Assessment-specific results presentation | **BLOCKED** — D3 |
| Closed-book navigation restriction | **BLOCKED** — D4 (may not be required) |
| Analytics/competency separation | **BLOCKED** — D5 (may not be required) |
| Interrupted-Assessment policy | **BLOCKED** — D6 |

Phase 8.3 cannot close until D1 is decided and the entry point exists.
