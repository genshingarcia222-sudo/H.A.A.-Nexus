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

## 2026-09-26T00:47:54.651Z — DEVICE-02 → DEVICE-01 — P9-001

- **From Device:** DEVICE-02
- **To Device:** DEVICE-01
- **Task:** P9-001 — Phase 9 entry: author the packaging and release-hardening specification
- **Last Commit:** `1f694f8e512d399a261da3a1e7fdecf25dbb1b6a` (the handoff record itself is committed on top of it)
- **Baseline:** `1d7b209307e7f2a2490cd113116e65052aada980` (see BASELINE.md)
- **Tests Run:** PASS on DEVICE-02 at 7e304a1 - nexus-core 390/390, desktop 228/228, preflight 17/17, nexus-sync 60/60
- **Build Result:** PASS - pnpm -r build (DEVICE-02)
- **Typecheck Result:** PASS - pnpm -r typecheck, all three projects (DEVICE-02)
- **Rust Result:** NOT VERIFIED on DEVICE-02 - cargo test fails at gdk-sys (gdk-3.0 absent); toolchain here is rustc 1.94.1 vs the recorded 1.98.1. Recorded 55/55 on DEVICE-01 stands.
- **Files Changed** (since claim `7e304a1`): `.nexus/ACTIVE_TASK.md`, `.nexus/CURRENT_STATE.md`, `.nexus/DEVICE_REGISTRY.md`, `CHANGELOG.md`, `docs/DECISION_REGISTER.md`, `docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`
- **Decisions Made:** D13, D14, D15, D16 recorded as OPEN in docs/DECISION_REGISTER.md. No decision was resolved. Phase 9 scope specified in docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md.
- **Known Issues:** P9-A deliberately NOT implemented: origin/feat/training-question-bank tip de2c2d1 already addresses it, and merging that branch is the escalated owner decision D15. Implementing it on main would conflict in main.rs. Two Phase 7 audit lines are stale (tauri build now succeeds; CSP is a real policy) and were intentionally left as written.
- **Remaining Work:** All five Phase 9 items P9-A..P9-E. Every item whose acceptance criterion is a built or installed Windows artifact must be done on DEVICE-01: WiX/NSIS and cargo test cannot run on the DEVICE-02 Linux container. Phase 9 cannot close before D10 is decided (via D14). Phase 8 remains open - roadmap steps 3-8 unstarted, D8/D9/D10 open.
- **Exact Next Action:** Resolve D15 first (it decides whether P9-A is a merge or a code change), then D16 and P9-D which need no credential. D13 then P9-B/P9-E. D14 then P9-C last, because D14 is entangled with the open D10.

---

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
