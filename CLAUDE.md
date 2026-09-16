# H.A.A. Nexus — Claude Code Project Instructions

## Source of truth

The GitHub repository is the canonical source of truth for implementation state.
Do not assume the previous Claude Project conversation is available. Read the repository documents before making architectural changes.

## Required context files

Read these before major implementation work:

1. `README.md`
2. `docs/HAA_Nexus_Architecture_Package.md`
3. `docs/BUSINESS_MODEL_PRODUCT_SPEC.md`
4. `CHANGELOG.md`

When implementing a specific phase, read its related tests and source modules before editing them.

## Phase roadmap — mandatory interpretation

- **Phase 7 is the Pre-Commercialization Audit & Stabilization Gate.** It is an audit/verification phase, not an Analytics implementation phase.
- The repository contains an Analytics route placeholder; do not assume production analytics is implemented. Analytics readiness and data requirements are audited during Phase 7. Do not redefine Phase 7 as Analytics.
- **Phase 8 begins commercialization implementation** only after Phase 7 closes.
- Read `docs/PHASE_7_PRE_COMMERCIALIZATION_AUDIT.md` before performing Phase 7 work.

## Current product direction

H.A.A. Nexus is a healthcare training, simulation, assessment, and competency platform. The Live Scribing Simulator is the first module. Commercialization is now a first-class architectural requirement.

The near-term revenue path is:

Web deployment → free funnel → deterministic entitlements → PayMongo subscriptions → paid training capabilities.

Desktop remains the quality-first flagship and later premium upsell.

## Architectural rules

- Preserve the separation between `packages/nexus-core`, UI packages, and platform-specific shells.
- Do not import payment, AI-vendor, or TTS SDKs into clinical-training engines.
- Keep external vendors behind replaceable adapter interfaces.
- Keep deterministic evaluation independent from AI availability.
- Never rely on frontend-only checks for protected commercial capabilities.
- Do not place secrets in source control, browser code, or desktop bundles.
- Prefer additive, testable changes over broad rewrites.
- Do not silently remove or weaken existing tests.
- Do not claim a capability is implemented merely because an interface/stub exists.
- Update documentation and changelog entries when architectural behavior changes.

## Commercialization implementation order — Phase 8 onward

1. Entitlement-engine wiring and capability matrix.
2. Assessment (no-pause) mode.
3. Web deployment + lightweight cloud persistence.
4. PayMongo billing/subscription state integration.
5. Automated free-to-paid conversion UI states.
6. Offline/batch scenario generation pipeline.
7. Cached TTS/voice pipeline.
8. Future metered AI deep-review capability.

## Before coding

For non-trivial changes:

- inspect the existing module boundaries;
- identify which phase owns the relevant behavior;
- identify the existing test coverage;
- state the smallest compatible architectural change;
- do not rewrite unrelated modules merely because a new model has a different preferred structure.

## Before declaring completion

Run the most relevant tests/typechecks/builds available in the environment.
Separate verified behavior from unverified external integrations such as current Rust toolchains, payment-provider sandbox behavior, cloud services, and vendor APIs.

## Git discipline

Prefer small, reviewable commits.
Use descriptive commit messages.
Never commit secrets, provider credentials, generated dependency directories, local databases, or build artifacts.
