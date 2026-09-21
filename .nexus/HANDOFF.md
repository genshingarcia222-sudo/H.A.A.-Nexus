# Handoff Log

Newest first. Each entry is written so that a Claude session with **no access
to the original conversation** can continue from it alone, together with
`CURRENT_STATE.md`, `ACTIVE_TASK.md` and the repository.

`nexus-sync handoff --to DEVICE-0X --next "..."` inserts a new entry below the
marker. It fills the facts from Git (from/to, task, last commit, baseline, files
changed since the claim). Every judgement field is left as a placeholder marker
for the operator to complete. `finalize` refuses to synchronize while any
marker remains.

Required fields: From Device, To Device, Task, Last Commit, Baseline, Tests Run,
Build Result, Typecheck Result, Rust Result, Files Changed, Decisions Made,
Known Issues, Remaining Work, Exact Next Action.

Older handoffs, from before this log existed, are in `.claude/sync/` on
`origin/feat/training-question-bank`. They are history and stay where they are.

<!-- nexus:handoff-entries (newest first; nexus-sync handoff inserts below this line) -->

## 2026-09-21 — DEVICE-01 → ANY — NEXUS-SYNC-001 (bootstrap)

- **From Device:** DEVICE-01
- **To Device:** ANY (in practice DEVICE-02's first session)
- **Task:** NEXUS-SYNC-001 — Establish the distributed workstation sync and recovery protocol
- **Last Commit:** the bootstrap commit that introduced `.nexus/` (on top of
  `865d31e`). The exact SHA is `last_sync_commit` in `CURRENT_STATE.md`, and
  `git log --diff-filter=A -- .nexus/HANDOFF.md` shows it too.
- **Baseline:** `865d31e8c6883898e4dab272b71b9ddb3a0a5e9b` (BASELINE.md B-001)
- **Tests Run:** `npx --yes pnpm@9 -r test` → nexus-core 390/390, desktop
  228/228. `node tools/preflight/preflight.test.mjs` → 17/17.
  `node tools/nexus-sync/nexus-sync.test.mjs` → all pass (count in BASELINE.md B-002).
- **Build Result:** `npx --yes pnpm@9 -r build` → PASS
- **Typecheck Result:** `npx --yes pnpm@9 -r typecheck` → PASS
- **Rust Result:** `cargo test` → 55/55 at baseline. The bootstrap changes no
  Rust or application code, so there was no functional reason to re-run it.
  It was re-run anyway; see BASELINE.md B-002.
- **Files Changed:** `.nexus/*` (new), `tools/nexus-sync/*` (new), `CLAUDE.md`,
  `README.md`, `CHANGELOG.md`, `.gitignore`, `package.json`
- **Decisions Made:** N-001 to N-007 in `DECISIONS.md`. No product decision
  was made or implied.
- **Known Issues:** see `CURRENT_STATE.md` "Known issues". DEVICE-02 has never
  run `nexus-sync`, so its registry record is `UNKNOWN` / `NOT VERIFIED`.
- **Remaining Work:** DEVICE-02 identifies itself and records its first
  synchronization. Product work continues from `CURRENT_STATE.md` "Pending work".
- **Exact Next Action:** on DEVICE-02: `git pull --ff-only` (or a fresh clone),
  then `node tools/nexus-sync/nexus-sync.mjs init-device DEVICE-02`, then
  `node tools/nexus-sync/nexus-sync.mjs start`.

---
