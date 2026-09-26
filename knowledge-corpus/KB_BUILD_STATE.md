# KB build state

**The recovery point. A session that has lost its conversation starts here, then
verifies every number below against the repository rather than trusting this file.**

| Field | Value |
| --- | --- |
| CURRENT ARCHIVE VERSION | **none present.** Declared v1.0; absent from the repository. See `source/SOURCE_RECONCILIATION_v1.md` |
| CURRENT GENERATION VERSION | `kb-generate/1.0.0` |
| SCHEMA | `knowledge-corpus/schema/kb-record.schema.json`, 24 named policy rules |
| CURRENT BATCH | KB-001 |
| COMPLETED BATCHES | KB-001 (generated, QA PASS, unreviewed) |
| NEXT BATCH | KB-002 |
| TOTAL RECORDS | 324 |
| APPROVED RECORDS | **0** |
| PENDING REVIEW | 324 (of which 24 also need source verification) |
| REJECTED RECORDS | 0 |
| DEPRECATED / SUPERSEDED | 0 |
| SOURCE VERIFICATION STATUS | **0 of 13 registry sources verified. 0 retrieved in this workstream.** Every citation is transcribed from an existing repository artifact |
| DUPLICATE STATUS | 0 exact duplicates, 0 superficial variants, 0 near-duplicate warnings |
| QA STATUS | **PASS** — 0 errors, 0 warnings across 324 records. `qa/KB-001.qa-report.json` |
| CURRENT CHECKSUM | `manifests/corpus-manifest.json`, 40 checksummed files; verify with `kb-manifest.mjs --check` |
| BRANCH | `feat/knowledgebase-expansion`, based directly on `main` at `6c92a30` |
| CURRENT COMMIT | recorded in `manifests/corpus-manifest.json` under `lastVerifiedCommit` |

## COVERAGE GAPS

Measured, in `GAP_ANALYSIS.md`. The four that matter:

1. **Difficulty skewed to HARD (59.3%).** EASY is 2.8%. KB-002 redresses it with
   base families, not with relabelling.
2. **Competency spread 12 to 96.** The two thinnest axes — KB-D10 privacy and
   KB-D07 coding — are the two that cannot be expanded without source
   verification.
3. **Corpus layer 2 does not exist.** 6 of 18 record types are used. No
   `KNOWLEDGE_RULE`, `TERMINOLOGY`, `RUBRIC` or `ASSESSMENT_GATE` objects, because
   nearly all of layer 2 asserts something about the world.
4. **Packets are embedded, not shared.** The schema supports `id@revision`
   pinning; the corpus does not use it. This is KB-002's main refactor.

## NEXT ACTION

`GAP_ANALYSIS.md` §4. KB-002: EASY and MODERATE base families to redress the
difficulty skew, refactor packets into shared `CHART_PACKET` records pinned by
`id@revision`, and grow the persona pool. Nothing blocks it.

## KNOWN BLOCKERS

| # | Blocker | Blocks |
| --- | --- | --- |
| B1 | The source archive v1.0 is absent from the repository | Corpus layer 1; the 400 seed records; any real source reconciliation |
| B2 | Zero registered reviewers exist on this branch | Any record rising above `candidate`. This is the binding constraint on the whole corpus |
| B3 | Two schemas for one contract — this branch's JSON Schema and the D12 Zod schema on `origin/feat/training-question-bank` | Ingestion, and the eventual migration of all 324 records |
| B4 | `registries/coding-versions.json` is transcribed and unverified, and it is load-bearing | Every coding record, now and future |
| B5 | No integration contract | Any merge toward `main`. `INTEGRATION_BLOCKERS.md` |

**Generation is not the constraint. Review is.** 324 records written, 0 approved.
Reaching 10,000 records does not change that ratio; only reviewer capacity does.

## RESET CHECKPOINT

To re-establish state in a new session, in this order:

```bash
git fetch origin
git rev-parse origin/main                                   # canonical main
git log --oneline -3                                        # this branch
node tools/knowledge-corpus/kb-manifest.mjs --check          # corpus vs manifest
node tools/knowledge-corpus/kb-validate.mjs --batch KB-001    # re-run QA
```

Then read, in order: `source/SOURCE_RECONCILIATION_v1.md`,
`EXISTING_CORPUS_AUDIT.md`, this file, `GAP_ANALYSIS.md`,
`review/OPEN_REVIEW_ITEMS.md`, `INTEGRATION_BLOCKERS.md`.

`kb-manifest.mjs --check` exiting non-zero means the records and the manifest
disagree — trust the records, regenerate the manifest, and find out which commit
changed one without the other. Do not regenerate records to make the manifest
match.

**Do not regenerate KB-001 expecting new content.** Generation is deterministic:
it produces identical bytes. Do not reshuffle template order in
`tools/knowledge-corpus/kb-templates.mjs` — ids are minted from it and are never
recycled.
