# Open review items

**As of 2026-09-26. 324 records, 0 approved.**

Nothing in this corpus may be delivered to a learner. This file is the queue.

## 1. Every record needs human content review — 324 items

All 324 are `MACHINE_DRAFTED` under `machine:claude-code-kb-workstream`. The
lifecycle registry marks `human_reviewed` and above as not machine-reachable, and
the validator enforces it: a machine-authored record cannot carry those states,
cannot fill `verification.humanVerifiedBy`, and cannot carry
`reviewStatus: approved`.

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
| O1 | Which schema survives — this branch's `knowledge-corpus/schema/kb-record.schema.json` or the D12 Zod schema on `feat/training-question-bank`? | Two implementations of one contract exist on two branches. Records will have to be migrated to whichever wins |
| O2 | Who is a registered reviewer, and what qualifies someone to verify a privacy or a coding locator? | No review can be recorded until reviewers are registered |
| O3 | Does the archive v1.0 source set still exist, and can it be supplied? | 400 seed records and the whole of corpus layer 1 are absent. See `source/SOURCE_RECONCILIATION_v1.md` |
| O4 | Is the advisory mapping from the five archive difficulty bands to the repository's 6-level authoring scale accepted, rejected, or replaced? | `repositoryLevelHint` is currently advisory and unconsumed. Ingestion needs a real answer |

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
