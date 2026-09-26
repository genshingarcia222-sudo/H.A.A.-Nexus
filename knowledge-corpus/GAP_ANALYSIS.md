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
  charter (layer 4) wants reusable components cited by `id@revision`. The schema
  supports pinning; the corpus does not use it yet. This is the main refactor
  ahead of KB-002.
- **Semantic near-duplicate detection is lexical only.** `trigramOverlap` is
  character-trigram Jaccard. It catches a reworded stem; it does not catch a
  genuine semantic paraphrase. The charter (section XIII) allows this — "semantic
  similarity where tooling permits" — and this tooling does not.
- **Persona pool is 14 patients, 7 providers, 6 staff.** Adequate for 324
  records with no repeat inside a family; too small for 3,000.

## 4. Sequenced plan

| Batch | Target | Blocked on |
| --- | ---: | --- |
| KB-002 | ~400 records. Redress the difficulty skew with EASY/MODERATE base families; refactor packets to shared `CHART_PACKET` records pinned by `id@revision`; grow the persona pool. | Nothing |
| KB-003 | Layer 2 — `KNOWLEDGE_RULE`, `TERMINOLOGY`, `WORKFLOW` objects, and the `RUBRIC` / `ASSESSMENT_GATE` types. | **Source verification** for anything asserting a rule |
| KB-004 | Privacy (KB-D10) and coding (KB-D07) expansion to parity. | **Source verification.** A registered human reviewer must open HHS, 45 CFR 164, and CDC/NCHS ICD-10-CM and record a `ReviewRecord` |
| KB-005+ | Scale toward 3,000 then 10,000 by widening families and slots, not by adding operators. | Nothing, once KB-002's refactor lands |

**The honest ceiling.** Generation is not the constraint on this corpus; review
is. 324 records are written and 0 are approved. Reaching 10,000 records changes
nothing about that ratio unless reviewer capacity is resourced, and a corpus of
10,000 unreviewed candidates is worth less than 500 reviewed ones. That is the
recommendation this analysis ends on.
