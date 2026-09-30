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
current_phase: "Phase 9 - Packaging & Release Hardening (P9-A satisfied; P9-B/C/D-policy/E decision-blocked; Phase 8 is NOT closed)"
current_milestone: "D16 resolved 2026-10-01 under the owner STANDING AUTHORIZATION (not an owner decision): docs/RELEASE_POLICY.md, tools/release/version.mjs, the version display in Settings, and the release profile measured rather than assumed. P9-D is SATISFIED, so Phase 9 now has P9-A and P9-D done and P9-B/C/E blocked on D13 and D14 (D14 needs D10). Control plane at P9-2026-10-01-001. Phase 8 steps 3-8 unstarted with D8, D9, D10 open. DEVICE-02 owns the Knowledgebase lane (PR #21, not merged, D18 first)"
baseline_commit: fba35448eee7c2a777c465b8a78483cc3ce77335
last_verified_commit: fba35448eee7c2a777c465b8a78483cc3ce77335
last_verified_tests: "PASS - nexus-core 784/784, desktop 305/305, preflight 27/27, nexus-sync 81/81, release 25/25 (2026-10-01, DEVICE-01, baseline B-005)"
last_verified_build: "PASS - pnpm -r build; cargo build --release 10,278,912 B (2026-10-01, DEVICE-01, baseline B-005)"
last_verified_typecheck: "PASS - pnpm -r typecheck (2026-10-01, DEVICE-01, baseline B-005)"
last_verified_rust: "PASS - cargo test 70/70 and cargo fmt --check clean, rustc 1.98.1 (2026-10-01, DEVICE-01, baseline B-005)"
active_task: P9-006
task_owner: DEVICE-01
task_status: ACTIVE
last_successful_sync: 2026-09-30T23:25:36.087Z
last_sync_device: DEVICE-01
last_sync_commit: 145cc9054246c10d0981ab54486affe5e134d189
sync_status: REMOTE_SYNCED
recovery_status: "none - no recovery in progress"
```

## Pending work

Product and engineering work, with the canonical record for each:

- **Phase 9 decisions D13, D14 and D16.** Three open owner decisions; D15 was
  resolved on 2026-09-27 as a merge and P9-A is satisfied. See
  `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` §5. D13 (code-signing
  identity) needs a credential; D14 (update-feed location) is entangled with
  D10 and prevents Phase 9 closing before D10 is decided; D16 (release/version
  policy) has no external dependency. Phase 9 items requiring a built or installed Windows
  artifact must be implemented on DEVICE-01 — DEVICE-02 cannot run WiX/NSIS or
  `cargo test` (§6 of that document).
- **D8** (practice/simulation resume, with A6 as its engineering half) and
  **D9** (evaluation-failure behaviour). Both are open owner decisions. See
  `docs/PHASE_8_3_ASSESSMENT_MODE.md` §3.
- **D10** (what persists a web learner's progress). This blocks roadmap step 4
  (web deployment), and therefore step 5 (PayMongo). See `docs/DECISION_REGISTER.md`.
- **A2, A7, A9, A12.** These are accepted Phase 7 debt awaiting decisions or content. See
  `docs/DECISION_REGISTER.md`.
- **`feat/training-question-bank` is MERGED** (D15, owner decision 2026-09-27;
  merge commit `c384ac5`, PR #3). `main` now carries the Training question run
  (M23), the D12 Knowledge Corpus module, Pilot Batch 001 r3 as fixtures, the
  delivery layer with migration `004_delivery_events.sql`, and the P9-A
  `windows_subsystem` attribute with its guard test. The branch's legacy
  `.claude/sync/` bus came with it as history (N-007). Measured on the merged
  tree before the merge commit was created: nexus-core 784/784, desktop 282/282,
  cargo 70/70, typecheck and build clean, preflight 25/25, nexus-sync 81/81.
- **DEVICE-02's Knowledgebase lane is open and deliberately unmerged.**
  `origin/feat/knowledgebase-expansion` (PR #21, marked "do not merge") holds 324
  KB-001 records, a JSON Schema and zero-dependency tooling under
  `knowledge-corpus/` and `tools/knowledge-corpus/`. Its own recorded blocker is
  an **owner decision neither device may take**: two implementations of one
  content contract now exist — D12's Zod model on `main` and that JSON Schema on
  the branch — and which one the runtime ingests is undecided. See
  `knowledge-corpus/INTEGRATION_BLOCKERS.md` on that branch. The only files both
  lanes touch are `CHANGELOG.md` and `.gitattributes`, and both resolve
  mechanically under `docs/PHASES_BUILDING_CONTROL.md` §10(G).
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
