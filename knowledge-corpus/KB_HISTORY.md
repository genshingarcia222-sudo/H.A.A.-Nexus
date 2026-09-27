# Knowledgebase history

Append-only. Entries are not rewritten; a correction is a new entry.

## 2026-09-27 — `main` merged in after D15; records unchanged

**Branch:** `feat/knowledgebase-expansion`. `main` advanced 47 commits from
`6c92a30` to `6cb3b6c`, including D15's merge of `feat/training-question-bank`
(`c384ac5`). Merged into this branch at `9b08a0c`. No force-push, no rebase, no
history rewritten.

### What changed on the base

`packages/nexus-core/src/knowledge-corpus/` — the D12 Zod model — is now on
`main`. Verified before merging that neither `knowledge-corpus/` nor
`tools/knowledge-corpus/` exists on `main`, so the other lane touched nothing here.
Also verified that nothing newly on `main` scans `knowledge-corpus/`: `preflight`
reads only `content/scenarios`, so the merged engine and this corpus do not
interact.

### Conflicts

Two, both predicted, both mechanical.

- `CHANGELOG.md` under `docs/PHASES_BUILDING_CONTROL.md` §10(G): every entry from
  both sides preserved, newest first, no text edited. Checked mechanically — ours
  49 headings, theirs 69, union 70, merged 70; none lost, duplicated or invented,
  and both sides' text byte-identical afterwards.
- `.gitattributes` under §10(H): both sides add `-text` rules for different
  hash-pinned files; all five rules preserved unedited.

### Records

**Unchanged. No record was regenerated, renumbered or re-reviewed.** Still 324, QA
PASS, 0 approved. The 40 file checksums are identical to before the merge.

### Corrections to this workstream's own documents

The merge falsified a statement several of these documents made — that the D12
engine was on another branch and unreachable. Corrected under §10(F), current
authoritative state wins:

- `EXISTING_CORPUS_AUDIT.md` — the dated finding is kept, because it is the reason
  this branch is shaped as it is, and a dated update note records what changed.
- `INTEGRATION_BLOCKERS.md`, `KB_BUILD_STATE.md`, `review/OPEN_REVIEW_ITEMS.md` —
  live documents, corrected in place to name `main` rather than the merged branch.
- `manifests/corpus-manifest.json` — regenerated from its source rather than
  hand-edited (§10(B)). Its `generatedOn` now comes from the clock instead of a
  pinned constant, so a rebuilt manifest cannot claim a stale build date; record
  provenance stays pinned in the generator for determinism.

`sources/source-registry.json` was **not** edited. Its `carriedFrom` entries
record the refs the source tables were read from at the time, which is provenance,
not a live pointer.

### What D15 did not decide

Which content contract the runtime ingests. The merge put one of the two
implementations on `main` and chose neither; the decision register was updated to
say so explicitly. Blocker B3 stands, and being able to import the engine is not a
reason to: 324 records built against the wrong contract would multiply the rework
rather than remove it.

### Approved content

**None.** Still 0 of 324.

## 2026-09-26 — workstream established, batch KB-001 generated

**Branch:** `feat/knowledgebase-expansion`, created from `origin/main` at
`6c92a30` and verified as based directly on it. Not merged. No force-push. No
other device's branch touched.

### Source imports

**None.** Both declared source artifacts — `nexus_knowledgebase_materials_v1.md`
and `Nexus_Knowledgebase_Archive_v1.0.pdf` — are absent from the repository and
from this session's filesystem. Recorded as a blocker in
`source/SOURCE_RECONCILIATION_v1.md`. The 400 seed records they describe are not in
this corpus and no part of them was reconstructed from conversational memory.

The owner-supplied workstream charter, which *is* present, was transcribed into 11
machine-readable registries. Transcribing a taxonomy is not importing a corpus.

### Existing corpus audited

42 candidate items measured across three repository artifacts (Pilot Batch 001 r2
and r3, Scribe Batch 002); 0 approved, 0 source-verified. A mature
`knowledge-corpus` engine was found on `origin/feat/training-question-bank` under
owner decision D12 and was deliberately not imported or modified.
`EXISTING_CORPUS_AUDIT.md`.

### Taxonomy established

11 registries: 20 modules (M01–M20), 12 competency axes (KB-D01–KB-D12, with the
D12 naming collision resolved per charter section IV), 5 difficulty bands, 27 task
types, 18 error patterns, 16 remediations, 18 record types, 11 lifecycle states, 6
access classes, 2 coding editions, 29 mutation dimensions and 12 trap types. All
cross-references verified to resolve.

### Schema revision

`schema/kb-record.schema.json` v1 — 54 properties, 23 required, closed objects, 24
named policy rules. Field names, lifecycle vocabulary and provenance rules
deliberately follow the D12 schema so the two can be reconciled rather than
translated.

### Generation batch

KB-001: 324 records from 27 template families × 12 operators (1 base + 11
counterfactual mutations). 300 `SELF_CONTAINED` at `candidate`; 24
`EXTERNAL_AUTHORITY` at `candidate_needs_source_verification`. All 27 task types,
all 20 modules and all 12 competency axes represented. MCQ 3.7%. Deterministic and
reproducible. `batches/KB-001/spec.md`.

### QA improvements

Four defects were found and fixed during the batch. Three were caught by the
validator; the fourth was caught by reading a record, and a new rule was added so
it cannot recur silently:

1. Operator padding refs collided with template refs — 15 records with duplicate
   packet line refs. Refs namespaced.
2. `CLUE_REMOVED` produced 27 records with no decisive line and no packet-grounded
   acceptance criterion. The entry a reader would expect to carry the fact is now
   marked decisive.
3. `LATE_CLUE` and `BURIED_CLUE` overstated their difficulty band. Corrected; 54
   records moved down one band.
4. Two records carried a distractor restating the correct answer. Suppressed in the
   generator; **new rule `CHOICE-COLLISION` added** to the schema's policy list and
   to the validator.

### Major balance corrections

The difficulty distribution was corrected once — see QA item 3 — and the
*remaining* skew (HARD 59.3%) was recorded as a measured imbalance for KB-002
rather than relabelled. `GAP_ANALYSIS.md` §3.1.

### Approved content

**None.** 0 of 324. No machine-reachable path to an approved state exists, and the
validator enforces it.

### Rejected content

None. No record was generated and then discarded; the four defects above were
fixed at the generator and the batch regenerated.

### Deprecated content

None.
