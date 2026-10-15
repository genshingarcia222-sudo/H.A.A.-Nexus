# Knowledgebase history

Append-only. Entries are not rewritten; a correction is a new entry.

## 2026-10-15 — the migration is measured as blocked, the archive is found outside Git, and its axis table is contaminated

`main` advanced three commits to `34bb6b6` and merged CLEAN (CHANGELOG under
`docs/PHASES_BUILDING_CONTROL.md` §10(G): base 88 / main 89 / lane 91 headings,
both sides purely additive, union 92, merged 92, **0 lost, 0 invented, 0
duplicated**, newest-first order intact, corpus untouched). What it carries is a
summary of DEVICE-01's P9-011 work, which lives on this lane as **PR #24** — a
fourth pull request, and the first one that changes what this lane should do
next.

### The migration is blocked, and this lane re-measured it rather than repeating it

PR #24 adds `tools/knowledge-corpus/kb-migrate.mjs`, which reports
**`migratable today: 0 of 432`**. Re-measured here independently against this
lane's own 432 records, and every figure agrees exactly:

| Measured here | Count |
|---|---|
| records in the corpus | 432 |
| lacking `skillArea` / `learningObjective` / `questionType` / `source` | 432 each |
| lacking `difficultyLevel` (blocked on **O4**) | 432 |
| zero choices **and** an `expectedOutput` — free-text or structured-output tasks | **114** |
| genuinely multi-select (`correctChoiceIds` length > 1) — the **O5** population | 15 |
| `reviewStatus: pending` / approved | 432 / **0** |

The 114 are the structural one: contract B's ITEM family extends a
**multiple-choice** question bank, so it cannot represent a free-text task at
all. Proposed as **O9** in `knowledge-corpus/MIGRATION_BLOCKERS.md` with four
options and their costs.

**This corrects a statement this lane was carrying.** `KB_BUILD_STATE.md` said
the migration was "no longer waiting on a decision" because O5 and O6 had been
resolved. Those two were resolved; the migration is blocked on four different
fields, on O4, and on O9. Corrected in place rather than left to misdirect a
reset session — this is the same failure mode as the stale D18 note, caught
early this time.

### PR #24 verified read-only, and mutation-checked

Verified in a throwaway worktree at `4ec7fea`, nothing merged and nothing
pushed: the engine runs exit 0, `kb-migrate.test` 20/20,
`kb-field-disposition.test` 19/19, `kb-validate.test` 52/52,
`kb-privacy-scan.test` 19/19, `kb-schema-divergence.test` 19/19, manifest
matching at 432 records / 70 checksummed files, validator 0 errors / 0 warnings,
privacy CLEAR. **Mutation-checked:** giving `skillArea` an invented source
(`from: null` → `from: "domain"`) makes **two** tests fail — "no candidate
acquires a field contract A cannot supply" and "every record is blocked on the
unsourceable fields, and says so". Worth recording precisely: unlike PR #23, the
**engine itself still exits 0** under that mutation and still reports 0
migratable, because other fields go on blocking. The no-invention guarantee is
carried by the test suite, not by the engine's exit status.

The `nexus-core` claims — 824 → 867 tests, `tsc --noEmit` clean, the
`accessClasses` drop enforced by `.strict()` — are **not verified here**: this
container has no `node_modules` and no install was attempted. They are verified
by CI, which is green on PR #24's head for both jobs.

### O3 is recovered, outside Git, and this lane cannot verify the artefact

DEVICE-01 reports `Nexus_Knowledgebase_Archive_v1.0_2026-09-22.pdf` on the
owner's local filesystem — 1,219,286 bytes, SHA-256 `ED3BCD26…3F75`, 82 pages,
never committed to any branch and not committed by PR #24. **That file is not
reachable from this container**, so its existence, size and digest are carried
here as DEVICE-01's measurement, not as a fact this lane verified.

What *is* checkable is the committed JSON reference, and this lane re-measured
all six identity criteria on it: 400 distinct record ids; prefix sums
`NEXUS-EA/HA/MO/VE` 84 each and `NEXUS-REAL` 64, totalling 400; bands
84/84/84/84/64 = 400; 336 + 64 = 400; 20 contiguous modules M01–M20; 12
contiguous axes D01–D12. **All six reconcile exactly.** The 400 seed records
are still not in the corpus and none was reconstructed.

### One defect found here that the identity verification did not look for — B9

The archive reference's **competency-axis labels are contaminated and
misaligned by three rows.** 11 of the 12 `competencyAxes[].competency` values
contain three-or-more consecutive spaces — PDF table-bleed — and the bleed is
structural, not cosmetic: outer `D01` holds the table *header*
(`"D12 matrix … Competency"`), outer `D03` holds the header cell `"ID"`, and
outer `D04`…`D12` each carry an **embedded** id running `D01`…`D09`. So reading
`axisId` as the archive's axis id returns the wrong competency for every row —
outer `D08` reads "ICD-10-CM coding support" while its embedded id says that is
the archive's **D05** — and the archive's own D10, D11 and D12 have **no label
in the file at all**. The 20 module labels are clean; only the axis table is
affected.

This does **not** invalidate the O3 identity verification, whose six criteria
are counts and arithmetic and which reproduced exactly here. It invalidates
using that file as the source of axis *identity*, which matters for the charter
§IV `KB-D01`…`KB-D12` addressing and for preserving `source_competency_id`. The
fix is a re-extraction of one table. **The three missing labels were not
guessed**: inferring them would be fabrication. Recorded as blocker **B9**.

### And one thing that is now stale rather than merely unverified — B4

The archive quotes the edition boundary: FY2026 ICD-10-CM active through 30
September 2026, FY2027 beginning 1 October 2026. Today is 2026-10-15, so
**FY2027 is active and FY2026 is superseded** — and `registries/coding-versions.json`
still describes FY2026 as current. That is an archive quotation, not a CMS
retrieval: **CMS remains the authority, nothing was retrieved, and no coding
content was ingested, validated or relabelled.** The two entries remain
`UNVERIFIED_TRANSCRIBED_FROM_CHARTER` and now also name a superseded edition.

### What this session did not do

Did not execute the migration — it is blocked by measurement, and it was never
this session's to start unasked. Did not merge, close or modify PR #21, #22,
#23 or #24. Did not touch `.nexus/`, the records, the manifest, the schema or
any registry. All three lane PRs still merge CLEAN against this lane's head
after this session's push.

## 2026-10-14 (later) — a false premise corrected, and the migration's prerequisite arrives as PR #23

`main` advanced four commits to `2cf6d8a` and merged CLEAN. Two things in it
matter to this lane, and both came from someone measuring instead of re-reading.

### The `accessClasses` premise was false, and this lane already had it right

`main`'s `7fcf86e` corrects `docs/KNOWLEDGE_ARCHITECTURE.md` §6.2, which had
justified dropping `accessClasses` partly because the field was "on zero records
today and the generator cannot assign it". **Re-measured here independently
rather than accepted from the commit message:** all **432** records carry a
non-empty value, split **299 / 106 / 27** across
`[TRAINING,PRACTICE,INSTRUCTOR_ADMIN]`, `+SIMULATION`, and
`+SIMULATION,PREMIUM_REALISTIC` — and **0** records carry
`ASSESSMENT_CLOSED_BOOK`. The figures agree exactly with DEVICE-01's.

**The decision is not reversed**, and nothing here reopens it: it rests on the
leg that no record carries `ASSESSMENT_CLOSED_BOOK`, so dropping the field
cannot drop a closed-book rule. What changed is the honesty of the price — the
drop discards real differentiated data from 432 records, and the 27 marked
`PREMIUM_REALISTIC` are entitlement-adjacent to **D1**.

**This lane needed no correction for it.** `GAP_ANALYSIS.md` G10 has said since
KB-001 that every record carries `accessClasses` and that
`ASSESSMENT_CLOSED_BOOK` is on zero records — which is the true statement. The
false generalisation lived in the architecture document, not here, and no record
in this lane was rewritten on the strength of the correction. Worth noting only
because the opposite would have mattered a great deal.

### PR #23 — the migration's prerequisite, and it is DEVICE-01's

Open against this branch, based directly on this lane's head:
`tools/knowledge-corpus/kb-field-disposition.mjs` plus 19 tests, two `kb:*`
scripts, `kb:verify` extended. It encodes all 54 contract A fields with class,
target and authorising decision — derived from the schema, the 432 records and
the contract B source rather than from prose — and **fails closed**: a populated
field with no disposition, a drop citing no authority, a `direct` mapping naming
a field B lacks, or O5/O6 arithmetic drifting all exit non-zero. Its own count:
11 direct, 7 rename, 9 lift, 17 extend, 1 drop-policy, 9 drop-authoring, and
**contract B must gain 17 fields** before any record validates.

**Verified read-only in a throwaway worktree, not taken on trust** — it lands on
this lane and extends this lane's tooling: tool exit 0, tests 19/19, and all six
existing lane gates still green on its tree. Then the claim that actually
matters, because a check that cannot fail proves nothing: **mutation-tested** by
reclassifying `safetyFlags` from `extend` to a drop — the tool exits **1** and
the tests fail on the 17-field count. The enforcement enforces.

**Not merged, not closed, not modified.** It is DEVICE-01's pull request on
active claimed work (P9-011), so the likely resolution is that DEVICE-01 carries
it forward itself. Recorded as **O8** so it cannot go stranded the way PR #22
did.

### Corpus

**Untouched.** 432 records, QA 0 errors / 0 warnings, privacy CLEAR, 0 approved,
70 checksums identical.

## 2026-10-14 — the gate was assessed on the merged result, and O5 and O6 were decided

**Branch:** `feat/knowledgebase-expansion`. `main` advanced eighteen commits to
`9c7b09b` and conflicted for the first time since this lane opened. One file,
`package.json`, resolved under `docs/PHASES_BUILDING_CONTROL.md` §10(H).

### Someone else audited this corpus, and the audit is better than the records it replaced

`docs/KB_INTEGRATION_GATE_PR21.md`, DEVICE-01, on a **real local merge** in a
throwaway worktree. Verdict **DO NOT MERGE YET**: six of seven criteria pass,
criterion 2 fails. The reason the re-run happened is itself the finding — the
register, the handoff and this lane's own `INTEGRATION_BLOCKERS.md` all still
said the blocker was **D18**, which had been discharged ten days earlier. The
stale note had outlived the fact, and the gate was re-run against the repository
instead of against the note.

**Criterion 2 fails because merging would narrow O6**, by a mechanism this lane
had not identified: once the 18 class (c) fields are on `main` with
`kb-validate.mjs`'s `SAFETY-PRECEDENCE` rule live in the repository, dropping one
stops being a field not carried forward and becomes a safety guarantee removed
from `main`. Same option set; different cost and meaning. The fix is an ordering —
resolve O5 and O6, migrate on the lane, integrate as one unit — and it costs
nothing, because the branch is clean against `main` and nothing is decaying.

### O5 and O6 are decided, and the lane's records had to be corrected

Both by DEVICE-01 under the owner's **standing authorization** and recorded as
**not owner decisions**, in `docs/KNOWLEDGE_ARCHITECTURE.md`:

- **O5 — carry multi-select.** B gains an optional multi-select and the 15
  records migrate. Dropping, re-authoring and holding back were each rejected on
  the record; re-authoring in particular because it would rewrite judged clinical
  assessment content with no reviewer. **The 15 was re-derived independently and
  matches this lane's measurement exactly** — a second derivation, not a citation
  of ours. Its scoring rule, **all-or-nothing**, is flagged as a product call the
  owner may override, not recorded as settled.
- **O6 — carry seventeen of eighteen.** Only `accessClasses` stays dropped on the
  §6.2 reasoning. The argument is an asymmetry: optional additions to `.strict()`
  schemas cannot break a consumer that ignores them, while dropping them deletes
  enforcement that exists and works.

Both defer implementation to the migration commit series so `main` never carries
unconsumed contract surface — the **A9** lesson, which removed
`scenarioSchemaVersion` for exactly that reason.

**So B8 is resolved and B7 is unblocked**, and this lane's `KB_BUILD_STATE.md`,
`review/OPEN_REVIEW_ITEMS.md` and `INTEGRATION_BLOCKERS.md` were saying otherwise.
They are reconciled here under §10(F). The reconciliation is the point: the gate
re-run happened *because* stale records misdirected it, and leaving this lane's
copies stale would set the same trap for the next session.

### The migration was not executed

Deliberately. Its prerequisites are met, but it is substantial, it extends a
contract that lives in `packages/nexus-core` rather than in this lane, and
nobody asked for it. It is surfaced as the next real work, with the prescribed
ordering recorded, and left for the owner. **That is a choice, not an oversight.**

### Corpus

**Untouched.** 432 records, QA 0 errors / 0 warnings, privacy CLEAR, 0 approved,
70 checksums identical. The merge changed no record, registry, schema or tool, and
neither did this entry.

## 2026-10-04 — a sibling session's work found stranded in an open PR against this lane

**Found during a routine watch of PR #21, not by anything that pointed at it.**
A branch `claude/dazzling-hawking-8wl6yu` entered this container's view on a
`git fetch`. It is the push target of **PR #22**, open since 2026-10-01 and
untouched since 2026-10-01T06:39Z, authored by a third DEVICE-02 session
(`session_01SQF8NPEQkjwbqaBd1MS3Pc`). Its base is
`feat/knowledgebase-expansion` — **this lane** — not `main`.

### What it actually contains, measured not read off the PR body

Merge base with this branch is `9e58995`. Against that base the whole diff is
**93 insertions in `CHANGELOG.md` and nothing else**: exactly one `##` entry,
"Knowledgebase Conflict Reconciliation — Two Independent Resolutions, Compared
and Converged (2026-10-01)". No record, registry, schema, tool, package,
workspace or Rust file. `git merge-tree` against this branch's head `35ca619`
reports **CLEAN**; taking it would move the changelog from 84 headings to 85.

The three commits it carries — `fa5a040`, `640b600`, `dbb7c12` — are already
named as DEVICE-02 activity evidence in `.nexus/DEVICE_REGISTRY.md` on `main`
by DEVICE-01's 2026-10-04 reconciliation. So the *commits* are accounted for;
the **entry's content is recorded nowhere in this lane**, which is what this
entry exists to fix.

### Its CI claims were verified against the API rather than repeated

The entry asserts two runs. Both checked directly, both `conclusion: success`,
both belonging to PR #22:

| Run | Head | Result |
|---|---|---|
| `36821096497` | `fa5a040` | success — both jobs |
| `36821384469` | `640b600` | success — both jobs |

The `cargo test` 70/70 and `cargo fmt --check` figures inside the entry are
therefore CI-measured on that branch's tree. They are **not** measurements of
this branch's head, and nothing here restates them as such.

### What is stale inside it, and why that is not a defect

The entry says "D18 is untouched, and it is still what blocks the merge to
`main`." That was true on 2026-10-01 and was made false by `ac8cae2` on
2026-10-04. As a **dated** changelog entry it is a historical record, not a
present claim — but it must not be read without its date, and a reader who
reaches it should go to the 2026-10-04 D18 entry above it.

### What was done about it, and what was deliberately not

**Not merged, not closed, not modified, and the branch not touched.** PR #22 is
another session's pull request. Taking it into this lane is an outward action
this session holds no authorization for, and the charter forbids discarding
another session's work just as firmly as it forbids appropriating it. So it is
**recorded here and raised as O7**, and the decision is the owner's.

The reason this is recorded at all rather than only reported: conversational
memory ranks last in this repository's authority order. A finding that lives
only in a chat reply is lost at the next reset, and this one took a
fetch-and-measure cycle to find.

### Corpus

**Untouched.** 432 records, QA 0 errors / 0 warnings, privacy CLEAR, 0 approved,
70 checksums identical. No record, registry, schema or tool changed by this entry.

## 2026-10-04 — D18 resolved the contract question; this lane's records reconciled

**Branch:** `feat/knowledgebase-expansion`. `main` advanced 15 commits to
`86c36ce` and was merged in cleanly — no conflict, nothing of main's altered.

### What was decided, and by whom

**D18: Contract B is canonical.** The D12 Zod model in
`packages/nexus-core/src/knowledge-corpus/` is the runtime-ingestion contract for
validation, build, ingestion, indexing, retrieval, migration, authoring and
review. This lane's `schema/kb-record.schema.json` is retired.

Resolved by DEVICE-01 under the owner's standing authorization on the owner's
master resolution instruction — **not an owner decision**, and recorded that way
here because the register records it that way. Architecture:
`docs/KNOWLEDGE_ARCHITECTURE.md`.

The measurement reframed it rather than settling it: overlap is 11 of 54 fields
and those 11 are the whole governance spine, so the two lanes never had rival
governance models. The disagreement was only ever about the content model.

### Records

**Unchanged. Nothing migrated, nothing regenerated.** Still 432, QA 0 errors and
0 warnings, privacy CLEAR, 0 approved. The records now validate against a retired
contract, which is the correct state until the migration is designed — migrating
ahead of the class (c) decisions would lose fields silently, which §3(c) forbids.

### One open question answered by measurement

`docs/KNOWLEDGE_ARCHITECTURE.md` §3(b) leaves open "whether multi-select items
exist, and what B does with them", flagging 318 array-form records. Measured here
against the record files: **318 confirmed, but only 15 are genuinely
multi-select** — all `taskType: MULTI_SELECT`, all with exactly two correct
choices, from two template families (12 in KB-001, 3 in KB-002), ids
`KB-QUES-KB001-000013` … `KB-QUES-KB002-000096`. The other 303 hold a single id
and lift mechanically.

That narrows the decision from a 318-record problem to a 15-record one: B either
gains multi-select, or those 15 are dropped, re-authored as single-answer, or held
back. Recorded as review item O5. The 375-record variant-lineage figure in §3(b)
was also re-measured here and agrees exactly.

### Corrections to this lane's own records

The merge made several of this lane's statements false, and they are corrected
under §10(F) — `KB_BUILD_STATE.md` most urgently, because it is the recovery point
and was telling a future session that the single largest blocker was open:

- `KB_BUILD_STATE.md` — B3 marked resolved with what D18 chose; new blockers B7
  (the unmigrated 432) and B8 (the class (c) gaps); NEXT ACTION changed from a
  content batch to the migration, since generating more records against the
  retired contract would only add migration debt.
- `review/OPEN_REVIEW_ITEMS.md` — O1 closed; O5 and O6 opened.
- `INTEGRATION_BLOCKERS.md` — the headline blocker marked resolved, with the
  superseded framing kept because it explains why this branch is shaped as it is.

### Approved content

**None.** Still 0 of 432. D18 changed which contract they must eventually satisfy;
it changed nothing about review, which remains the binding constraint.

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
