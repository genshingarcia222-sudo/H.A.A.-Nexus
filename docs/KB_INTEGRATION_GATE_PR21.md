# Integration gate — PR #21 (Knowledgebase corpus), assessed on the merged result

**Verdict: DO NOT MERGE YET. Six of the seven gate criteria pass. Criterion 2
fails, for a specific and stated reason — not for the reason the old records
give.**

Assessed 2026-10-14 by DEVICE-01 at `main` = `3c496e3`, PR #21 head
`8ce93b3dac6abac7d707f492110996400db7e9d7`
(`feat/knowledgebase-expansion`). Every statement below was measured on an
actual local merge, in a throwaway worktree on branch
`integration/kb-pr21-trial`. **Nothing was merged to `main` and nothing was
pushed.**

Recorded under the owner's **STANDING AUTHORIZATION**. The merge decision itself
is reported, not taken.

---

## 1. Why this was re-assessed at all

The register, the handoff and the branch's own `INTEGRATION_BLOCKERS.md` all said
PR #21 was blocked on **D18**. **D18 was resolved on 2026-10-04** (contract B is
canonical), so that blocker is discharged and the gate needed re-running against
the repository rather than against the old note. This is that re-run.

`mergeable` is `MERGEABLE` on GitHub and the local merge is genuinely clean. That
is not a reason to merge, and PR #21's own title still says "do not merge —
integration gate open". Mergeability was treated as one criterion out of seven.

## 2. The seven criteria, each checked against the repository

| # | Criterion | Verdict | How it was established |
|---|---|---|---|
| 1 | Scope matches the assignment, touches no other lane's owned files | **PASS** | measured, §3 |
| 2 | No open decision is resolved, narrowed or implied | **FAIL** | §5 — it narrows **O6** |
| 3 | `mergeable` is CLEAN, or conflicts resolved under §10 | **PASS** | real local merge, **zero conflicts**, no conflict policy needed |
| 4 | Relevant suites pass on the **merged result** | **PASS** | §4 |
| 5 | No `.nexus` change outside `nexus-sync` | **PASS** | `.nexus/` is **byte-identical** in the merged tree |
| 6 | No later-phase leakage | **PASS** | adds no application, runtime, Rust, bundler, CI or entitlement code; §3 |
| 7 | `CHANGELOG.md` says what was verified and what was not | **PASS** | the entry carries explicit **Verified** and **"Not verified, and not claimed"** sections, including the admission that the divergence measurement is name-level only |

## 3. What the merge actually contains

107 files, 93,513 insertions, 1 deletion. Entirely additive, in areas that do not
exist on `main`:

| Area | Files |
|---|---|
| `knowledge-corpus/records/` | 57 — **the 432 records**, see §6 |
| `tools/knowledge-corpus/` | 17 — generator, validator, privacy scan, manifest, divergence, scorecard, templates a–e, 3 test suites |
| `knowledge-corpus/registries/` | 11 |
| `knowledge-corpus/qa/` | 6 — QA reports, scorecards, privacy scans |
| `knowledge-corpus/` docs | 7 — README, history, build state, blockers, gap analysis, corpus audit, source reconciliation |
| `knowledge-corpus/{schema,sources,source,review,manifests,batches}` | 6 |
| `package.json` | **additive only** — 11 new `kb:*` scripts, no dependency added, no existing script changed |
| `.gitattributes` | one rule, §7 |
| `CHANGELOG.md` | one entry |

**Proved, not assumed:** in the merged tree, `packages/`, `apps/`, `.github/`,
`.nexus/`, `docs/` and `content/` are **byte-identical to `main`**, and the only
`tools/` change is the 17 new files. No existing file is modified anywhere except
`package.json`, `.gitattributes` and `CHANGELOG.md`.

## 4. Suites on the merged result

Criterion 4 asks for the merged result, not the branch. Each command's real exit
status was captured:

| Command | Exit | Result |
|---|---|---|
| `kb:manifest:check` | 0 | corpus SHA-256 manifest matches — no drift |
| `kb:validate` | 0 | all 432 records pass the lane's 24 policy rules |
| `kb:privacy` | 0 | corpus scans CLEAR |
| `kb:test` | 0 | **52/52**, including *"KB-001 regenerates byte-identically to the committed files"* |
| `kb:test:privacy` | 0 | **19/19** |
| `kb:test:divergence` | 0 | **19/19** |

**90 KB tests pass on the merged result.** The byte-identity test is the one that
matters for the owner's step F: KB-001 is proved byte-identical by regeneration,
not merely by a generator exiting 0, and a separate test proves pools added for
KB-002 do not perturb KB-001's personas.

**The existing suites transfer by construction.** Their inputs — everything under
`packages/`, `apps/` and `tools/` outside `knowledge-corpus` — are byte-identical
in the merged tree, so the B-009 results (nexus-core 807/807, desktop 330/330,
preflight 30/30, nexus-sync 81/81, release 25/25, Rust 70/70) hold on the merged
result unchanged. That is a proof from the diff, not an assumption, and it is
stronger than re-running them would be: a re-run on identical inputs could only
confirm it.

## 5. Criterion 2 — the one that fails, and precisely how

Merging does **not** resolve D18, and it does not reopen it. What it does is
**narrow O6**, and that is enough to fail this criterion.

**O6** is the open question of what happens to the **18 class-(c) policy and
safety fields** that contract A enforces and contract B does not model —
`safetyFlags`, `privacyFlags`, `escalationRequired`, `clinicianJudgmentRequired`,
`hardFailureConditions` and thirteen more. `docs/KNOWLEDGE_ARCHITECTURE.md` §3(c)
requires a per-field decision and states that none may be silently lost.

Today those fields live on a branch, and the migration can decide to carry or
drop each one as a forward-looking choice. **Once they are on `main`, with
`kb-validate.mjs`'s 24 rules — `SAFETY-PRECEDENCE` among them — running in the
repository, dropping any of them stops being "a field we chose not to carry
forward" and becomes "a safety guarantee removed from `main`."** The option set
is the same; the cost and the meaning of one option change materially. That is
what "narrowed or implied" is for.

A second, weaker point, recorded for completeness rather than leaned on: `main`'s
`docs/KNOWLEDGE_ARCHITECTURE.md` §1 names the Knowledge Corpus layer's canonical
location as `packages/nexus-core/src/knowledge-corpus/` "**+ the records it
ingests**". These 432 records are not ingestible by that contract — 43 of their
54 keys have no home in it and 33 of its schemas are `.strict()`. Landing them
would put a tree on `main` that the architecture document does not account for.
That is a documentation problem with a documentation fix, so it is not the basis
of this verdict; criterion 2 is.

### What would make it pass

**Resolve O5 and O6, migrate on the lane, and integrate the migrated result as
one unit.** Then `main` receives records in the canonical contract, the retired
JSON Schema arrives as a clearly-labelled authoring artifact rather than as live
content, and no safety field is dropped from `main` because none was ever on it
unmigrated. The sequencing is the whole point: migrate, then integrate.

This ordering costs nothing. The branch is clean against `main`, `main` moves
only in `docs/` and `.nexus/` in this lane, and nothing is decaying.

## 6. The record count, verified

**432 is correct.** It was re-derived from the files rather than read off the
manifest:

| | Files | Records |
|---|---|---|
| KB-001 | 27 | **324** (27 template families × 12 operators) |
| KB-002 | 30 | **108** |
| **Total** | **57** | **432** |

Each committed JSON file is a **template group** holding a family's records, not
a single record — so a file count reads as 57 and is not the record count. Noted
because the discrepancy is exactly the sort that gets propagated.

Also verified from the manifest, and unchanged: **0 approved, 432 pending human
review, 0 source-verified.** No automated step moved any record toward
production eligibility, and this assessment does not either.

**The declared source archive is absent.** `corpus-manifest.json` records that
neither `nexus_knowledgebase_materials_v1.md` nor the v1.0 PDF is in the
repository, that the 400 seed records it describes are therefore **not** in this
corpus, and that **no part of them was reconstructed from memory**. That is O3,
it is the owner's to supply, and nothing here invents it.

## 7. Divergence re-measured against current `main`

`kb:divergence`, run on the merged result rather than quoted from the October
record:

| | Value |
|---|---|
| Contract A properties declared / required | 54 / 23 |
| Contract B field union / `.strict()` schemas | 54 / **33** |
| Records examined | **432** |
| A keys with a same-named home in B | **11** |
| A keys with **no** home in B | **43** |
| Of those 43, present on all 432 records | **39** |

**The 11-of-54 figure that D18 rests on still holds**, so contract B has not
drifted since the decision and D18 needs no revisiting. The eleven shared names
are `id`, `provenance`, `revision`, `reviewStatus`, `verification`,
`contentStatus`, `evidence`, `flags`, `domain`, `rationale`, `choices` — the
entire governance spine. The lanes agree on identity, provenance, lifecycle and
review, and disagree only about the content model, which is why this is a
migration and not a trust problem.

**A good design decision found in the diff, worth keeping:** `.gitattributes`
gains `knowledge-corpus/**/*.json -text`, because the corpus is pinned by
SHA-256 and a line-ending conversion on checkout would report corpus drift for a
reason unrelated to content. That is the same failure mode found in `Cargo.toml`
during the release build the same day (`docs/RELEASE_CANDIDATE_0.1.0.md` §9) —
and here it was anticipated rather than discovered.

## 8. PR #22

Open against `feat/knowledgebase-expansion`, **not** `main`, so it is not part of
this gate. The lane's own O7 measured its entire diff as 93 insertions in
`CHANGELOG.md` and nothing else. **Not merged, not closed, not modified** — it is
another session's pull request, and nothing here touches it.

## 9. What this assessment did not do

- It did not merge anything to `main`, and did not push the trial branch.
- It did not merge PR #21 or PR #22, and specifically not on the strength of
  `mergeable`.
- It did not migrate a record, change a schema, or alter a registry.
- It did not move any record's review status. **0 of 432 are human-reviewed**,
  and no automated step can change that.
- It did not re-run the existing JS/Rust suites, because it proved their inputs
  byte-identical instead, and says so rather than implying a fresh run.
