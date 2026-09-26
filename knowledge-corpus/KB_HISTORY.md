# Knowledgebase history

Append-only. Entries are not rewritten; a correction is a new entry.

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
