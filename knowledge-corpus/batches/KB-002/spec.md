# Batch KB-002 — specification

**Status: generated, QA PASS, privacy scan CLEAR, 0 approved. Awaiting human review.**

## Purpose

The batch `GAP_ANALYSIS.md` §4 assigned: redress KB-001's difficulty skew with
EASY and MODERATE *base families* rather than more mutations, and grow the persona
pool. It adds 108 records and alters nothing in KB-001.

Two of the three items §4 listed for this batch were delivered. The third — the
shared `CHART_PACKET` refactor — was found to rest on a false premise and is
carried forward with that premise corrected. See **What this batch did not do**.

## Target and outcome

| | Target | Actual |
| --- | --- | ---: |
| New records | EASY/MODERATE mass | 108 |
| KB-001 records altered | 0 | 0 (proved byte-identical by test) |
| EASY share of corpus | ≈15% | 14.6% (63 of 432) |
| HARD share of corpus | ≈30% | 44.4% (192 of 432), down from 59.3% |
| MCQ share of batch | below 30% | 6.5% |
| Schema errors | 0 | 0 |
| Warnings | 0 | 0 |
| Exact duplicates | 0 | 0 |
| Superficial variants | 0 | 0 |
| PHI / secret findings | 0 | 0 (`qa/KB-002.privacy-scan.json`) |
| Records approved by a machine | 0 | 0 |
| External-authority records added | 0 | 0 — see **Source discipline** |

## Construction

30 template families, each declaring the operators it is built with — a mechanism
this batch introduced, because the whole point is to *stop* using the operators
that force the band upward.

| Half | Families | Operators | Records | Band |
| --- | ---: | --- | ---: | --- |
| `kb-templates-d.mjs` | 18 | `BASE`, `LATE_CLUE`, `BURIED_CLUE`, `CLUE_REMOVED` | 72 | 54 EASY + 18 MODERATE |
| `kb-templates-e.mjs` | 12 | `BASE`, `LATE_CLUE`, `BURIED_CLUE` | 36 | 36 MODERATE |

### Why these operators

Measured from `kb-operators.mjs`, not assumed:

- `BASE`, `LATE_CLUE`, `BURIED_CLUE` return `base.baseDifficulty` unchanged.
  Moving or burying a clue changes what must be *read*, not how many things
  interact, and difficulty here measures reasoning complexity.
- `CLUE_REMOVED` raises the band exactly one step, floored at MODERATE. An EASY
  family under it yields MODERATE, which is why the EASY half carries it and the
  MODERATE half does not — a MODERATE family under it would land back in HARD.
- The other seven operators force HARD, VERY_HARD or REALISTIC_PREMIUM by
  construction. KB-001 already supplies 249 records in those three bands. None of
  them is used here.

No record's band was relabelled to reach the distribution. The share moved because
new records entered the thin bands.

## Difficulty, before and after

| Band | KB-001 | KB-002 | Corpus | Share | §4 target |
| --- | ---: | ---: | ---: | ---: | ---: |
| EASY | 9 | 54 | 63 | 14.6% | 15% |
| MODERATE | 66 | 54 | 120 | 27.8% | 35% |
| HARD | 192 | 0 | 192 | 44.4% | 30% |
| VERY_HARD | 30 | 0 | 30 | 6.9% | 12% |
| REALISTIC_PREMIUM | 27 | 0 | 27 | 6.3% | 8% |

EASY reached its target. HARD fell 14.9 points but remains 14 points above it, and
**that gap cannot be closed by this batch's method**: HARD is a fixed 192 records,
so reaching 30% requires the corpus to reach about 640 records. The arithmetic is
in `GAP_ANALYSIS.md` §3.1a. MODERATE, VERY_HARD and REALISTIC_PREMIUM are short
for the same reason.

## Coverage

Competency weighting deliberately favoured the axes KB-001 under-served and did
**not** touch the two that are source-blocked:

Counted from the committed records, not from the template declarations. A record
carrying two axes counts once against each, so the column sums exceed 108.

| Axis | KB-001 | KB-002 added | Corpus |
| --- | ---: | ---: | ---: |
| KB-D01 identity and encounter context | 72 | 12 | 84 |
| KB-D02 clinical intent | 60 | 13 | 73 |
| KB-D03 safety and escalation | 24 | 11 | 35 |
| KB-D04 chart extraction | 36 | 13 | 49 |
| KB-D05 SOAP and documentation | 48 | 14 | 62 |
| KB-D06 orders and referrals | 24 | 11 | 35 |
| KB-D07 ICD-10-CM coding support | 12 | **0 — source-blocked** | 12 |
| KB-D08 medication, lab, imaging | 36 | 17 | 53 |
| KB-D09 insurance and authorisation | 24 | 11 | 35 |
| KB-D10 HIPAA and privacy | 12 | 7 | 19 |
| KB-D11 communication and closed loop | 60 | 29 | 89 |
| KB-D12 contradiction and error control | 96 | 13 | 109 |

The three thinnest axes that are **not** source-blocked — KB-D03 safety, KB-D06
orders and referrals, and KB-D09 insurance, each at 24 — all rose to 35. KB-D07
remains at 12 and is the corpus's thinnest axis; it cannot move without source
verification. 26 of the 27 task types appear in this batch.

## Source discipline

Every one of the 108 records is `SELF_CONTAINED` and sits at `candidate`. The batch
adds **no** `EXTERNAL_AUTHORITY` content, so it adds nothing to the source
verification backlog, which stays at KB-001's 24 records.

This is a deliberate stop under STOP GATE 4, not an oversight. KB-D07 coding and
authority-bearing KB-D10 privacy expansion both require a registered human
reviewer to open a source; writing them here would have produced more records at
`candidate_needs_source_verification` and no more usable content.

Where a family needs a rule to reason from, the rule is stated as a given of that
synthetic scenario ("the workflow stated for this scenario…") and the record
carries `SYNTHETIC-GIVEN-POLICY` where payer-specific. Nothing asserts how any
real payer, regulator or organisation behaves. The two privacy families test
whether authority was established and whether a disclosure stayed inside the scope
it was authorised for — both answerable from the packet, neither a claim about law.

## Safety and privacy families at low bands

KB-001 had no EASY safety content, structurally: the only route to the safety and
privacy competencies was the `SAFETY_CLUE` and `WRONG_RECIPIENT` operators, both of
which force HARD. This batch adds `safetyBaseline` and `privacyBaseline` on a
template, so a family whose *own* base packet carries a red flag or a disclosure
risk declares it there. The flags carry identical weight either way:
`escalationRequired`, the hard-failure conditions and the `SAFETY-PRECEDENCE` rule
all apply. Five families use them: three safety, two privacy.

## Personas

KB-001's pools are frozen. `pick` indexes modulo pool length, so appending one
persona to a shared pool silently re-casts every record already generated from it —
which would have rewritten 324 records awaiting review. KB-002 therefore draws from
its own cohort, registered per batch in `kb-slots.mjs`:

| Pool | KB-001 | KB-002 |
| --- | ---: | ---: |
| Patients | 14 | 28 |
| Providers | 7 | 16 |
| Staff | 6 | 14 |
| Practices | 4 | 10 |
| Payers | 3 | 7 |

A test asserts KB-001's pool sizes, so a future append fails loudly rather than
quietly.

## What this batch did not do

- **The shared `CHART_PACKET` refactor.** `GAP_ANALYSIS.md` §3.4 stated "the schema
  supports pinning; the corpus does not use it yet." That is false, and it was
  verified false: `packet` is `additionalProperties: false` with no `packetRef`, and
  the record schema's required fields (`goldBehavior`, `rationale`, `taskType`,
  `difficulty`, `fingerprints`) make a standalone packet record unrepresentable.
  The refactor needs a separate component schema, an optional `packetRef`, a schema
  version bump and migration notes — STOP GATE 20 and 31 territory. Bundling a
  schema migration into a content batch is exactly what those gates exist to stop,
  so it is carried to KB-003 with the premise corrected in `GAP_ANALYSIS.md`.
- **Any expansion of KB-D07 or authority-bearing KB-D10.** Blocked on source
  verification, as above.
- **Corpus layer 2** (`KNOWLEDGE_RULE`, `TERMINOLOGY`, `RUBRIC`, `ASSESSMENT_GATE`).
  Unchanged from KB-001: nearly all of layer 2 asserts something about the world.

## Reproducibility

| Field | Value |
| --- | --- |
| Generator | `kb-generate/1.0.0` |
| Schema | `knowledge-corpus/schema/kb-record.schema.json` (unchanged by this batch) |
| Templates | `kb-templates-d.mjs`, `kb-templates-e.mjs` |
| Operators | `kb-operators.mjs`, unchanged |
| Seed | per record, `templateId#operatorId` |
| Determinism | byte-identical on rerun; asserted by test |

Regenerate with:

```bash
node tools/knowledge-corpus/kb-generate.mjs --batch KB-002
node tools/knowledge-corpus/kb-validate.mjs --batch KB-002
node tools/knowledge-corpus/kb-privacy-scan.mjs --batch KB-002
```

Model output is not replayable byte-for-byte; the *pipeline* is. The templates are
committed source, so the records are a deterministic function of files in the
repository, not of a model invocation.

## Review requirements

All 108 records are `pending` and need human content review. Priority order for
this batch, following charter section XXXIV:

1. The five safety- and privacy-flagged families — `…000002`, `…000018` and
   `…000028` (11 safety-flagged records), `…000008` and `…000030` (7
   privacy-flagged records). Safety and disclosure content first.
2. The two privacy families' scope reasoning, which is the nearest this batch comes
   to a legal claim and is deliberately framed as a stated scenario rule.
3. The three `payerSpecific` families (11 records), for the same reason.
4. The remainder by difficulty, MODERATE before EASY.
