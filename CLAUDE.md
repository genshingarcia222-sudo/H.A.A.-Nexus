# H.A.A. Nexus — Claude Code Project Instructions

## Source of truth

The GitHub repository is the canonical source of truth for implementation state.
Do not assume the previous Claude Project conversation is available. Read the repository documents before making architectural changes.

## Session start — distributed workstations (mandatory, every session)

Nexus is worked on from two logical workstations, DEVICE-01 and DEVICE-02. Either may be off, and any Claude session may be lost. Persistent project memory lives in `.nexus/`. Protocol: `.nexus/SYNC_PROTOCOL.md`. Recovery: `.nexus/RECOVERY_PROTOCOL.md`.

Authority order: **remote Git (a verified pushed commit) > `.nexus/` on `main` > Git history and files > local uncommitted work > conversational memory.** If memory disagrees with the repository, the repository is right.

Before editing anything:

1. `node tools/nexus-sync/nexus-sync.mjs start`. This fetches, identifies the device, classifies the branch (clean/ahead/behind/diverged), reads `.nexus/CURRENT_STATE.md`, `ACTIVE_TASK.md` and `HANDOFF.md`, and judges task ownership. **Exit code 1 = STOP** until what it names is resolved.
2. If the device is unidentified, ask the user which device this is, then run `init-device DEVICE-0X`. Never guess.
3. Never modify the scope of a task another device owns while it is live. Take over a stale task only with `claim --takeover --reason "..."`.
4. Never discard uncommitted or diverged work (RECOVERY_PROTOCOL Cases F and G). Never reset, clean or force-push.
5. Never treat `ListAgents`, agent reachability or an earlier conversation as project state. An unreachable device or agent does not block work: continue from the last pushed state.
6. Do not share a working tree with another live session. Use a separate worktree or clone per session.

Before calling meaningful work complete: run the relevant checks, update `CHANGELOG.md` and `.nexus/`, commit, then run `nexus-sync release` (or `handoff`) and `nexus-sync finalize`. Report the final commit SHA. Say "synchronized" only when `finalize` printed `REMOTE SYNC VERIFIED`. Otherwise report `LOCAL COMMIT COMPLETE / REMOTE SYNC NOT VERIFIED`.

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
