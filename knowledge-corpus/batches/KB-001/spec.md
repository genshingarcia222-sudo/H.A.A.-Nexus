# Batch KB-001 — specification

**Status: generated, QA PASS, 0 approved. Awaiting human review.**

## Purpose

The pilot required by charter section XXX: 250–500 new records distributed across
measured gaps, not across an even grid. It is the first batch of the corpus and it
alters nothing that existed before it.

## Target and outcome

| | Target | Actual |
| --- | --- | ---: |
| New records | 250–500 | 324 |
| Original records altered | 0 | 0 |
| Task types represented | as many as possible | 27 of 27 |
| MCQ share | below 30% | 3.7% |
| Modules represented | all 20 | 20 |
| Competency axes represented | all 12 | 12 |
| Schema errors | 0 | 0 |
| Exact duplicates | 0 | 0 |
| Superficial variants | 0 | 0 |
| Records approved by a machine | 0 | 0 |

## Construction

27 template families × 12 operators (1 base + 11 counterfactual mutations) = 324.

Each family declares its synthetic packet, its task, the one decisive fact the
task turns on, the defensible behaviour, and the trap that competes with it. Each
operator rewrites the packet so that the defensible behaviour *changes* — the
option that is correct in the base case is carried in as a distractor in the
mutation, with an explanation saying so. That is the batch's central design claim:
a learner who memorised the wording of the base case fails the mutation, and a
learner who read the evidence does not.

### Operators

| Operator | Mutation dimensions | What it changes about the answer |
| --- | --- | --- |
| `BASE` | — | Nothing; the unmutated family case |
| `LATE_CLUE` | EVIDENCE_PLACEMENT, EVIDENCE_ORDER | Answer unchanged; the clue is last |
| `BURIED_CLUE` | EVIDENCE_CONCEALMENT | Answer unchanged; the clue is inside routine text |
| `CLUE_REMOVED` | EVIDENCE_REMOVAL, MISSING_FIELD | Answer becomes: name the gap and hold |
| `CONTRADICTION` | CONTRADICTION_INJECTION, SOURCE_AUTHORITY | Answer becomes: surface both, escalate, never pick |
| `SAFETY_CLUE` | URGENCY, TIME_PRESSURE, DOWNSTREAM_CONSEQUENCE | Answer becomes: escalate before completing |
| `WRONG_RECIPIENT` | DESTINATION, PRIVACY_CONSTRAINT, COMMUNICATION_CHANNEL | Answer becomes: hold and reconfirm the destination |
| `IDENTITY_NEAR_MATCH` | PATIENT_IDENTITY, ENCOUNTER_CONTEXT | Answer becomes: two identifiers before any action |
| `OWNERSHIP_AMBIGUOUS` | OWNERSHIP_STATE, HANDOFF_STATE | Answer becomes: name an owner, get acknowledgement |
| `STALE_PREREQUISITE` | MISSING_PREREQUISITE, AUTHORIZATION_STATE, TIMING | Answer becomes: resolve the prerequisite first |
| `PROVENANCE_STRIPPED` | SOURCE_AUTHORITY, DOCUMENTATION_STATE | Answer becomes: trace the origin before relying |
| `MULTI_STAGE` | EVIDENCE_PLACEMENT, OWNERSHIP_STATE, DOWNSTREAM_CONSEQUENCE, TIME_PRESSURE, HISTORY | Answer becomes: reconstruct the sequence, then correct |

`MULTI_STAGE` is the Realistic Premium layer: 27 multi-stage records with delayed
clues, an ownership transition, a downstream consequence and an audit
reconstruction.

## Determinism

`node tools/knowledge-corpus/kb-generate.mjs --batch KB-001` is reproducible.
Slots derive from the global record index alone; no clock and no randomness are
read. Re-running it overwrites the same 27 files with identical bytes, so a failed
batch is rerunnable without duplicating an accepted record, and `kb-manifest.mjs
--check` detects any drift between the records and the manifest.

Ids are minted from template order. **Template order in
`tools/knowledge-corpus/kb-templates.mjs` must not be reshuffled**, or a
regeneration would mint different ids for the same content. Ids are never
recycled.

## Source requirements

| Evidence basis | Records | State | What is needed |
| --- | ---: | --- | --- |
| `SELF_CONTAINED` | 300 | `candidate` | Human content review only. The gold behaviour follows from the packet in the record |
| `EXTERNAL_AUTHORITY` | 24 | `candidate_needs_source_verification` | A registered reviewer must open the cited source and record a `ReviewRecord`. `locatorConfidence` is `NONE`: nothing was fetched |

## Unresolved review items

See `../../review/OPEN_REVIEW_ITEMS.md`. 324 records require human review; 24
additionally require source verification. Nothing in this batch may be delivered
to a learner in its current state.

## Manifest and checksums

`../../manifests/corpus-manifest.json` — 40 checksummed files, verified with
`kb-manifest.mjs --check`.
