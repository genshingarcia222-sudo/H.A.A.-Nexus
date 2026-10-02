# KB build state

**The recovery point. A session that has lost its conversation starts here, then
verifies every number below against the repository rather than trusting this file.**

| Field | Value |
| --- | --- |
| WORKSTREAM | Knowledgebase development, DEVICE-02. Parallel to PHASES BUILDING; owns no phase task |
| CURRENT ARCHIVE VERSION | **none present.** Declared v1.0; absent from the repository. See `source/SOURCE_RECONCILIATION_v1.md` |
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

**KB-003 — the component-schema change, as its own commit, with no content batch
bundled into it.** `GAP_ANALYSIS.md` §3.4 and §4.

1. Add `schema/kb-component.schema.json` for reusable components, with its own
   required fields. Do not relax the record schema's required list to accommodate
   components.
2. Add an optional `packetRef` (`^KB-[A-Z]{4}-KB[0-9]{3}-[0-9]{6}@[0-9]+$`) to the
   record schema, alongside `packet` rather than replacing it.
3. Bump the schema version and write migration notes. **KB-001 and KB-002 keep
   their embedded packets** — nothing is migrated, so no committed record becomes
   uninterpretable and no reviewer's verification is invalidated.
4. Only then extract shared `CHART_PACKET` components, and only for new content.

Then KB-004 for MODERATE / VERY_HARD / REALISTIC_PREMIUM mass, per §3.1a.

## KNOWN BLOCKERS

| # | Blocker | Blocks | Changed since KB-001? |
| --- | --- | --- | --- |
| B1 | The source archive v1.0 is absent from the repository | Corpus layer 1; the 400 seed records; any real source reconciliation | No. Re-verified absent across the repository, all branches, and the whole session filesystem |
| B2 | Zero registered reviewers exist on this branch | Any record rising above `candidate`. **The binding constraint on the whole corpus** | No. Worse in absolute terms: 432 pending, up from 324 |
| B3 | Two schemas for one contract — this branch's JSON Schema and the D12 Zod schema at `packages/nexus-core/src/knowledge-corpus/`, which D15's merge `c384ac5` put on `main` on 2026-09-27. The merge did **not** decide which the runtime ingests | Ingestion, and the eventual migration of all 432 records | **Yes, by D15** — the second implementation is now on `main` rather than on an unmerged branch, which makes the undecided contract question live rather than hypothetical. Recorded by DEVICE-01 |
| B4 | `registries/coding-versions.json` is transcribed and unverified, and it is load-bearing | Every coding record, now and future | No. KB-002 added no coding records, deliberately |
| B5 | No integration contract | Any merge toward `main`. `INTEGRATION_BLOCKERS.md` | No |
| B6 | No component schema | Reusable packets, retrieval units, and anything citing a shared component by `id@revision` | **New in KB-002**, on correcting a false premise in GAP_ANALYSIS §3.4 |

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
