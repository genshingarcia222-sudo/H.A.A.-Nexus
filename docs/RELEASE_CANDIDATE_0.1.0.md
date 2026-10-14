# Release Candidate 0.1.0 — artifact manifest

**Status: A — unsigned internal release candidate.** Not a release, not signed,
not published, not approved for distribution. `docs/RELEASE_POLICY.md` §6 refuses
a stable release while P9-B and P9-E are blocked, and nothing here changes that.
No tag exists and the §12 release ledger stays empty.

**Built:** 2026-10-14 · **Device:** DEVICE-01 (Windows 11 Pro for Workstations
10.0.26200, x86_64) · **Task:** P9-010 · **Recorded under:** `CLAUDE-RECOMMENDED
AND IMPLEMENTED UNDER STANDING AUTHORIZATION` for the measurement and recording;
the decisions that would make this a *release* remain the owner's.

---

## 1. What this document claims, and what it does not

The six things the owner asked to be kept apart, kept apart:

| Claim | Status | Basis |
|---|---|---|
| Production build succeeded | **YES** | both bundlers ran to completion and four artifacts exist, §3 |
| Installers were created | **YES** | MSI *and* NSIS, both configured targets, §3 |
| Same-machine smoke test | **PASS for NSIS; NOT VERIFIED for MSI** | full install→launch→close→relaunch→uninstall lifecycle, §5. The MSI could not be exercised, §6 |
| Clean-machine verification | **NOT PERFORMED** | only this machine was available; §5.6 |
| Unsigned internal RC readiness | **YES** | this document is that readiness record |
| Signed / public production approval | **NO** | P9-B, P9-E and **D13** are open; §7 |

A successful build is not a release candidate on its own, and a same-machine
smoke test is not a clean-machine install. Both distinctions are load-bearing.

## 2. Provenance

| Field | Value |
|---|---|
| Release commit | `e7c8708c5df851c38bb28458681a4e776b35fb8c` |
| Branch | `main`, identical to `origin/main` at build time |
| Commit timestamp | 2026-10-14T16:19:49+08:00 |
| Working tree at build start | **clean** (`git status --porcelain` empty, checked inside the build command before compiling) |
| Build started | 16:19:50 — one second after the commit, from that commit |
| Release profile | **Cargo defaults**, per `RELEASE_POLICY.md` §9. `Cargo.toml` carries no `[profile.release]` |
| Toolchain | `rustc`/`cargo` **1.98.1**, `tauri-cli` **2.11.4**, `vite` 5.4.21, Node 24 |
| Frontend build | 179 modules → `dist/assets/index-DLCOkFB0.js` 344.28 kB (gzip 102.76 kB) |
| Rust compile | `Finished release profile [optimized]` in 50.05s |

**The stale development binary was deleted before the build**, deliberately and
first, so that no Oct-1 artifact could be mistaken for this candidate. The
previous binary's hash was `097A7714…0879`; every hash below is different, which
is itself the freshness proof.

**Build exit status — a correction worth recording.** The build command ended in
`… | tail -25` and then printed `BUILD_EXIT=$?`, so the `0` it reported was
`tail`'s status, not `tauri build`'s. **That number is not evidence and is not
relied on here.** What is relied on: both bundlers printed `Finished 2 bundles
at:`, and all four artifacts exist with mtimes inside the build window
(16:21:18–16:21:28, build started 16:19:50). Artifact existence is the stronger
claim anyway — an exit code says a process ended, these files say what it made.

## 3. Artifacts

Artifacts are **not** in source control (`.gitignore:3` ignores `target/`). Only
this manifest is committed. Paths are relative to
`apps/desktop/src-tauri/target/release/`.

| Artifact | Bytes | SHA-256 | Signature |
|---|---|---|---|
| `bundle/msi/H.A.A. Nexus_0.1.0_x64_en-US.msi` | 3,842,048 | `323df12362a3b213b79b5fc61c1319ed69aee03bfb31d7bbb2f4e1420333ea1b` | `NotSigned` |
| `bundle/nsis/H.A.A. Nexus_0.1.0_x64-setup.exe` | 2,708,547 | `b10281b1e60747249af10449285e0e57a6b2b3146ae2583af57615cbb5e8c5b8` | `NotSigned` |
| `haa-nexus-desktop.exe` — **build intermediate, see §4** | 10,406,400 | `d734b6878bbd9c1859346825d2be9b7fbab84ad8174292ef67dd95975e00915a` | `NotSigned` |
| the same binary **as installed** by the NSIS setup | 10,406,400 | `664ff9f22ea85a9a50c8a6460604253703b1395410ec67c8ef03312f77340bed` | `NotSigned` |

Filenames match `RELEASE_POLICY.md` §8 exactly, including the spaces and dots
that §8 requires D14 to URL-encode rather than rename.

`NotSigned` is the **expected** result, not a defect: P9-B is blocked on D13, and
no signing configuration exists anywhere in `tauri.conf.json`. It is recorded
twice over — `Get-AuthenticodeSignature` for all three PE/MSI files, and
independently from the PE certificate table, which is empty (`rva=0x0 size=0`).

### PE headers, read from the newly built binary

Read directly out of the file headers, not inferred from the build log:

| | `haa-nexus-desktop.exe` | `…_x64-setup.exe` (NSIS stub) |
|---|---|---|
| Machine | `0x8664` — **AMD64 (x64)** | `0x014c` — i386 |
| Optional header magic | `0x20b` — **PE32+** | `0x10b` — PE32 |
| Subsystem | **2 — WINDOWS_GUI** | 2 — WINDOWS_GUI |
| Certificate table | empty | empty |

The application binary is **x64, PE32+, Windows GUI** — the expected
configuration, confirmed from the actual release candidate rather than from an
earlier build. This retires the last of the P9-A evidence gap: the attribute in
`main.rs:8` is the mechanism, the Rust guard test pins it, and this is the
measured consequence in the shipping binary.

**The NSIS stub being 32-bit is normal and is not a wrong-architecture build.**
`makensis` emits a 32-bit installer stub regardless of payload; the payload here
is the x64 binary above, proven byte-for-byte in §4. Recorded because a reviewer
reading `i386` out of an artifact named `x64` would otherwise be right to stop.

### Installer metadata

| MSI | |
|---|---|
| ProductName / ProductVersion | `H.A.A. Nexus` / `0.1.0` |
| ProductCode | `{E1AE93F1-9A2B-4242-9DB0-B5B86219A004}` |
| Manufacturer / Language | `haa` / 1033 |
| Install scope | **per-machine** (`ALLUSERS=1`) — see §6 |

| NSIS, after installing | |
|---|---|
| DisplayName / DisplayVersion | `H.A.A. Nexus` / `0.1.0` |
| Publisher | `haa` |
| InstallLocation | `%LOCALAPPDATA%\H.A.A. Nexus` (**per-user**, no elevation) |
| EstimatedSize | 10,239 KB |
| Installed payload | `haa-nexus-desktop.exe` (10,406,400 B) + `uninstall.exe` (79,186 B) |
| Start menu | `…\Programs\H.A.A. Nexus.lnk` |

The version the installers advertise (`0.1.0`) and the version the binary carries
in its own resource (`ProductVersion`/`FileVersion` = `0.1.0`) agree. That
agreement is the specific defect `RELEASE_POLICY.md` §10 exists to prevent, and
it is checked here against the binary rather than against a JSON file.

## 4. The loose `target/release` exe is **not** the artifact that ships

Measured, and worth knowing before anyone hashes the wrong file:

The build log shows Tauri patching the executable "with bundle type information"
once per bundler — `msi`, then `nsis`. The binary left in `target/release/`
afterwards and the binary the NSIS installer actually places on disk have the
**same length and different hashes**. A byte comparison finds the difference is
**exactly 3 bytes at offset `0x7af572`**:

```text
target/release/haa-nexus-desktop.exe   ->  "UNK"
%LOCALAPPDATA%\H.A.A. Nexus\…\.exe     ->  "NSS"
```

That marker is how the running application knows which installer delivered it
(an updater needs it, since `RELEASE_POLICY.md` §11 holds that MSI and NSIS
installations are not interchangeable). Tauri patches a copy for each bundler and
**restores the loose binary to `UNK`** — correct, tidy behaviour, but it means:

- the **authoritative** candidate hashes are the **MSI's and the setup.exe's**;
- `target/release/haa-nexus-desktop.exe` is a **build intermediate** whose hash
  matches nothing that a user will ever run;
- apart from those 3 bytes the installed binary is **byte-identical** to the one
  whose PE headers were read in §3, so the x64/GUI measurement transfers to the
  shipped payload without assumption.

## 5. Same-machine smoke test — NSIS, full lifecycle

Run on DEVICE-01 as the logged-in user, unelevated. Every step's real exit status
was captured.

| Step | Result | Evidence |
|---|---|---|
| Install, silent (`/S`) | **PASS**, exit 0, ~2s | install dir, registry entry and Start-menu shortcut all created as tabulated above |
| Payload integrity | **PASS** | installed binary byte-identical to the built one but for the 3 marker bytes of §4 |
| Launch #1 | **PASS** | real GUI window — `MainWindowTitle` `H.A.A. Nexus`, `Responding` true, 31 MB working set, three `msedgewebview2` children |
| Persistence attached | **PASS** | opened `%APPDATA%\com.haa.nexus\haa-nexus.sqlite`; **the WAL grew 247,232 → 329,632 bytes across the first launch**, so the app did not merely open the database, it wrote to it |
| Close | **PASS** | exited on window close (`CloseMainWindow`), no force-kill needed, no orphan process |
| Launch #2 (relaunch) | **PASS** | started again, GUI window and non-zero window handle, database re-opened — the `.sqlite`, `-shm` and `-wal` files were **locked by the running process**, which is direct evidence of an open connection |
| Survives detached | **PASS** | stayed alive across separate tool invocations once launched outside the shell's process tree |
| Data integrity across the cycle | **PASS** | main `.sqlite` hash `204F9B3C…` and WAL hash `7DA1CAD1…` unchanged after launch #2; only `-shm` differed, which is the expected volatile shared-memory index |
| Uninstall, silent (`/S`) | **PASS**, exit 0 | install directory removed, registry uninstall entry removed, Start-menu shortcut removed |
| **User data preserved by uninstall** | **PASS** | `%APPDATA%\com.haa.nexus` and all three SQLite files survived with identical hashes — the correct behaviour for user data |

**5.5 — what the smoke test did *not* exercise.** No clinical workflow was driven
through the UI. "Core application behaviour" here means the application starts,
renders its window, attaches and writes to its real SQLite store, closes cleanly
and reopens the same store. A scenario was not run, an evaluation was not scored,
and no assertion is made about them from this test; those paths are covered by
the 1,273 automated tests in §8, not by this install.

**5.6 — clean-machine verification is OUTSTANDING.** This machine is the build
machine. It has the Rust toolchain, the WebView2 runtime and the project's own
dependencies already present, so this test cannot answer the questions a clean
machine answers: whether WebView2 bootstrapping works where it is absent, what
SmartScreen does to an unsigned installer downloaded by a real user, or whether
any linked runtime is missing. **P9-A's remaining gap is exactly this**, and it
stays open. It is recorded as a limitation, not glossed as a pass.

**5.7 — a pre-existing user database was found and protected.** `%APPDATA%\com.haa.nexus`
already contained a SQLite database dated 2026-09-18 from earlier development
runs. It was **backed up before the uninstall step** and verified intact
afterwards. The first identifier checked (`com.haanexus.desktop`) was wrong — the
real one is `com.haa.nexus` from `tauri.conf.json:5` — and the first check
therefore reported "no user data" when user data existed. Recorded because the
near-miss is the lesson: read the identifier from the config, not from the
product name.

## 6. The MSI was NOT smoke-tested, and why

`msiexec /i … /qn` returned **1603**. The verbose log shows `ALLUSERS=1` with
`UILevel=2` in an **unelevated** session, failing immediately after costing with
internal errors 1708/1709 and `Running product … with user privileges: It's not
assigned`. No file was copied; nothing was changed on the machine.

**The cause is the install scope, not a defective package.** Tauri's WiX bundle
is **per-machine** and therefore requires elevation, while its NSIS bundle is
**per-user** and does not — which is why one installed silently in two seconds
and the other could not run at all. Completing the MSI test needs an elevated
installer, i.e. a UAC consent prompt that only the owner can grant.

So: **MSI — created, metadata read, hashed, NOT installed, NOT launched, NOT
uninstalled.** It is not claimed as verified. This also surfaces a real product
question for D14 and for any future distribution decision: *two installers with
two different install scopes* means two different update stories and two
different permission experiences, and the policy does not yet say which is the
intended default.

## 7. What remains blocked

| Item | Blocked on | Unchanged by this candidate |
|---|---|---|
| **P9-B** signed installers | **D13** — a code-signing identity | Nothing here signs anything. No certificate, thumbprint, timestamp URL or sign command exists, and none was fabricated |
| **P9-E** bundle metadata | **D13** plus a recorded legal entity | `bundle` still carries only `active`, `icon`, `targets`; `LICENSE.md` still holds a placeholder |
| **P9-C** auto-update | **D14**, which needs **D10** | No updater plugin, no feed, no `createUpdaterArtifacts` |
| Clean-machine install | hardware/VM availability | §5.6 |
| MSI lifecycle | owner-granted elevation | §6 |
| A stable release / tag | `RELEASE_POLICY.md` §6 | No tag was created; the §12 ledger stays empty |

**Nothing in this package was signed, tagged, published or approved**, and no
legal entity, certificate, credential or human approval was invented to get
further. Those are the owner's to supply.

## 8. Release gates at the candidate commit

All twelve commands from `RELEASE_POLICY.md` §7 were run at `e7c8708` on a clean
tree, each one's real exit status captured independently rather than through a
pipe:

| Gate | Exit | Result |
|---|---|---|
| `tools/release/version.mjs check` | 0 | all six version declarations agree |
| `nexus-sync.mjs start` | 0 | — |
| `pnpm -r test` | 0 | nexus-core **807/807** (67 files), desktop **330/330** (33 files) |
| `pnpm -r typecheck` | 0 | — |
| `pnpm -r build` | 0 | — |
| `preflight.mjs` | 0 | — |
| `preflight.test.mjs` | 0 | **30/30** |
| `nexus-sync.test.mjs` | 0 | **81/81** |
| `version.test.mjs` | 0 | **25/25** |
| `cargo test --offline` | 0 | **70/70** |
| `cargo fmt --check` | 0 | clean |
| `cargo clippy -- -D warnings` | 0 | 0 warnings |

**No count regressed.** Against baseline B-008: nexus-core **804 → 807** (+3, one
new file), everything else identical. 1,273 JavaScript/tool tests and 70 Rust
tests, 1,343 in total, and no test was weakened, skipped or deleted to get here.

## 9. One defect found in the build itself

**`tauri build` rewrites `apps/desktop/src-tauri/Cargo.toml` with LF line
endings.** The file's mtime moved to 16:20:13, mid-build, and afterwards
`git status` reported it modified while `git diff` was **empty** — a
line-ending-only change against a CRLF-normalised repository. Content identity
was proven before anything was touched, then byte identity with the index was
restored.

It is cosmetic but not harmless: it leaves a dirty tree after every release
build, which is precisely the condition `RELEASE_POLICY.md` §7 requires to be
absent at a release commit. Anyone running the gate list after a build will find
the tree dirty for no reason and may be tempted to commit the noise.

**Fixed 2026-10-14 in `tools/release/build.mjs`**, together with the exit-status
defect in §2. The runner classifies each build-generated change as
content-identical or semantic using `git diff`'s own normalisation and restores
only the content-identical ones; a semantic change is refused rather than
discarded, so a legitimately bumped version cannot be cleaned away. 16 tests in
`tools/release/build.test.mjs`, and the runner is now the last line of the §7
gate list. **The classification and restore logic is unit-tested against
disposable repositories; it has not yet been exercised against a real
`tauri build`** - that confirmation is the next release build's to give, and it
is cheap.

---

## 10. Conclusion

`0.1.0` at `e7c8708` is an **unsigned internal release candidate (Status A)**.
The build is real, both installers exist and are measured, the x64 Windows-GUI
configuration is confirmed in the actual binary, and the NSIS installer completes
a full install → launch → persist → close → relaunch → uninstall cycle on this
machine without losing user data.

It is **not** a release. It is unsigned, untested on a clean machine, has no
updater, carries placeholder legal metadata, and its MSI has never been
installed. Promotion past Status A needs **D13** from the owner, not more work
from this device.
