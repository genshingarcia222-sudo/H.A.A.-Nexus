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
  `docs/PHASES_BUILDING_CONTROL.md` (control version `P9-2026-10-02-001`) with a
  per-device handoff in `docs/PHASE_BUILD_HANDOFF_DEVICE-0X.md`. That document
  carries no ownership: this file and `ACTIVE_TASK.md` remain the operational
  state, changed only through `nexus-sync`.

```yaml nexus-state
project: H.A.A. Nexus
repository: https://github.com/genshingarcia222-sudo/H.A.A.-Nexus.git
active_branch: main (publishes to main; the historical nexus/sync-bootstrap checkout is 106 behind and is not used)
current_phase: "Phase 9 - Packaging & Release Hardening (P9-A and P9-D satisfied; P9-B/C/E decision-blocked on D13 and D14; Phase 8 is NOT closed)"
current_milestone: "D18 RESOLVED 2026-10-04 under the owner STANDING AUTHORIZATION: contract B (packages/nexus-core/src/knowledge-corpus, the D12 Zod model) is the canonical runtime-ingestion contract. docs/KNOWLEDGE_ARCHITECTURE.md holds the three-layer boundary and the field-level A-to-B migration map. The 432 KB records are NOT migrated and PR #21 is NOT merged - D18 is a precondition for that work, not a substitute. A9 resolved (dead field removed), A6 closed as superseded by D8. Preflight learned a third outcome, superseded. Open: D10, D13, D14, D17, A2, A7, A12. ICD-10-CM ingestion is specified and NOT BUILT (CMS reachable, nothing retrieved). Control plane at P9-2026-10-02-001"
baseline_commit: ff3a12d7b795956025c2882cb2a66b8dc681ce65
last_verified_commit: ff3a12d7b795956025c2882cb2a66b8dc681ce65
last_verified_tests: "PASS - nexus-core 804/804, desktop 330/330, preflight 30/30, nexus-sync 81/81, release 25/25 (2026-10-04, DEVICE-01, baseline B-008)"
last_verified_build: "PASS - pnpm -r build (2026-10-04, DEVICE-01, baseline B-008)"
last_verified_typecheck: "PASS - pnpm -r typecheck (2026-10-04, DEVICE-01, baseline B-008)"
last_verified_rust: "PASS - cargo test 70/70, fmt clean, clippy 0 warnings, rustc 1.98.1 (2026-10-04, DEVICE-01, baseline B-008)"
active_task: P10-004
task_owner: DEVICE-01
task_status: ACTIVE
last_successful_sync: 2026-10-04T07:42:52.995Z
last_sync_device: DEVICE-01
last_sync_commit: 549d50b0425f6c8a411657db53194099507bd1a6
sync_status: REMOTE_SYNCED
recovery_status: "none - no recovery in progress"
```

## Pending work

Product and engineering work, with the canonical record for each:

- **Phase 9 decisions D13 and D14.** Two open owner decisions. **D15** was
  resolved 2026-09-27 as a merge (P9-A satisfied) and **D16** was resolved
  2026-10-01 under the owner's standing authorization (`docs/RELEASE_POLICY.md`,
  P9-D satisfied) — neither is open any more. See
  `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md` §5. D13 (code-signing identity)
  needs a purchased credential; D14 (update-feed location) is entangled with D10
  and prevents Phase 9 closing before D10 is decided. Phase 9 items requiring a
  built or installed Windows artifact must be implemented on DEVICE-01 —
  DEVICE-02 cannot run WiX/NSIS or `cargo test` (§6 of that document).
- **D8 and D9 are RESOLVED** (2026-10-01, standing authorization, `0c09e36`):
  an interrupted attempt is continued rather than resumed, and a failed
  evaluation is visible, retryable and free. **A6** remains as accepted Phase 7
  debt. See `docs/PHASE_8_3_ASSESSMENT_MODE.md` §3.
- **D10** (what persists a web learner's progress). This blocks roadmap step 4
  (web deployment), and therefore step 5 (PayMongo), and **D14** behind it. Its
  unblocked half is delivered: the learner-state classification, the named
  external blocker and a labelled recommendation are in
  `docs/DECISION_REGISTER.md`. Closing it needs a provider account and an
  account model that do not exist.
- **D17** (may a learner study before retaking an interrupted Assessment) and
  **D18** (which content contract the runtime ingests). Both are open owner
  decisions. D18 blocks the whole of DEVICE-02's Knowledgebase lane and is the
  one to answer first: 324 KB records are authored against a schema it may not
  select. D17 would change D4's scope or D6's retake rule, and a
  characterization test pins today's behaviour so whoever decides it sees the
  current expectation fail and reads why.
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
- **Hand-maintained test counts in prose go stale every time the suite grows.**
  `README.md` line 157 quotes 390 nexus-core + 228 desktop = 618 and line 40
  quotes `cargo test` 55; measured 2026-10-02 they are 804 + 330 = 1134 and
  70/70. Those figures were correct when the C-02 sweep wrote them - the D15
  merge then grew the suites and nothing re-measured. This is the *second* time
  the same sentence has drifted, so the fix worth making is structural rather
  than arithmetic. `README.md` is DEVICE-02-owned and the item is assigned in
  `docs/PHASE_BUILD_HANDOFF_DEVICE-02.md`; DEVICE-01 did not edit it.
- **The control plane itself drifted, and ranked above the register while it
  did** (found and reconciled 2026-10-02 at `P9-2026-10-02-001`). The lesson
  recorded with it: the evidence documents - this file, `BASELINE.md`,
  `docs/PHASES_BUILDING_LEDGER.md` - stayed correct, because every row in them
  carries a command or a commit. The instruction documents drifted, because
  prose asserting a decision's state has nothing to check it against. When a
  decision changes state, the instruction documents are the ones to go and
  correct.
