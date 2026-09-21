# Current State

The authoritative operational snapshot of H.A.A. Nexus, on `main`. Read it at
the start of every session; update it whenever a meaningful change is
completed (SYNC_PROTOCOL step "UPDATE .nexus STATE").

- `ACTIVE_TASK.md` is the owner of task ownership. The `active_task`,
  `task_owner` and `task_status` fields here mirror it, and `nexus-sync status`
  reports any disagreement.
- The four sync fields (`last_successful_sync`, `last_sync_device`,
  `last_sync_commit`, `sync_status`) are written by `nexus-sync finalize` after it
  has verified the commit on the remote, and `status` re-checks them against
  `origin/main` every time. `last_sync_commit` is the verified work commit. The
  commit that carries the record sits on top of it and touches only `.nexus/`.
- Values that cannot be verified are written `NOT VERIFIED`.

```yaml nexus-state
project: H.A.A. Nexus
repository: https://github.com/genshingarcia222-sudo/H.A.A.-Nexus.git
active_branch: main
current_phase: "Phase 8 - Commercialization (8.3 Assessment Mode)"
current_milestone: "All Phase 8.3 Assessment decisions resolved (D1-D7); D8, D9, D10 open"
baseline_commit: 865d31e8c6883898e4dab272b71b9ddb3a0a5e9b
last_verified_commit: 865d31e8c6883898e4dab272b71b9ddb3a0a5e9b
last_verified_tests: "PASS - nexus-core 390/390, desktop 228/228, preflight 17/17 (2026-09-21, DEVICE-01)"
last_verified_build: "PASS - pnpm -r build (2026-09-21, DEVICE-01)"
last_verified_typecheck: "PASS - pnpm -r typecheck (2026-09-21, DEVICE-01)"
last_verified_rust: "PASS - cargo test 55/55, rustc 1.98.1 (2026-09-21, DEVICE-01)"
active_task: NEXUS-SYNC-001
task_owner: DEVICE-01
task_status: ACTIVE
last_successful_sync: NOT VERIFIED
last_sync_device: NOT VERIFIED
last_sync_commit: NOT VERIFIED
sync_status: REMOTE_SYNC_PENDING
recovery_status: "none - no recovery in progress"
```

## Pending work

Product and engineering work, with the canonical record for each:

- **D8** (practice/simulation resume, with A6 as its engineering half) and
  **D9** (evaluation-failure behaviour). Both are open owner decisions. See
  `docs/PHASE_8_3_ASSESSMENT_MODE.md` §3.
- **D10** (what persists a web learner's progress). This blocks roadmap step 4
  (web deployment), and therefore step 5 (PayMongo). See `docs/DECISION_REGISTER.md`.
- **A2, A7, A9, A12.** These are accepted Phase 7 debt awaiting decisions or content. See
  `docs/DECISION_REGISTER.md`.
- **Unmerged branch `origin/feat/training-question-bank`** (18 commits ahead of
  `865d31e`, tip `5bcf9f9`). It carries the Training question run (M23), the
  Pilot 001 r3 fixture, decision **D12** (where non-terminology reference
  knowledge lives: open, recorded only on that branch) and the legacy
  `.claude/sync/` handoff bus. Merging it into `main` was escalated to the owner
  in that bus and is **not** decided. Do not merge it without the owner.
- **Human gate on Pilot Batch 001.** No person has verified the source
  locators, so production eligibility stays 0 of 12. This is a human action;
  no code can advance it.

## Known issues

- `docs/PHASE_8_3_ASSESSMENT_MODE.md` §5 still lists D7 as open, but D7 was
  resolved in `9872e11`. This is a stale sentence and was not changed by the
  sync bootstrap.
- `README.md` quotes 279 nexus-core + 144 desktop tests; the measured counts at
  `865d31e` are 390 + 228. This is a stale figure and was not changed by the
  sync bootstrap.
- `README.md` says "`pnpm tauri dev` ... has not been launched end-to-end yet"
  while its own Rust/Tauri section says runtime IPC was verified. The later
  statement is the verified one.
- `pnpm` is not on PATH on DEVICE-01. `npx --yes pnpm@9 <cmd>` is the working
  form there.
