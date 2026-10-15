# KB build state

**The recovery point. A session that has lost its conversation starts here, then
verifies every number below against the repository rather than trusting this file.**

| Field | Value |
| --- | --- |
| WORKSTREAM | Knowledgebase development, DEVICE-02. Parallel to PHASES BUILDING; owns no phase task |
| CURRENT ARCHIVE VERSION | **still none in the repository — but it is no longer unaccounted for.** Declared v1.0, absent from every branch and every commit. **O3 was RECOVERED on 2026-10-15 by DEVICE-01:** the archive PDF exists on the owner's local filesystem, outside Git and never committed, and PR #24 carries a reviewable JSON reference at `knowledge-corpus/source/archive-v1-reference.json`. The PDF itself is **not verifiable from this container** — see B1. Also `source/SOURCE_RECONCILIATION_v1.md` |
| CURRENT GENERATION VERSION | `kb-generate/1.0.0` |
| SCHEMA | `knowledge-corpus/schema/kb-record.schema.json`, 24 named policy rules. **Unchanged by KB-002** |
| CURRENT BATCH | KB-002 |
| COMPLETED BATCHES | KB-001 (324, QA PASS, unreviewed), KB-002 (108, QA PASS, privacy CLEAR, unreviewed) |
| NEXT BATCH | KB-003 — the component-schema change. See NEXT ACTION |
| TOTAL RECORDS | 432 |
| APPROVED RECORDS | **0** |
| PENDING REVIEW | 432 (of which 24 also need source verification) |
| REJECTED / DEPRECATED | 0 / 0 |
| SOURCE VERIFICATION STATUS | **0 of 13 registry sources verified. 0 retrieved in this workstream.** KB-002 added no source-dependent records, so the backlog is unchanged at 24 |
| DUPLICATE STATUS | 0 exact, 0 superficial variants, 0 near-duplicate warnings, corpus-wide |
| QA STATUS | **PASS** — 0 errors, 0 warnings across 432 records, measured corpus-wide |
| PRIVACY SCAN | **CLEAR** — 0 findings across 432 records. `qa/corpus.privacy-scan.json` |
| TESTS | 52 QA tests + 19 privacy-scan tests, all passing |
| CURRENT CHECKSUM | `manifests/corpus-manifest.json`, 70 checksummed files; verify with `kb-manifest.mjs --check` |
| BRANCH | `feat/knowledgebase-expansion`, created from `main` at `6c92a30`; `main` merged in at `9b08a0c` after D15 advanced it to `6cb3b6c`, then KB-002 merged on top |
| CURRENT COMMIT | recorded in `manifests/corpus-manifest.json` under `lastVerifiedCommit` |

## What KB-002 changed

1. **A latent bug that would have cloned the corpus.** `generateBatch` walked every
   template regardless of `--batch`, so `--batch KB-002` produced 324 records whose
   content was byte-identical to KB-001 under fresh ids — verified, 324 of 324
   matching prompt hashes. A per-batch QA run could not have caught it, because
   duplicate detection is corpus-wide. Templates are now selected by the batch
   stamped in their own `templateId`, and an unregistered batch throws instead of
   inheriting KB-001.
2. **108 new records** redressing the difficulty skew: EASY 2.8% → 14.6%, HARD
   59.3% → 44.4%. No record's band was relabelled.
3. **Batch-scoped persona pools.** `pick` indexes modulo pool length, so appending
   to a shared pool silently re-casts every record already generated from it.
   KB-001's pools are frozen and KB-002 draws from its own cohort.
4. **A PHI / PII / secret scan**, which did not exist. Charter section XXXIII and
   STOP GATE 9 require one before a batch is review-ready; there was none.
   `tools/knowledge-corpus/kb-privacy-scan.mjs`, with 19 tests that plant
   violations and assert detection.
5. **A closed validator hole.** `REF-INTEGRITY` checked `record.trapTypes` but never
   `choices[].trapType`, so an unregistered trap label rode into the corpus reading
   as taxonomy. Found by planting one. Non-breaking: all 890 pre-existing
   choice-level values were already registered.
6. **A frozen-baseline guard.** A test regenerates KB-001 and asserts it is
   byte-identical to the committed files, which is the charter's section XXXV
   regression set aimed at the failure that actually threatens this corpus.

## COVERAGE GAPS

Measured, in `GAP_ANALYSIS.md`. The four that matter now:

1. **HARD is still 44.4% against a 30% target, and this is arithmetic.** HARD is a
   fixed 192 records, so the share falls only as other bands grow: 30% needs a
   ~640-record corpus. `GAP_ANALYSIS.md` §3.1a has the cost, including the awkward
   part — VERY_HARD and REALISTIC_PREMIUM grow only by adding families, because
   their operators fire once per family.
2. **KB-D07 coding is the thinnest axis at 12 records** and cannot move without
   source verification. KB-D10 privacy rose 12 → 19 using scenario-stated policy
   only; authority-bearing privacy content is still blocked.
3. **Corpus layer 2 does not exist.** Still 6 of 18 record types, unchanged by
   KB-002, which reused the same six (`QUESTION`, `WORKFLOW`, `SCENARIO`,
   `COMMUNICATION_EVENT`, `DOCUMENTATION_TASK`, `REMEDIATION`). No
   `KNOWLEDGE_RULE`, `TERMINOLOGY`, `RUBRIC` or `ASSESSMENT_GATE`, because nearly
   all of layer 2 asserts something about the world. All 27 task types are used.
4. **Reusable packet components are not representable.** Corrected premise: the
   schema does *not* support pinning. `packet` is `additionalProperties: false`
   with no `packetRef`, and the record schema's required fields make a standalone
   `CHART_PACKET` impossible. This needs a component schema, not a corpus change.

## NEXT ACTION

**Corrected 2026-10-15. This section used to say the migration was "no longer
waiting on a decision." That is now false, and it was made false by
measurement, not by opinion.** O5 and O6 were indeed resolved on 2026-10-14, so
the two prerequisites this file named are discharged. But DEVICE-01 then built
the transform engine (PR #24, `tools/knowledge-corpus/kb-migrate.mjs`) and it
reports **`migratable today: 0 of 432`** — so the migration is blocked on
different things, named further down under B7. **Read B7 before treating B7 as
startable.**

The two prerequisites that *were* resolved on **2026-10-14** by DEVICE-01 under
the owner's standing authorization, in `docs/KNOWLEDGE_ARCHITECTURE.md`:

- **O5 — multi-select is carried, not dropped.** Contract B gains optional
  multi-select and the 15 genuinely multi-select records migrate. DEVICE-01
  re-derived the 15 independently and it agrees with this lane's measurement
  exactly. **One part is a product call, not settled:** the scoring rule is
  delegated as **all-or-nothing**, and the register says explicitly that the
  owner wanting partial credit overrides that line.
- **O6 — seventeen of the eighteen class (c) fields are carried.** Only
  `accessClasses` stays dropped, on the §6.2 reasoning. Safety, regulatory
  applicability, assessment semantics and the structural pair all survive
  migration with their values intact — which is not the same as any surface
  acting on them, and the register says so.

Both decisions **defer implementation to the migration commit series**, so `main`
never carries unconsumed contract surface. That is the A9 lesson (`A9` removed
`scenarioSchemaVersion` for exactly this reason), and it means the schema
extension and the records land together or not at all.

**The sequencing is now prescribed, and it is not the one this file used to
assume.** `docs/KB_INTEGRATION_GATE_PR21.md` requires: resolve O5 and O6 → migrate
**on this lane** → integrate the migrated result **as one unit**. Merging the
unmigrated records first is what criterion 2 fails on, so the migration is not
optional preparation for integration; it is a precondition of it.

Nothing in this lane has been migrated. The 432 records are unchanged and still
validate against the retired contract, which remains the correct state until the
migration is executed — see B7.

**One thing is waiting that is not this lane's to decide.** PR #22 is open against
this branch — not against `main` — carrying a single `CHANGELOG.md` entry from a
third DEVICE-02 session that recorded a real coordination failure on 2026-10-01.
It merges CLEAN and touches no record, schema, registry or tool. It is **O7** in
`review/OPEN_REVIEW_ITEMS.md`; this session did not merge, close or modify another
session's pull request. A reset session should check whether it is still open
before doing anything else with the changelog, because taking it later costs more
the further this branch moves.

**Three pull requests are now open against this branch, not against `main`.** PR
#22 is the stranded 2026-10-01 changelog record (**O7**). **PR #23 is
DEVICE-01's P9-011 step A1** — `kb-field-disposition.mjs` and its 19 tests,
which make §3's prose class map machine-checked and fail closed when a
populated field has no disposition (**O8**). **PR #24 is DEVICE-01's P9-011
continuation**, built on #23 and based on this lane's head: the contract B
extension that implements O5 and O6 in `packages/nexus-core`, the transform
engine, `knowledge-corpus/MIGRATION_BLOCKERS.md` with the **O9** proposal, and
the recovered archive reference under `knowledge-corpus/source/`. All three
merge CLEAN against this lane's head as of 2026-10-15, and all three have green
CI. **None was merged, closed or modified by this session**; they are other
sessions' and other devices' pull requests. A fourth, PR #21, is this lane into
`main` and is gated — see `INTEGRATION_BLOCKERS.md`.

## KNOWN BLOCKERS

| # | Blocker | Blocks | Changed since KB-001? |
| --- | --- | --- | --- |
| B1 | **The source archive v1.0 is still absent from the repository — but it has been located outside it.** Re-verified absent across the repository, all branches and the whole session filesystem. **Changed 2026-10-15 (O3 RECOVERED):** DEVICE-01 reports the archive PDF on the owner's local filesystem — `Nexus_Knowledgebase_Archive_v1.0_2026-09-22.pdf`, 1,219,286 bytes, SHA-256 `ED3BCD26…3F75`, 82 pages — never committed, and not committed by PR #24 either. **This lane cannot verify the PDF**: it is not reachable from this container, so its existence, size and digest are DEVICE-01's measurement, carried as a claim and not as a verified fact here. What *is* checkable is the JSON reference PR #24 commits, and this lane re-measured it: its six identity criteria all reconcile exactly (400 distinct ids; prefix sums 84/84/84/84/64 = 400; 336 + 64 = 400; 20 contiguous modules M01–M20; 12 contiguous axes D01–D12). **One defect found by this lane and not by that verification** — the 12 axis *labels* are PDF table-bleed and misaligned; see B9 | Corpus layer 1; the 400 seed records; any real source reconciliation. **The 400 seeds are still not in the corpus and none was reconstructed** |
| B2 | Zero registered reviewers exist on this branch | Any record rising above `candidate`. **The binding constraint on the whole corpus** | No. Worse in absolute terms: 432 pending, up from 324 |
| B3 | ~~Two schemas for one contract~~ — **RESOLVED by D18 on 2026-10-04.** **Contract B — the D12 Zod model in `packages/nexus-core/src/knowledge-corpus/` — is canonical** for validation, build, ingestion, indexing, retrieval, migration, authoring and review. This lane's `schema/kb-record.schema.json` is therefore the **retired** contract, and all 432 records are written against it. Resolved by DEVICE-01 under the owner's standing authorization acting on the owner's master resolution instruction — **not an owner decision**. Architecture: `docs/KNOWLEDGE_ARCHITECTURE.md` | Nothing any longer. The migration it unblocks is B7 below |
| B4 | `registries/coding-versions.json` is transcribed and unverified, and it is load-bearing | Every coding record, now and future | **Partly changed 2026-10-15, and the registry is now also stale.** The recovered archive reference quotes the boundary — FY2026 active through 30 September 2026, FY2027 beginning 1 October 2026 — so **FY2027 is the active edition as of today and FY2026 is superseded**. That is an archive quotation, not a CMS retrieval: **CMS remains the authority, nothing was retrieved, and no coding content was ingested or relabelled.** The two registry entries stay `UNVERIFIED_TRANSCRIBED_FROM_CHARTER`, and they now also describe a superseded edition as current |
| B5 | No integration contract | Any merge toward `main`. `INTEGRATION_BLOCKERS.md` | No |
| B7 | **The 432 records are not migrated, and as of 2026-10-15 the migration is MEASURED AS BLOCKED — `migratable today: 0 of 432`.** DEVICE-01's engine (PR #24) names why, and this lane re-measured every count on its own corpus and agrees exactly: **all 432** records lack `skillArea`, `learningObjective`, `questionType` and `source`, which contract B requires and contract A has no source for; `difficultyLevel` is blocked on **O4** (band → 1-6 level); and **114 records** carry zero choices with an `expectedOutput`, so they are free-text or structured-output tasks that contract B's multiple-choice ITEM family cannot represent at all. That last one is proposed as **O9** in `knowledge-corpus/MIGRATION_BLOCKERS.md`, with four options and their costs. **None of this is fixable by implementation** — each gap needs an authoring decision or human verification, and filling one in by inference would be fabrication. The older field-level analysis still holds: They are written against the retired contract. The field-level map is `docs/KNOWLEDGE_ARCHITECTURE.md` §3, classifying the 43 unmapped A-keys into rename, structural lift, semantic gap and authoring-only. Two lifts carry real information-loss risk: **375 records** carry variant lineage (5 A fields → 3 B fields) and **318** use `correctChoiceIds` as an array against B's singular `correctChoiceId`, which §3(b) calls a real semantic difference rather than a rename | Ingestion of any record; KB-003's first item |
| B8 | ~~Class (c) semantic gaps need a per-field decision~~ — **RESOLVED by O6 on 2026-10-14**, by DEVICE-01 under the owner's standing authorization and recorded as **not an owner decision**. Seventeen of the eighteen fields are **carried**; only `accessClasses` stays dropped on the §6.2 reasoning. `docs/KNOWLEDGE_ARCHITECTURE.md` holds the per-field table §3(c) demands. Implementation is deferred to the migration commit series so `main` never carries unconsumed contract surface | Nothing any longer. The migration it unblocks is B7 |
| B6 | No component schema | Reusable packets, retrieval units, and anything citing a shared component by `id@revision` | **New in KB-002**, on correcting a false premise in GAP_ANALYSIS §3.4 |
| B9 | **The recovered archive reference carries contaminated competency-axis labels, and they are misaligned by three rows.** Measured by this lane on 2026-10-15 against `knowledge-corpus/source/archive-v1-reference.json` on PR #24's head `4ec7fea`. **11 of the 12** `competencyAxes[].competency` values contain three-or-more consecutive spaces, which is PDF table-bleed, and the bleed is not cosmetic: outer `D01` holds the *table header* (`"D12 matrix … Competency"`), outer `D03` holds the header cell `"ID"`, and outer `D04`…`D12` each carry an **embedded** id running `D01`…`D09`. So a consumer reading `axisId` as the archive's axis id gets the wrong competency for every row — outer `D08` reads "ICD-10-CM coding support" but the embedded id says that is the archive's **D05** — and the archive's own D10, D11 and D12 have **no label in the file at all**. The 20 module labels are clean; only the axis table is affected. **This does not invalidate the O3 identity verification**, whose six criteria are all counts and arithmetic and which this lane reproduced exactly; it invalidates using this file as the source of axis *identity*. The fix is a re-extraction of that one table, not an inference — guessing the three missing labels would be fabrication | Any use of the recovered archive to name, map or reconcile competency axes, including the charter §IV `KB-D01`…`KB-D12` addressing and `source_competency_id` preservation. **Blocks nothing already built**: no record in this corpus derives its axis from this file | **New 2026-10-15**, found by this lane while verifying another device's artefact read-only |

**Generation is not the constraint. Review is.** 432 records written, 0 approved.
KB-002 moved that ratio in the wrong direction by 108 records, which is the honest
cost of expanding a corpus nobody has reviewed. Reaching 10,000 records changes
nothing about it; only reviewer capacity does.

## RESET CHECKPOINT

To re-establish state in a new session, in this order:

```bash
git fetch origin
git rev-parse origin/main                                      # canonical main
git log --oneline -3                                           # this branch
node tools/nexus-sync/nexus-sync.mjs start                     # exit 1 = STOP
node tools/knowledge-corpus/kb-manifest.mjs --check             # corpus vs manifest
node tools/knowledge-corpus/kb-validate.mjs                     # corpus-wide QA
node tools/knowledge-corpus/kb-privacy-scan.mjs                 # STOP GATE 9
node tools/knowledge-corpus/kb-validate.test.mjs                # 52 tests
node tools/knowledge-corpus/kb-privacy-scan.test.mjs            # 19 tests
```

Run the validator **without** `--batch` before promoting anything. Duplicate
detection is corpus-wide; a per-batch run cannot see a batch cloning another batch,
which is exactly the bug KB-002 fixed.

Then read, in order: `source/SOURCE_RECONCILIATION_v1.md`,
`EXISTING_CORPUS_AUDIT.md`, this file, `GAP_ANALYSIS.md`,
`batches/KB-002/spec.md`, `review/OPEN_REVIEW_ITEMS.md`,
`INTEGRATION_BLOCKERS.md`.

`kb-manifest.mjs --check` exiting non-zero means the records and the manifest
disagree — trust the records, regenerate the manifest, and find out which commit
changed one without the other. Do not regenerate records to make the manifest
match.

**Do not regenerate a batch expecting new content.** Generation is deterministic:
it produces identical bytes, and a test asserts KB-001 still does. Do not reshuffle
template order within a file, and do not append to a batch's slot pools in
`kb-slots.mjs` — ids are minted from template order and personas from pool length,
and neither is ever recycled. A new batch gets new templates and its own pool
entry.
