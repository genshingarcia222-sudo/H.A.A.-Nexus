# Open review items

**As of 2026-09-27. 432 records, 0 approved.**

Nothing in this corpus may be delivered to a learner. This file is the queue.

## 1. Every record needs human content review — 432 items

All 432 are `MACHINE_DRAFTED` under `machine:claude-code-kb-workstream`. The
lifecycle registry marks `human_reviewed` and above as not machine-reachable, and
the validator enforces it: a machine-authored record cannot carry those states,
cannot fill `verification.humanVerifiedBy`, and cannot carry
`reviewStatus: approved`.

KB-002 added 108 of these. Its own priority order is in
`../batches/KB-002/spec.md`; the batch's five safety- and privacy-flagged families
come first.

What a content reviewer is being asked to confirm, per record:

1. The packet is coherent and entirely synthetic.
2. The decisive line genuinely settles the task.
3. The gold behaviour is the defensible action, and is inside the stated role's
   scope.
4. Each distractor is genuinely wrong and its explanation says why.
5. The difficulty band matches the reasoning complexity, not the vocabulary.
6. The error and remediation targets are the right ones.
7. Nothing asserts a clinical, regulatory, coding or payer fact that the record
   does not carry.

## 2. Twenty-four records additionally need source verification

`EXTERNAL_AUTHORITY` records, held at `candidate_needs_source_verification` with
`HUMAN-VERIFY-REQUIRED` and `locatorConfidence: NONE`.

| Family | Records | Cited refs |
| --- | ---: | --- |
| `KB-VART-KB001-000022` privacy judgment | 12 | `HHS-PR-SUMMARY`, `HHS-MIN-NECESSARY`, `CFR-164-502` |
| `KB-VART-KB001-000023` coding support | 12 | `CDC-ICD10CM-GL-FY27`, `CDC-ICD10CM` |

A registered reviewer must open each locator, confirm the wording supports the
gold behaviour, and record the snapshot. **A locator that cannot be confirmed
sends the record to `rejected`, not to a lower confidence label.**

## 3. The source registry is entirely unverified — 13 refs

`sources/source-registry.json` carries `retrievedInThisWorkstream: 0` and
`humanVerified: 0`. Every entry was transcribed from an existing repository batch
artifact, together with the verification status that artifact records. Two
classifications were corrected on transcription (the Joint Commission entries,
from `SECONDARY` to `PROFESSIONAL_BODY`).

Reviewers should treat `authorityClass` as the publisher's standing, not as
evidence that the locator was checked.

## 4. The coding-version registry needs confirming against its publishers

`registries/coding-versions.json` carries two ICD-10-CM edition windows
transcribed from the owner-supplied charter, each marked
`UNVERIFIED_TRANSCRIBED_FROM_CHARTER`. They are load-bearing: the validator
rejects a coding record whose encounter date falls outside its declared edition.
If a boundary is wrong, records will have been validated against a wrong window.

**This is the highest-leverage single verification in the queue**, because one
registry entry governs every coding record the corpus will ever hold.

## 5. Owner decisions required

| # | Decision | Why it blocks |
| --- | --- | --- |
| O1 | ~~Which schema survives~~ — **CLOSED by D18 on 2026-10-04: Contract B** (the D12 Zod model in `packages/nexus-core/src/knowledge-corpus/`) is canonical. This lane's `schema/kb-record.schema.json` is retired. Decided by DEVICE-01 under the owner's standing authorization, **not by the owner personally**; `docs/DECISION_REGISTER.md` D18 and `docs/KNOWLEDGE_ARCHITECTURE.md` | Nothing further. The migration it unblocks is O5 and O6 below |
| O2 | Who is a registered reviewer, and what qualifies someone to verify a privacy or a coding locator? | No review can be recorded until reviewers are registered |
| O3 | Does the archive v1.0 source set still exist, and can it be supplied? | 400 seed records and the whole of corpus layer 1 are absent. See `source/SOURCE_RECONCILIATION_v1.md` |
| O4 | Is the advisory mapping from the five archive difficulty bands to the repository's 6-level authoring scale accepted, rejected, or replaced? | `repositoryLevelHint` is currently advisory and unconsumed. Ingestion needs a real answer |
| O5 | **The `correctChoiceIds` → `correctChoiceId` lift.** `docs/KNOWLEDGE_ARCHITECTURE.md` §3(b) leaves open "whether multi-select items exist, and what B does with them". **Measured in this lane on 2026-10-04: they exist, and there are exactly 15** — every one `taskType: MULTI_SELECT`, every one with exactly 2 correct choices, from two template families (12 in KB-001 from `KB-VART-KB001-000002`, 3 in KB-002 from `KB-VART-KB002-000026`), ids `KB-QUES-KB001-000013` … `KB-QUES-KB002-000096`. The other 303 array-form records hold a single id and lift mechanically. So the decision is narrow: B either gains multi-select or these 15 records are dropped, re-authored as single-answer, or held back. It is not a 318-record problem | Blocks the migration of 15 records only; the remaining 303 are unaffected |
| O6 | **The 18 class (c) policy and safety fields** B does not model — `safetyFlags`, `privacyFlags`, `escalationRequired`, `hardFailureConditions`, `goldBehavior`, `acceptanceCriteria`, `evidenceBasis` and eleven more. §3(c) requires a per-field decision and states none may be silently lost. These are the fields this lane's QA enforces today (rule `SAFETY-PRECEDENCE` among them), so dropping one silently would remove a guarantee a reviewer can currently rely on | The migration, and the safety/privacy properties currently enforced |
| O7 | **Whether to take PR #22 into this lane.** It is open against `feat/knowledgebase-expansion` (not `main`), authored 2026-10-01 by a third DEVICE-02 session and untouched since. Measured, not read off its body: against the merge base `9e58995` the entire diff is **93 insertions in `CHANGELOG.md` and nothing else** — one `##` entry recording that two sessions resolved the same `main`-into-lane conflict in parallel, and the coordination lesson from it. `git merge-tree` against `35ca619` reports **CLEAN**; the changelog would go from 84 headings to 85. Its two CI claims were checked against the API and both are genuine successes (`36821096497` at `fa5a040`, `36821384469` at `640b600`). It contains no record, schema, registry, tool or workspace change. One caveat: the entry states "D18 is untouched", true on 2026-10-01 and false since `ac8cae2` — historical, but it must be read with its date. **This session did not merge, close or modify it**, because it is another session's pull request | Blocks nothing. But the entry's content is recorded nowhere else in this lane, so leaving the PR to rot is the only way its author's work gets lost |

### O1, measured

`npm run kb:divergence` measures the two contracts instead of describing them.
Re-run it rather than trusting these figures: they are a snapshot of a tool whose
output moves with the schemas.

As of this commit, against all 432 authored records:

| | Contract A (this branch, authoring) | Contract B (`main`, runtime) |
| --- | --- | --- |
| File | `knowledge-corpus/schema/kb-record.schema.json` | `packages/nexus-core/src/knowledge-corpus/` + `question-bank/` |
| Shape | one flat record type, `recordType` discriminator | four typed families: KNOWLEDGE / ITEM / CONTEXT / CONCEPT |
| Fields | 54 declared, **all 54 populated** by the corpus | 54 across the family union |
| Field names in common | **11** | **11** |
| Field names with no counterpart | **43** | **43** |

The eleven shared names are `choices`, `contentStatus`, `domain`, `evidence`,
`flags`, `id`, `provenance`, `rationale`, `reviewStatus`, `revision`,
`verification`.

**Why this is a migration and not a rename.** Three findings, each from the tool:

1. **The models disagree about what a record *is*.** A is one record type that
   carries its own prompt, packet, choices and gold behaviour. B splits the same
   material across families and expresses an assessment item as an extension of
   the **Training question bank** schema (`AssessmentItemObjectSchema` extends
   `TrainingQuestionObjectSchema`), so B's item lineage is D12's question bank,
   not this corpus. The two were designed from different starting points.
2. **B's schemas are `.strict()` — 33 of them.** An unrecognised key is a
   validation error, not an ignored extra. So the 43 unmapped keys are not
   "additional detail B would tolerate": every record carrying one fails until
   that key has a home. **39 of the 43 appear on all 432 records**; only four are
   partial — `correctChoiceIds` (318), `expectedOutput` (114), `canonicalOrder`
   (16) and `steps` (16).
3. **Nothing is free in either direction.** A declares no property the corpus
   leaves unused, so no part of A can be dropped as dead weight; and 43 of B's
   fields — including `family`, `kind`, `statement`, `questionId`,
   `targetSegmentIds` — are supplied by no record, so adopting B means authoring
   them, not just moving what exists.

**This measurement does not choose.** It does not say which contract is better,
and the direction of migration is still O1. What it establishes is that O1 is a
54-field remodelling of 432 records in either direction, not a schema-file
deletion — so it should be decided before more batches are authored, because
every further record multiplies the same cost.

## 6. Known defects found and fixed during this batch — closed, recorded

Kept here because the charter's history requirement (section XXXVIII) says QA
improvements are recorded, and because each was a real defect the tooling caught:

1. **Padding refs collided with template refs.** The operator padding helper minted
   `N1..N3`, which several templates already used, producing duplicate packet line
   refs on 15 records. Fixed by namespacing every operator-introduced ref (`OP-`,
   `PAD`). Caught by rule `EB-PACKET`.
2. **`CLUE_REMOVED` left no decisive line and no packet-grounded criterion** on 27
   records. Fixed by marking the entry a reader would expect to carry the fact as
   decisive, and adding a criterion that requires establishing it does not supply
   it. Caught by rule `EB-PACKET`.
3. **Two operators overstated their difficulty band.** `LATE_CLUE` and
   `BURIED_CLUE` raised the band by one, but moving or burying a clue changes what
   must be read, not how many things interact. Corrected; 54 records moved down a
   band. Caught by rule `DIFFICULTY` and by reading the band definitions.
4. **Two records carried a distractor that restated the correct answer.** Where a
   mutation's defensible behaviour coincides with the family's base behaviour, the
   base answer is not a trap, and carrying it in marked a correct action wrong.
   Fixed by suppressing any distractor within 0.40 trigram overlap of a correct
   choice, and a new rule `CHOICE-COLLISION` was added so it cannot recur
   silently. **Found by reading a record, not by the validator** — which is why
   the rule now exists.
