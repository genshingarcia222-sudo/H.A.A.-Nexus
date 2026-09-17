# H.A.A. Nexus — Business Model & Product Specification

**Document status:** Strategic product/commercialization specification
**Implementation status:** Planning baseline; individual integrations remain unimplemented until their designated phases.
**Purpose:** Make subscription, entitlement, payment, AI-cost, conversion, and revenue architecture first-class project requirements rather than an afterthought.

---

## 1. Business Summary

- **Product:** H.A.A. Nexus — a live clinical-scribing training simulator that helps aspiring Healthcare Virtual Assistants (HVAs) build competency and reduce performance anxiety under real-world audio/time pressure.
- **Operator:** Solo founder, registered midwife with community-health experience, PH EMR/EHR exposure, and patient-data privacy/QC experience; transitioning into HVA work while building the product with AI-assisted development.
- **Core insight:** The target learner's failure mode is not necessarily lack of medical knowledge; it is often performance degradation under live audio/time pressure. Product design should optimize for repeated exposure, repetition, and desensitization rather than content coverage alone.
- **Primary ICP (beachhead):** Filipino allied-health professionals (nurses, midwives, licensed clinicians) transitioning into, onboarding for, or deciding on HVA work.
- **Expansion ICP:** English-speaking aspiring medical scribes globally once the core product is validated. The underlying skill — accurate clinical documentation under pressure — is not PH-specific.
- **Competitive position:** The product targets the pre-hire gap between self-study and employer-provided training, with emphasis on repeated practice and exam-style pressure rather than a long-form credential course.

---

## 2. Current Product State

The repository is a pnpm/TypeScript monorepo with a React frontend and Tauri desktop shell. The product is proprietary/unlicensed.

### Completed baseline

| Phase | Capability | Status |
|---|---|---|
| 1 | Application shell, entitlement-engine stub, AI abstraction (`NullAIProvider`) | Complete |
| 2 | Scenario schema validation, content hashing/versioning, repository | Complete |
| 3 | Live scribing simulation, session state machine, text transcript reveal, documentation form | Complete |
| 4 | Deterministic evaluation/scoring, fabrication and dangerous-reversal detection, WHAT/WHY/HOW feedback | Complete |
| 5 | SQLite schema, persistence layer, competency engine, autosave | Complete |
| 6 | Terminology, lessons, deterministic recommendations | Complete |
| 6 | Analytics engine (performance, trend, weak/strong areas, error trends, scenario progress) | Complete — audited and confirmed in Phase 7 |
| 7 | Pre-Commercialization Audit & Stabilization Gate; analytics requirements/readiness are audited as part of the gate | **Closed — PASS WITH CONDITIONS** (see `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`) |
| 8 | Commercialization Foundation | **In progress** — 8.1 entitlement domain model, 8.2 scenario entitlement gating, and 8.2.1 migration infrastructure complete; 8.3 Assessment mode in progress (no-pause rule, migration, workspace support and live-feedback boundary implemented; not yet learner-reachable, blocked on product decisions); subscription persistence and payments not started |

### Material gaps before commercial launch

- Tauri/Rust **compilation is verified** (rustc 1.98.1, `cargo check` clean, 43 Rust tests green). **Packaging/installer bundling is still unverified** — Phase 9.
- A versioned migration runner now exists (Phase 8.2.1), so new tables and constraint changes can ship safely; the schema is at version 2 after the Phase 8.3 Assessment-mode migration.
- Content library is only 2 scenarios (difficulty 1 and 3) — not enough to populate a Free tier, let alone justify paid access.
- No-pause **Assessment mode** is only partly implemented: the no-pause rule, database support, workspace support and live-feedback boundary exist, but it has no UI entry point. **Open decisions** (see `docs/PHASE_8_3_ASSESSMENT_MODE.md`): which tier includes Assessment (Section 4 does not say), post-submission results, closed-book access, analytics treatment, and interrupted-Assessment policy.
- Web deployment and lightweight cloud persistence are not yet implemented.
- Entitlement engine is not yet wired to a real payment processor.
- Cloud sync / multi-device / multi-user infrastructure is not yet implemented.
- Real AI integration is not yet implemented.
- Instructor/organization tooling is future work.
- Audio/voice simulation is future work; current simulation is text-transcript based.

---

## 3. Build Priority and Revenue Strategy

The commercialization path is deliberately brought forward so the project can validate demand and revenue before waiting for every premium capability to be finished.

1. **Phase 7 gate:** complete the Pre-Commercialization Audit & Stabilization Gate defined in `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md`.
2. Verify/fix the Tauri + Rust build on a real machine.
3. Build **Assessment (no-pause)** mode.
4. Stand up a **web-deployed build in parallel**, using the existing browser-capable React frontend and a lightweight cloud persistence layer so refreshes do not lose progress.
5. Wire the existing **entitlement engine to PayMongo** and implement paid subscription flows.
6. Build an **LLM-assisted scenario/patient-variant authoring pipeline** as an offline/batch process validated against the existing Zod schema.
7. Add **voice/TTS generation**, rendered and cached once per scenario variant rather than generated per play.

### Strategic rationale

- Desktop remains the quality-first flagship.
- Web becomes the near-term revenue vehicle rather than waiting for full desktop packaging.
- Deterministic evaluation remains the core auditable value layer.
- Live AI calls are kept out of the normal learner-session path wherever possible to control marginal cost.

---

## 4. Subscription & Entitlement Model

| Tier | Price | Difficulty / complexity | Voice | Included value |
|---|---:|---|---|---|
| **Free · Foundations** | $0, permanent | Beginner only; 2–3 fixed scenarios | Budget | Conversion funnel; basic pass/fail; full scoring detail, competency tracking and analytics remain locked |
| **Practice Access** | $15/month | Beginner–Intermediate | Budget | Full deterministic scoring breakdown; unlimited attempts within unlocked band |
| **Exam-Ready Pro** | $20/month | Adds Advanced | Mid-tier | Competency tracking to Mastered; recommendation engine; monthly scenario drops |
| **Agency Fast-Track** | +$39 one-time, requires active Pro | Adds Expert/Mastery | Premium | Tier-exclusive content; personal 1:1 transcript review; completion certificate |

### Tier capability clarifications (recorded during Phase 8.1)

The table above does not state whether **Practice Access** includes competency
tracking or analytics — it names neither. Competency and analytics appear in
only two rows: Free ("competency tracking and analytics remain locked") and
Pro ("Competency tracking to Mastered").

Phase 8.1 had to resolve this to encode the capability matrix, and recorded the
**least-assumptive** reading rather than inventing a rule:

| Question | Recorded default | Basis |
|---|---|---|
| Does Practice include competency tracking? | **No** | The spec names competency tracking as a Pro unlock and omits it from the Practice row |
| Does Practice include analytics? | **No** | Analytics is named only as locked on Free, paired with competency; it unlocks where its pair unlocks |
| Is there a competency *ceiling* per tier? | **No** | "Competency tracking to Mastered" describes Pro's whole feature. No ceiling concept exists anywhere in this document, and capping a *displayed* competency level below a learner's real record would show a figure contradicting stored data, which the no-fabricated-results rule forbids |

This keeps the deliberately small $15 → $20 step carrying visible value, as this
document asks, without throttling ordinary practice: Practice retains unlimited
attempts and the full deterministic score breakdown.

**This is a default, not a decision on record.** If Practice is intended to
include competency or analytics, the single place to change it is
`packages/nexus-core/src/entitlement-engine/capability-matrix.ts`; the tests
pin the current reading and will fail loudly if the matrix drifts.

### Entitlement rules

- Entitlements are determined from the subscription tier and the scenario's existing difficulty metadata.
- Do not create a parallel difficulty-gating system if the existing metadata can serve as the canonical source.
- Preserve unlimited attempts within the learner's unlocked band. Repetition is core product value.
- Assessment, analytics, competency, voice quality, content drops, and review/certificate features should be gated by explicit entitlement capabilities, not scattered UI conditionals.
- The entitlement model must be testable without a live payment provider by using deterministic subscription/entitlement fixtures.

### Pricing architecture principle

The $15 → $20 monthly gap is intentionally small. The product should make the incremental value of Pro visible without artificially throttling ordinary practice.

---

## 5. Free-to-Paid Conversion Mechanics

Conversion must be automated in-app and triggered by genuine product events.

1. **Completion trigger:** prompt upgrade when the learner completes all free scenarios.
2. **Locked-detail trigger:** show pass/fail immediately but lock the detailed deterministic score breakdown and explanatory feedback behind paid entitlement.
3. **Analytics teaser:** show a clearly labeled locked/preview weak-area visualization.
4. **Repetition plateau:** keep the free scenario set intentionally small enough to demonstrate value while naturally exposing the benefit of additional scenarios.

### UX requirement

Paywall states must explain **what becomes available** without fabricating scarcity, deceptive countdowns, or misleading clinical-performance claims.

---

## 6. AI / LLM Cost Architecture

### Deterministic first

The existing deterministic evaluation engine remains the default scorer for every tier, including Free. This provides:

- zero marginal API cost per ordinary attempt;
- reproducible scoring;
- auditable error classification;
- a stable basis for learner feedback and dispute review.

### Scenario/patient-variant generation

Generate variants **offline/batch**, not live on every learner session. The existing content pipeline and Zod validation remain the acceptance boundary.

Preferred economic pattern:

- shared prompt/template context can use prompt caching where supported;
- batch processing should be preferred over live generation;
- generated output must pass schema validation and content QA before publication.

The working planning assumption is approximately **$0.02–$0.05 per generated variant**, subject to current vendor pricing and actual prompt/output size at implementation time.

### Voice/TTS generation

Render voice output once per scenario variant and cache the audio asset. Do not regenerate the same variant on every learner attempt.

Planning assumptions range from approximately **$0.02 per budget voice asset** to approximately **$0.20 for premium voice assets**, depending on the chosen vendor and actual rendered length. Verify vendor pricing before production billing is implemented.

### Future interpretive assessment

A future semantic/interpretive assessment layer may introduce genuine per-submission runtime cost. Treat this as a **metered feature**, not unlimited live AI usage.

Example commercial rule:

- Pro+ receives a limited number of AI deep reviews per month.
- Additional AI reviews, if offered, consume a clearly disclosed quota or paid add-on.
- Do not expose an unlimited live-LLM path in the default learner workflow until unit economics are demonstrated.

### Core economic principle

Marginal cost of replaying existing deterministic content should approach **$0**. Variable cost should scale primarily with content creation and explicitly metered AI features, not with every basic attempt.

---

## 7. Billing & Payment Architecture

### Customer billing

Use **PayMongo** as the planned payment processor. Subscription checkout should default to supported recurring card/Maya rails. GCash recurring behavior should be treated as a provider capability to verify during implementation rather than assumed to be universally self-serve.

### AI vendor billing

Maintain separate vendor billing relationships for:

- Anthropic Console / Claude API for offline authoring workloads.
- TTS provider (ElevenLabs or AWS/Google depending on tested economics and capabilities).

### Founder funding

Current planning preference is a prepaid/debit funding method such as GoTyme, with Maya as fallback. Maintain conservative spending limits and monitor balances proactively.

### Security requirement

Never store raw payment credentials in H.A.A. Nexus. Payment details remain with the processor. The application stores only the minimum identifiers and entitlement/subscription state required to function.

---

## 8. Revenue / Lead Generation Plan

### Acquisition sequence

1. Existing teaching network: former/graduated students only, through personal channels and outside class time; never use grading authority or currently enrolled students as a captive sales audience. Confirm the relevant center's current policy before any commercial activity.
2. TikTok/Reels: faceless first, using screen recordings and voiceover; face-forward content can be introduced later after real product traction.
3. Facebook: relevant Filipino healthcare VA and training communities plus personal profile.

### Content pillars

- Build-in-public development.
- Bite-sized documentation/scribing instruction.
- Personal transition story: community-health midwife → HVA job search → building a training product.

### Baseline cadence

3 posts/week is the working baseline.

### Primary CTA

The public-facing CTA should generally point to the **Free tier**, with paid conversion occurring inside the product through demonstrated value rather than manual sales pressure.

---

## 9. Monetization Roadmap

### Months 1–3

- Launch web Free → Practice Access → Pro → Fast-Track structure.
- Automate upgrade nudges.
- Validate whether free users complete scenarios and convert.
- No dependence on ads.

### Months 4–6+

- Ship Desktop Pro as a premium upsell for existing web subscribers.
- Add Assessment mode, richer voice realism, and scalable scenario variants.

### Months 6–12+

- Consider free-tier advertising only after free-tier traffic is large enough for advertising to be meaningful.
- Ads remain secondary monetization, never the primary value proposition.

### Months 7–12+

- Explore B2B / agency licensing.
- Candidate prospect list for investigation includes MedVA, HelloRache, Global Medical Virtual Assistants, Virtual Medical Staffing, VMeDx, and Cool Blue VA.
- Treat every prospect's current training/hiring model and commercial fit as something to verify before outreach.

---

## 10. Commercial Architecture Requirements for Claude Code

When implementing commercialization, Claude Code must follow these rules:

1. **Start with the entitlement-engine wiring.** Reuse the Phase 1 entitlement engine rather than replacing it unless architectural evidence requires change.
2. Build **Assessment mode** next using the existing session state machine; introduce a mode flag that disables Pause/Resume and hides live feedback that would compromise exam simulation.
3. Build the **web revenue path in parallel** before spending excessive time on unverified desktop packaging.
4. Implement conversion triggers as **entitlement-aware UI states**, not an unrelated monetization subsystem.
5. Keep authoring-time AI jobs out of the live session path whenever possible.
6. Keep voice generation asynchronous/batch and cache rendered assets.
7. Treat payment provider callbacks/webhooks as authoritative for subscription-state transitions, while retaining a locally testable entitlement domain model.
8. Never trust frontend-only paywall checks. Protected capabilities must be enforceable at the appropriate application/backend boundary.
9. Avoid placing secrets or provider credentials in the desktop bundle or browser client.
10. Preserve deterministic scoring even when the AI services are unavailable.
11. Add tests for every entitlement boundary, downgrade/expiry state, payment-state transition, and locked/unlocked scenario behavior.
12. Make subscription/provider integrations replaceable behind interfaces so PayMongo is not hard-coupled into Nexus Core's clinical-training logic.

---

## 11. Required Commercial Domain Boundaries

The preferred separation is:

```text
Nexus Core
├── Training / Scenario / Simulation / Evaluation
├── Competency / Recommendation / Analytics
├── Entitlement Domain
│   ├── Tier definition
│   ├── Capability matrix
│   ├── Entitlement resolution
│   └── Subscription-state normalization
└── Provider Adapter Boundary
    ├── Payment Provider (PayMongo)
    ├── AI Provider (Anthropic / future providers)
    └── TTS Provider (ElevenLabs / AWS / Google)
```

The clinical-training engines should not depend directly on PayMongo, Anthropic, ElevenLabs, or any other vendor SDK.

---

## 12. Launch-Gate Requirements

Do not call the product commercially launch-ready merely because a payment button works.

Minimum commercial gate:

- entitlement tests pass;
- Free / Practice / Pro / Fast-Track capability matrix is deterministic;
- subscription activation, renewal, cancellation, expiry, and downgrade states are represented;
- payment-provider failures are handled without corrupting learner data;
- protected features cannot be unlocked through frontend-only manipulation;
- web persistence survives refresh;
- Assessment mode is operational;
- enough validated content exists to justify paid access;
- deterministic evaluation remains available without AI;
- billing and privacy disclosures are present before accepting real payments;
- real payment and webhook behavior is tested in the provider's sandbox/test environment;
- production secrets are outside source control.

---

## 13. Current Decision

**Commercialization is now a first-class product concern.** The entitlement engine already present in Phase 1 is the architectural starting point. The immediate revenue path is **web deployment + deterministic entitlements + PayMongo**, while desktop remains the quality-first flagship and premium upsell.

This document should be treated as a companion to `docs/HAA_Nexus_Architecture_Package.md`, not a replacement for it.
