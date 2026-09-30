# H.A.A. Nexus — Release and Version Policy

**This document answers D16.** Before it, `docs/DECISION_REGISTER.md` recorded
that the product declared `0.1.0` in four places, that nothing said which of them
was authoritative, and that there was no tagging convention, channel policy,
release checklist or mapping from `CHANGELOG.md` to a release.

**Decision status: CLAUDE-RECOMMENDED AND IMPLEMENTED UNDER THE OWNER'S STANDING
AUTHORIZATION**, 2026-10-01, DEVICE-01. The owner did not personally choose these
rules; they were selected from the project's own established principles and
implemented under the standing authority recorded in the master control prompt.
Any of them may be overruled by an owner decision, which supersedes this
document without argument.

Where this policy leaves something undecided it says so, and names the decision
that owns it. It does not decide D13 (signing identity), D14 (update feed) or
P9-E (bundle metadata and the installer-visible licence).

---

## 1. The authoritative version source

**The root `package.json` `version` is the product version.** Everything else
mirrors it.

Why that file: it is the only version declaration readable on **both** devices
with no toolchain at all — DEVICE-02's Linux container cannot build the Cargo
crate, and Phase 9 already records that every Windows artifact must be produced
on DEVICE-01. A version source that only one device can read is a source the
other device cannot check.

## 2. The six declarations

| File | Reaches | Enforced by |
|---|---|---|
| `package.json` | nothing directly — it *is* the product version | `version.mjs`, preflight |
| `apps/desktop/package.json` | the frontend bundle, and the number Settings shows in a browser | `version.mjs`, preflight |
| `apps/desktop/src-tauri/tauri.conf.json` | **the installer's advertised version** | `version.mjs`, preflight |
| `apps/desktop/src-tauri/Cargo.toml` `[package]` | **`CARGO_PKG_VERSION`, compiled into the binary** | `version.mjs`, preflight |
| `packages/nexus-core/package.json` | nothing — private, consumed as `workspace:*` | `version.mjs` |
| `packages/ui-kit/package.json` | nothing — private, consumed as `workspace:*` | `version.mjs` |

**One repository, one version.** The two library packages are private and no
dependency resolution reads their numbers, so tracking the product version costs
nothing and removes a question ("why is nexus-core still 0.1.0?") that someone
would otherwise have to answer later.

**The crate version stays pinned to the product version.** D16 was required to
say what the crate version is allowed to do, because `preflight`'s parity check
includes it. The answer is: nothing of its own. The crate is a private
application shell, is never published to a registry, and has exactly one
consumer — the installer that wraps it. A separate crate semver would buy
nothing and would let the binary and the installer disagree, which is the defect
P9-D records. `versionParity` therefore needs no change.

**Never edit these by hand.** Six hand edits is how five of them end up right.

```bash
node tools/release/version.mjs            # what each source declares
node tools/release/version.mjs check      # exit 1 if they disagree or the format is wrong
node tools/release/version.mjs set 0.2.0  # rewrite all six, or refuse and write none
```

The tool plans the whole rewrite before performing any of it, so a refusal leaves
the repository at the version it started from rather than half-bumped.

## 3. The version format

```text
MAJOR.MINOR.PATCH                     a release
MAJOR.MINOR.PATCH-<channel>.<n>       a pre-release, channel ∈ alpha | beta | rc
```

Declared without a leading `v`. Tags carry the `v`: `v0.2.0`, `v0.2.0-rc.1`.

**This is deliberately narrower than semver.** Semver also admits build metadata
(`1.2.3+sha`), a bare `-beta` with no counter, and arbitrary identifiers. The
MSI `ProductVersion` field is numeric — major and minor are single bytes, the
build field is 16 bits — and has no representation for any of that. A version
semver accepts can still be one the installer cannot carry, so the narrower rule
is enforced once, in `parseVersion`, and checked by preflight on every run.

Field limits, enforced: major ≤ 255, minor ≤ 255, patch ≤ 65535.

## 4. When the number changes

A bump happens **only** in a release commit, never as a side effect of feature
work.

| Part | Bumped when |
|---|---|
| **MAJOR** | the persisted SQLite schema or the IPC data contract changes in a way existing installed data cannot be migrated through. A learner losing history is a major version, whatever else shipped with it |
| **MINOR** | a learner-visible capability arrives, or a phase item closes |
| **PATCH** | fixes and internal work only, with no new capability |

`0.x` is pre-1.0 and carries no stability promise. **1.0.0 is not a technical
milestone**: it is the first version sold to someone outside the pilot, and it
requires the whole of §6.

## 5. Channels

| Channel | Version | Targets | Who installs it |
|---|---|---|---|
| **stable** | `X.Y.Z` | MSI **and** NSIS | anyone |
| **rc** | `X.Y.Z-rc.N` | NSIS only | pilot users |
| **beta** | `X.Y.Z-beta.N` | NSIS only | pilot users |
| **alpha** | `X.Y.Z-alpha.N` | NSIS only | DEVICE-01 |

**Why pre-releases are NSIS only.** The MSI version field is numeric and cannot
carry the `-rc.1` part, so two pre-releases of the same base version are
expected to be indistinguishable to the MSI installer and to Windows
Add/Remove Programs — meaning an in-place MSI upgrade between them would not
reliably be recognised as an upgrade at all.

> **STATUS: NOT YET VERIFIED.** This is read from how the MSI version field is
> defined, not from an observed bundler run. Nothing in this repository has ever
> been bundled with a pre-release version. Before the first pre-release ships,
> run `tauri build` with a `-rc.1` version and record what the bundler does with
> it here. If it refuses the version outright, that is a better outcome than the
> silent case, and this section should be rewritten to say so.

## 6. What a release is, and who cuts one

A release is a **tag on `main`** plus the artifacts built from exactly that
commit, plus a row in §12.

**DEVICE-01 cuts every release.** Not a policy preference: every Phase 9
acceptance criterion is a built or installed Windows artifact, and DEVICE-02's
Linux container cannot produce or verify one (`docs/PHASE_9_PACKAGING_RELEASE_HARDENING.md`
§6). DEVICE-02 may prepare and audit a release; it cannot make one.

**The owner approves the tag.** Claude may prepare a release commit, run every
gate and report the result. Creating the tag and distributing an artifact is an
outward-facing act on the owner's product and is theirs.

**A release is refused while any of these is true:**

- a gate in §7 fails;
- an integration hold is open (today: PR #21, `feat/knowledgebase-expansion`);
- a Phase 9 item required by the channel is BLOCKED — **stable requires P9-B
  (signing, D13) and P9-E (bundle metadata, D13 + a legal identity)**;
- `.nexus/ACTIVE_TASK.md` shows another device holding a live task that touches
  the release surface.

**Consequence, stated plainly: `0.1.0` cannot become a stable release.** It is
unsigned, its bundle metadata is empty, and its licence file is a placeholder.
The first thing this policy can produce is an **alpha or rc on the NSIS target,
for the pilot, installed by hand** — and even that ships an unsigned installer
that SmartScreen may block, which is D13's cost and not a bug.

## 7. Release gates

Run in this order, on DEVICE-01, on a clean working tree at the release commit.
Every one of these commands exists today.

```bash
node tools/release/version.mjs check
node tools/nexus-sync/nexus-sync.mjs start
npx --yes pnpm@9 -r test
npx --yes pnpm@9 -r typecheck
npx --yes pnpm@9 -r build
node tools/preflight/preflight.mjs
node tools/preflight/preflight.test.mjs
node tools/nexus-sync/nexus-sync.test.mjs
node tools/release/version.test.mjs
cd apps/desktop/src-tauri && cargo test --offline && cargo fmt --check
npx --yes pnpm@9 tauri build
```

Then, before the tag: record the artifact sizes and `Get-AuthenticodeSignature`
results, append the baseline to `.nexus/BASELINE.md`, and confirm no test count
has regressed.

**None of this is automated.** `.github/workflows/` does not exist, so every gate
above is a hand-run command on a device, and a commit pushed from outside a
session can reach `main` with no suite having run. That gap is recorded in
`docs/PHASES_BUILDING_LEDGER.md` §4(5); closing it is a CI decision on the
owner's account and Actions minutes.

## 8. Artifact naming

Tauri's defaults are kept. Measured from the build at `894a425`:

```text
bundle/msi/H.A.A. Nexus_0.1.0_x64_en-US.msi
bundle/nsis/H.A.A. Nexus_0.1.0_x64-setup.exe
```

The shape is `<productName>_<version>_<arch>[_<locale>]<suffix>`, and the
version in the filename is `tauri.conf.json`'s — which is why §2 keeps that file
in the parity set.

**One thing to carry into D14:** `productName` is `H.A.A. Nexus`, so every
artifact filename contains **spaces and dots**. In a download URL those become
`%20`, and a dot-heavy stem is a common trip-hazard for naive content-type
sniffing and for update manifests that parse filenames. Renaming the artifacts
means renaming the installed application, which is a product decision, not a
packaging one — so the decision here is to keep the names and require D14 to
URL-encode them rather than to rename the product.

## 9. Release profile

**Cargo's defaults ship, and that is now a measured decision** rather than an
absence of one. Measured on DEVICE-01, rustc 1.98.1, `x86_64-pc-windows-msvc`,
same source, release build of `haa-nexus-desktop.exe`:

| Profile | Bytes | vs defaults |
|---|---|---|
| Cargo defaults (no `[profile.release]`) | 10,278,912 | — |
| `strip = true` | 10,277,888 | −1,024 (−0.01%) |
| `strip = true`, `lto = "thin"` | 10,433,024 | **+154,112 (+1.5%)** |

`strip` buys about a kilobyte, because the MSVC toolchain already writes debug
information to a separate `.pdb` rather than into the executable. Thin LTO made
the binary **larger**, through inlining. Neither earns a change to what ships,
and the release build roughly doubled in wall-clock time while the profile was
in place.

`panic` stays at `unwind`. `commands.rs` treats a poisoned mutex as a recoverable
error and returns it to the frontend; `panic = "abort"` removes poisoning from
the language, which would make that handling unreachable and turn one bad command
into a killed application.

If a future release has a size budget, measure again on that code. These three
numbers are evidence about one commit, not a law.

## 10. The version the application displays

Settings shows the running version, and on the desktop it comes from the
**binary** (`get_app_version` → `CARGO_PKG_VERSION`), not from a JSON file.

That distinction is the entire point. The defect this policy exists to prevent is
an installer advertising a version its executable does not carry; a Settings page
reading `package.json` would report the advertised number in exactly the case
where the two differ. In a browser, where there is no binary, the build-time
version is shown and **labelled as a build number**.

`get_app_version` had existed in the Rust shell since before Phase 7 and nothing
in the frontend ever called it, so the number was unreachable from the product.

## 11. Updater comparison semantics

D16 fixes the *ordering*; **D14 still owns where the feed lives, and P9-C remains
BLOCKED.** Nothing here implements an updater.

- Comparison is `compareVersions` in `tools/release/version.mjs`: major, minor,
  patch, then pre-release *before* its own release (`0.2.0-rc.1 < 0.2.0`), then
  channel in the order `alpha < beta < rc`, then the counter.
- **A stable installation is never offered a pre-release.** Channel is a property
  of the installation, not of the feed.
- The version a feed advertises is the product version, identical to
  `tauri.conf.json`'s, so an update decision and an installer filename cannot
  disagree.
- MSI and NSIS installations are **not** interchangeable for updates. An
  installation updates within the target it was installed from.

## 12. Releases

`CHANGELOG.md` stays what it is: a development log, one entry per meaningful
change, mandatory. It is **not** a release log — mapping it to releases by
reading dates is guesswork. Releases are recorded here instead.

| Tag | Version | Commit | Channel | Targets | Artifacts and evidence |
|---|---|---|---|---|---|
| — | — | — | — | — | No release has been cut. §6 says why `0.1.0` cannot be one |

A row is added only after the tag exists and the artifacts have been measured.
An empty table is the honest state; a row for a release nobody cut would not be.

## 13. What this policy does not decide

| Question | Owner |
|---|---|
| Which identity signs the installers | **D13** — blocks stable releases through P9-B and P9-E |
| Where the update feed lives | **D14** (needs **D10**) — blocks P9-C |
| Publisher, copyright, and the licence the MSI shows | **P9-E** — needs D13 plus a recorded legal entity |
| Whether CI enforces §7 | owner: their account, their Actions minutes |
| The commercial licence itself | no repository document records it; `LICENSE.md` is a placeholder and `package.json` says `UNLICENSED` |
