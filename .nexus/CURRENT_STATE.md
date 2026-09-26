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
- **Phase-development assignments are not here.** They live in
  `docs/PHASES_BUILDING_CONTROL.md` (control version `P9-2026-09-26-001`) with a
  per-device handoff in `docs/PHASE_BUILD_HANDOFF_DEVICE-0X.md`. That document
  carries no ownership: this file and `ACTIVE_TASK.md` remain the operational
  state, changed only through `nexus-sync`.

```yaml nexus-state
project: H.A.A. Nexus
repository: https://github.com/genshingarcia222-sudo/H.A.A.-Nexus.git
active_branch: nexus/sync-bootstrap (tracks origin/main; publishes with HEAD:main per N-002)
current_phase: "Phase 9 - Packaging & Release Hardening (ENTRY: specification authored only; Phase 8 is NOT closed)"
current_milestone: "Phase 9 spec authored (docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md); D13-D16 open; no Phase 9 implementation performed; control plane at P9-2026-09-26-003 in docs/PHASES_BUILDING_CONTROL.md; lane C-02 documentation sweep integrated (PR #18, #19); PR #3 kept CLEAN without merging (D15); Phase 8 steps 3-8 unstarted and D8, D9, D10 still open"
baseline_commit: 796c5e0ac698319df704b4ba47feb53a7d1f90e0
last_verified_commit: 796c5e0ac698319df704b4ba47feb53a7d1f90e0
last_verified_tests: "PASS - nexus-core 390/390, desktop 228/228, preflight 25/25, nexus-sync 81/81 (2026-09-26, DEVICE-01, baseline B-003)"
last_verified_build: "PASS - pnpm -r build (2026-09-26, DEVICE-01, baseline B-003)"
last_verified_typecheck: "PASS - pnpm -r typecheck (2026-09-26, DEVICE-01, baseline B-003)"
last_verified_rust: "PASS - cargo test 55/55, rustc 1.98.1 (2026-09-26, DEVICE-01, baseline B-003)"
active_task: P9-003
task_owner: DEVICE-01
task_status: COMPLETE
last_successful_sync: 2026-09-26T13:12:13.697Z
last_sync_device: DEVICE-01
last_sync_commit: 41c538a1481be7adae0c4446bbeb8f56b578a4f8
sync_status: REMOTE_SYNCED
recovery_status: "none - no recovery in progress"
```

## Pending work

Product and engineering work, with the canonical record for each:

- **Phase 9 decisions D13 to D16.** All four are open owner decisions and
  all Phase 9 implementation is blocked on them. See
  `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` §5. D13 (code-signing
  identity) needs a credential; D14 (update-feed location) is entangled with
  D10 and prevents Phase 9 closing before D10 is decided; D15 (merge
  `feat/training-question-bank`, whose tip `de2c2d1` already addresses P9-A) is
  the previously escalated branch decision; D16 (release/version policy) has
  no external dependency. Phase 9 items requiring a built or installed Windows
  artifact must be implemented on DEVICE-01 — DEVICE-02 cannot run WiX/NSIS or
  `cargo test` (§6 of that document).
- **D8** (practice/simulation resume, with A6 as its engineering half) and
  **D9** (evaluation-failure behaviour). Both are open owner decisions. See
  `docs/PHASE_8_3_ASSESSMENT_MODE.md` §3.
- **D10** (what persists a web learner's progress). This blocks roadmap step 4
  (web deployment), and therefore step 5 (PayMongo). See `docs/DECISION_REGISTER.md`.
- **A2, A7, A9, A12.** These are accepted Phase 7 debt awaiting decisions or content. See
  `docs/DECISION_REGISTER.md`.
- **Unmerged branch `origin/feat/training-question-bank`** — measured 2026-09-26:
  **44 commits** ahead of `main`, **85 files** differing, tip `082fa95`, and
  **PR #3 is `MERGEABLE` / `CLEAN`**. (The earlier figures here — 18 commits
  ahead of `865d31e`, tip `5bcf9f9`, conflicting — were left behind by the
  branch's own progress and by `main` advancing.) It carries the Training
  question run (M23), the Pilot 001 r3 fixture, decision **D12** (where
  non-terminology reference knowledge lives — **resolved, but recorded only on
  that branch**, so merging imports the decision into `main`), the P9-A
  `windows_subsystem` fix at `de2c2d1` and the legacy `.claude/sync/` handoff
  bus. Merging it is decision **D15** and is **not** decided. Mergeable is not
  authorization: do not merge it without the owner. DEVICE-01 keeps it
  conflict-free as `main` advances, under
  `docs/PHASES_BUILDING_CONTROL.md` §10(G).
- **Human gate on Pilot Batch 001.** No person has verified the source
  locators, so production eligibility stays 0 of 12. This is a human action;
  no code can advance it.

## Known issues

- **`da10dc9` contains a deliberately broken `tools/nexus-sync/nexus-sync.mjs`.**
  It was captured from a transient mutation-test state by a commit made outside
  the bootstrap session. `a1ee456` is the same kind of snapshot. Never restore
  the tool from either commit. Later commits on `main` supersede both, and
  history was not rewritten (CHANGELOG, 2026-09-22 entry).
- **An external GUI commits and pushes this repository.** Five commits —
  `d23e867`, `a1ee456`, `da10dc9`, `75f3746`, `492beb9` — were made outside any
  Claude session, with generic "update" / "Update" messages. Identified on
  2026-09-23 from its own log as **GitHub Desktop**, which committed and ran
  `git push origin nexus/sync-bootstrap:main`. It can capture a working tree
  mid-edit. Close it, or leave it unpushed, during a verification window.
- **Shared working tree observed (2026-09-21).** While the bootstrap ran,
  another session moved the primary checkout `D:\HAA_Nexus\H.A.A.-Nexus`
  between `main` and `feat/training-question-bank`, and the worktree
  `.claude/worktrees/youthful-aryabhata-10eb31` took over `main`. One session
  per working tree (DECISIONS N-004).

- **Four stale statements CLOSED by the C-02 sweep (2026-09-26).** The D7
  listing in `docs/PHASE_8_3_ASSESSMENT_MODE.md` §5, `README.md`'s 279 + 144 test
  counts, `README.md`'s "`pnpm tauri dev` has not been launched end-to-end yet",
  and the Phase 7 audit's packaging-unverified and `"csp": null` conditions were
  all corrected by DEVICE-02 and integrated as PR #18 (`b1ef49d`) and PR #19
  (`2556d1e`). Each correction is additive - the original text survives in each
  document's own update convention - so what was believed at the gate is still
  readable.
- `pnpm` is not on PATH on DEVICE-01. `npx --yes pnpm@9 <cmd>` is the working
  form there.
