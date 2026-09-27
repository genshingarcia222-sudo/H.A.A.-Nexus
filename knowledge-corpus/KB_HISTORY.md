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

---

## KB-002 — 2026-09-27

**108 records. QA PASS, privacy scan CLEAR, 0 approved. Corpus 432.**

Assigned by `GAP_ANALYSIS.md` §4: redress the difficulty skew with EASY and
MODERATE base families, grow the persona pool, and refactor packets into shared
components. Two of the three were delivered; the third rested on a false premise
and is carried forward corrected.

### Defects found and fixed

1. **`generateBatch` ignored `--batch`.** It walked every template, so
   `--batch KB-002` emitted 324 records byte-identical to KB-001 under fresh ids —
   verified, 324 of 324 matching prompt hashes. A per-batch QA run could not have
   caught it, because duplicate detection is corpus-wide. Templates are now selected
   by the batch stamped in their own `templateId`; an unregistered batch throws.
   **This was the most serious thing found in this batch**: left alone, the next
   batch would have doubled the corpus with duplicates that passed their own QA.
2. **Shared slot pools would have rewritten KB-001.** `pick` indexes modulo pool
   length, so appending one persona to `PATIENTS` re-casts every record generated
   from it — 324 records awaiting review. Pools are now registered per batch and
   KB-001's are frozen, with a test asserting their sizes.
3. **`REF-INTEGRITY` never checked `choices[].trapType`.** Only the record-level
   list was validated, so an unregistered trap label rode into the corpus reading as
   taxonomy. Found by planting one and watching QA pass. Non-breaking to close: all
   890 pre-existing choice-level values were already registered.
4. **The generator misreported its own work.** The summary printed
   `operators ${OPERATORS.length}` regardless of how many a batch used. It now
   reports operators actually used.
5. **Three records cued their answer by length** (`ANSWER-LEAKAGE`, correct choice
   1.60–1.73× the mean). Caught by the validator during the build and shortened.
6. **One EASY family exceeded the band's packet-line ceiling** once `LATE_CLUE`
   added its noise lines. Trimmed to three base lines, which is the real constraint
   on an EASY family under that operator.

### Facilities added

- **`kb-privacy-scan.mjs`** — the PHI / PII / secret scan charter section XXXIII
  and STOP GATE 9 require before a batch is review-ready. **There was none.** It
  proves provenance (every identity traces to a declared synthetic pool, every
  MRN is a reserved `SYN-####`, every synthetic token matches a declared
  convention) and pattern-matches ten classes of contact detail and credential.
  19 tests plant violations and assert detection; a scanner never shown to fail
  proves nothing. It documents what it cannot prove: that an invented name belongs
  to nobody real.
- **A frozen-baseline guard** — a test regenerates KB-001 and asserts byte-identity
  with the committed files. This is charter section XXXV aimed at the failure that
  actually threatens this corpus, and it held through every change in this batch.
- **`operatorIds` on a template** — a family may narrow its operator set, which is
  what makes EASY and MODERATE mass reachable at all.
- **`safetyBaseline` / `privacyBaseline` on a template** — a family whose own base
  packet carries a red flag or disclosure risk declares it there. Previously the
  only route to those competencies was through operators that force HARD, which is
  structurally why KB-001 had no EASY safety content.

### Corrections to earlier records

`GAP_ANALYSIS.md` §3.4 stated "the schema supports pinning; the corpus does not use
it yet." **Verified false.** `packet` is `additionalProperties: false` with no
`packetRef`, and the record schema's required fields make a standalone
`CHART_PACKET` unrepresentable. It is a missing schema capability, not a usage gap,
and delivering it needs a component schema and a version bump — STOP GATE 20 and 31.
Corrected in place, carried to KB-003, and recorded as blocker B6.

### Major balance corrections

None. The distribution moved because 108 records entered the thin bands; no record's
band was relabelled. EASY 2.8% → 14.6%, HARD 59.3% → 44.4%. HARD remains 14 points
above target and cannot be brought down by this method — `GAP_ANALYSIS.md` §3.1a
records the arithmetic rather than leaving a future batch to promise it cheaply.

### Approved content

**None.** 0 of 432. Unchanged in kind: no machine-reachable path to an approved
state exists, and the validator enforces it.

### Rejected content

None. The six defects above were fixed at the generator or the template and the
batch regenerated.

### Deprecated content

None. KB-001 is untouched, byte for byte.
