# Gap analysis — what KB-001 addressed, and what it did not

**Date: 2026-09-26. All figures measured from files on disk.**

## 1. The gaps that were measured before generating anything

From `EXISTING_CORPUS_AUDIT.md`, against the repository's real 42-item corpus:

| # | Measured gap | Severity |
| --- | --- | --- |
| G1 | 100% of existing items are four-option single-best-answer questions. 26 of the charter's 27 task types have no representation at all. | Structural — the corpus is a question bank, which section V forbids |
| G2 | Evaluation is single-option matching throughout. No partial credit, no acceptance criteria, no hard-failure conditions. | Structural — section VI.6 requires evaluation not to rest on exact matching |
| G3 | No reusable simulation components: no chart packets, no call transcripts, no inboxes, no referral or result packets, no handoff states. | Structural — layer 4 absent entirely |
| G4 | No error-pattern or remediation model. Nothing maps an error to a competency, a remediation and a retry. | Structural — layer 5 absent entirely |
| G5 | No variant lineage, no mutation dimensions, no counterfactuals. Nothing tests understanding against wording. | Structural — sections XI–XIII absent entirely |
| G6 | Difficulty covers levels 1–3 only. No Hard, Very Hard or Realistic Premium. | Coverage |
| G7 | 2 of 12 competency axes represented (privacy, ICD concept). 10 axes empty. | Coverage |
| G8 | 2 of 20 modules represented. 18 empty. | Coverage |
| G9 | No contradiction, ownership, provenance-loss or audit-reconstruction content. | Coverage |
| G10 | No access-class metadata. Nothing distinguishes Training from closed-book Assessment. | Governance |
| G11 | No corpus manifest, no build state, no batch scorecard, no duplicate control, no automated QA over content files. | Infrastructure |

## 2. What KB-001 closed

| Gap | Closed? | Evidence |
| --- | --- | --- |
| G1 | **Yes** | All 27 task types present, 12 records each. `taskType: MCQ` is 12 of 324 — 3.7%, against the charter's 30% ceiling |
| G2 | **Yes** | Every record carries `acceptanceCriteria` with per-criterion credit summing to 1; every one carries at least one criterion anchored to a specific packet line; safety- and privacy-flagged records carry `hardFailureConditions` |
| G3 | **Yes** | 324 synthetic packets across 13 packet kinds, every one `synthetic: true` |
| G4 | **Yes** | 18 error patterns and 16 remediations registered and cross-linked; every record with an `errorTarget` carries a `remediationTarget` (enforced, rule REMEDIATION) |
| G5 | **Yes** | 11 counterfactual operators over 27 families; 297 of 324 records are variants with `variantOf`, `mutationTypes` and lineage; 0 superficial variants (rule NOV-SUPERFICIAL) |
| G6 | **Partly** | All five bands now present (EASY 9, MODERATE 66, HARD 192, VERY_HARD 30, REALISTIC_PREMIUM 27). The distribution is badly skewed — see §3 |
| G7 | **Partly** | All 12 axes present, none empty. Spread is 12 to 96 — see §3 |
| G8 | **Yes** | All 20 modules present, none empty |
| G9 | **Yes** | 27 contradiction variants (tagged `UNRESOLVED-CONTRADICTION`), 27 ownership, 27 provenance-loss, and a dedicated audit-reconstruction family plus 27 multi-stage variants |
| G10 | **Yes** | Every record carries `accessClasses`. `ASSESSMENT_CLOSED_BOOK` is on **zero** records: the generator cannot assign it |
| G11 | **Yes** | `manifests/corpus-manifest.json` with 40 file checksums and a `--check` mode, `KB_BUILD_STATE.md`, `qa/KB-001.qa-report.json`, `qa/KB-001.scorecard.md`, and a validator implementing 24 named policy rules |

## 3. Gaps KB-001 did **not** close, stated as measured

These are the honest residue. None is concealed by the larger record count.

### 3.1 Difficulty is weighted to HARD — 59.3%

| Band | Records | Share |
| --- | ---: | ---: |
| EASY | 9 | 2.8% |
| MODERATE | 66 | 20.4% |
| HARD | 192 | 59.3% |
| VERY_HARD | 30 | 9.3% |
| REALISTIC_PREMIUM | 27 | 8.3% |

**Cause, measured not guessed.** Six of the eleven mutation operators
(CONTRADICTION, SAFETY_CLUE, WRONG_RECIPIENT, IDENTITY_NEAR_MATCH,
OWNERSHIP_AMBIGUOUS, PROVENANCE_STRIPPED) genuinely add a contradiction or a
competing priority on top of the base dependencies, which is the definition of
the HARD band. Each fires once per family, so each contributes 27 HARD records.

This was not fixed by relabelling. During the build, two operators (LATE_CLUE and
BURIED_CLUE) *were* found to be raising the band wrongly — moving or burying a
clue changes what must be read, not how many things interact — and were corrected
to leave the band alone. That moved 54 records down one band — 42 from HARD to
MODERATE, 6 from MODERATE to EASY, 6 from VERY_HARD to HARD. The remaining skew
is real.

**KB-002 action:** add EASY and MODERATE base families rather than more
mutations, and make the BASE / LATE_CLUE / BURIED_CLUE operators the majority of
that batch. Target a distribution nearer 15 / 35 / 30 / 12 / 8.

### 3.1a What that target actually costs — added 2026-09-27 after KB-002

KB-002 delivered 108 records in the two thin bands and moved the corpus to
14.6 / 27.8 / 44.4 / 6.9 / 6.3 across 432 records. EASY reached its target. HARD
did not, and the reason is arithmetic rather than effort:

**HARD is a fixed 192 records.** No operator produces HARD from an EASY or MODERATE
base without one of the seven band-raising operators, and this workstream is not
going to delete KB-001's HARD records to improve a percentage. So:

    HARD share = 192 / total.  For 30%, total ≈ 640.

The corpus is at 432. Reaching the §3.1 distribution therefore requires roughly
**210 more records in the non-HARD bands**, which is KB-003 and KB-004 work, not a
KB-002 shortfall. Specifically, at a 640-record corpus the targets imply about
96 EASY (+33), 224 MODERATE (+104), 77 VERY_HARD (+47) and 51 REALISTIC_PREMIUM
(+24).

VERY_HARD and REALISTIC_PREMIUM are the awkward pair: the only operators that reach
them are `STALE_PREREQUISITE` and `MULTI_STAGE`, which fire once per family, so
those bands grow only by adding families — 47 more VERY_HARD records means 47 more
families carrying that operator. That is the real cost, and it should be stated
before a future batch promises the distribution cheaply.

### 3.2 Competency spread is 12 to 96

| Axis | Records | Note |
| --- | ---: | --- |
| KB-D12 contradiction, auditability, error control | 96 | Over-represented: most operators touch it by construction |
| KB-D01 identity and encounter context | 72 | The IDENTITY_NEAR_MATCH operator fires on every family |
| KB-D02 clinical intent | 60 | |
| KB-D11 communication and closed loop | 60 | |
| KB-D05 SOAP and documentation | 48 | |
| KB-D04 chart extraction | 36 | |
| KB-D08 medication, lab, imaging | 36 | |
| KB-D06 orders and referrals | 24 | |
| KB-D03 safety and escalation | 24 | Under-represented |
| KB-D09 insurance and authorization | 24 | Under-represented |
| KB-D10 HIPAA and privacy | 12 | **Under-represented, and source-blocked** |
| KB-D07 ICD-10-CM coding support | 12 | **Under-represented, and source-blocked** |

The two thinnest axes are exactly the two that cannot be expanded without
authority. Writing more privacy or coding records here would have produced more
records at `candidate_needs_source_verification` and no more usable content.
**That is a deliberate stop under charter section XLI, not an oversight.**

### 3.3 Source-dependent content is capped at 24 records

Only 24 of 324 records are `EXTERNAL_AUTHORITY`, and all 24 are held at
`candidate_needs_source_verification` with `HUMAN-VERIFY-REQUIRED` and
`locatorConfidence: NONE`. Five source refs are cited. Nothing was opened.

The charter's sections XVI (privacy), XVII (insurance) and XVIII (coding) ask for
substantial expansion in exactly these areas. That expansion is blocked on source
verification, not on generation capacity.

**How the administrative families were handled without faking authority.** The
insurance and prior-authorisation families state the payer rule *as a given of
the synthetic scenario* — "in this scenario the plan's stated rule is…" — and
test whether the responder reasons correctly from a stated rule. They carry
`payerSpecific: true` and the audit tag `SYNTHETIC-GIVEN-POLICY`, and they assert
nothing about how any real payer behaves. This is why they are
`SELF_CONTAINED` and reach `candidate`. It is a narrower claim than the charter's
section XVII ultimately wants, and it is an honest one.

### 3.4 Structural gaps that remain open

- **Record-type coverage is 6 of 18.** Present: `QUESTION`, `DOCUMENTATION_TASK`,
  `WORKFLOW`, `SCENARIO`, `COMMUNICATION_EVENT`, `REMEDIATION`. Absent:
  `KNOWLEDGE_RULE`, `TERMINOLOGY`, `CHART_PACKET`, `ERROR_PATTERN`,
  `COMPETENCY_RULE`, `SOURCE_RECORD`, `SIMULATION_TEMPLATE`, `VARIANT_TEMPLATE`,
  `RUBRIC`, `ASSESSMENT_GATE`, `REFERENCE_MATERIAL`, `VERSION_RECORD`. The
  charter's **layer 2 (structured reusable knowledge objects) does not exist
  yet** — KB-001 built layers 3, 4, 5 and 6 and skipped layer 2, because a
  reusable knowledge rule is a claim about the world and nearly all of layer 2 is
  therefore source-blocked.
- **Packets are embedded, not shared.** Each record carries its own packet. The
  charter (layer 4) wants reusable components cited by `id@revision`.

  **Correction, 2026-09-27 (KB-002).** An earlier revision of this section said
  "the schema supports pinning; the corpus does not use it yet." That is wrong, and
  it was verified wrong before KB-002 relied on it:

  - `packet` in `schema/kb-record.schema.json` is `additionalProperties: false`
    and declares no `packetRef`. The only `*Ref` fields in the schema are a packet
    line's own `ref` and `acceptanceCriteria[].evidenceRef`.
  - The record schema's `required` list includes `goldBehavior`, `rationale`,
    `taskType`, `difficulty` and `fingerprints`, none of which a standalone
    reusable packet has. A `CHART_PACKET` record is therefore not representable
    under the current record schema at all.

  So this is not a corpus-usage gap, it is a **missing schema capability**.
  Delivering it needs a separate component schema
  (`schema/kb-component.schema.json`), an optional `packetRef` on the record, a
  schema version bump, and migration notes — which is STOP GATE 20 and 31
  territory. KB-002 did not attempt it, because bundling a schema migration into a
  content batch is the thing those gates exist to prevent. It is now KB-003's
  first item, with the design stated in §4.
- **Semantic near-duplicate detection is lexical only.** `trigramOverlap` is
  character-trigram Jaccard. It catches a reworded stem; it does not catch a
  genuine semantic paraphrase. The charter (section XIII) allows this — "semantic
  similarity where tooling permits" — and this tooling does not.
- **Persona pool is 14 patients, 7 providers, 6 staff.** Adequate for 324
  records with no repeat inside a family; too small for 3,000.

  **Closed for KB-002 (2026-09-27).** Pools are now registered per batch, because
  `pick` indexes modulo pool length and appending to a shared pool would have
  re-cast all 324 records already awaiting review. KB-001's pools are frozen with a
  test asserting their sizes; KB-002 draws from its own cohort of 28 patients, 16
  providers, 14 staff, 10 practices and 7 payers. Growing a pool is now a per-batch
  act rather than a corpus-wide rewrite.

## 4. Sequenced plan

| Batch | Target | Blocked on | State |
| --- | --- | --- | --- |
| KB-002 | Redress the difficulty skew with EASY/MODERATE base families; grow the persona pool. | Nothing | **Done** — 108 records, EASY 2.8% → 14.6%, HARD 59.3% → 44.4%. `batches/KB-002/spec.md` |
| KB-003 | **The component-schema change**, carried from KB-002 with its premise corrected (§3.4): add `schema/kb-component.schema.json`, an optional `packetRef` on the record, a schema version bump and migration notes; then extract shared `CHART_PACKET` components and pin them by `id@revision`. New content only — KB-001 and KB-002 keep embedded packets, so no existing record is migrated and none becomes uninterpretable. | Nothing. It is a schema change and must be its own commit, not bundled with content | Next |
| KB-004 | MODERATE / VERY_HARD / REALISTIC_PREMIUM mass toward the §3.1 distribution — about 104 MODERATE, 47 VERY_HARD and 24 REALISTIC_PREMIUM, which means new families, not new operators (§3.1a). | Nothing | Planned |
| KB-005 | Layer 2 — `KNOWLEDGE_RULE`, `TERMINOLOGY`, `RUBRIC`, `ASSESSMENT_GATE`. | **Source verification** for anything asserting a rule | Blocked |
| KB-006 | Privacy (KB-D10) and coding (KB-D07) expansion to parity. KB-D07 is the corpus's thinnest axis at 12 records. | **Source verification.** A registered human reviewer must open the authoritative sources and record a `ReviewRecord` | Blocked |
| KB-007+ | Scale toward 3,000 then 10,000 by widening families and slots, not by adding operators. | Nothing, once KB-003's component schema lands | Planned |

**The honest ceiling.** Generation is not the constraint on this corpus; review
is. **432** records are written and 0 are approved — KB-002 moved that ratio in the
wrong direction by 108, which is the honest cost of expanding a corpus nobody has
reviewed. Reaching 10,000 records changes nothing about it unless reviewer capacity
is resourced, and a corpus of 10,000 unreviewed candidates is worth less than 500
reviewed ones. That is the recommendation this analysis ends on.
