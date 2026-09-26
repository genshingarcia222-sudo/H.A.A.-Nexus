# Batch 002 ingestion validation

**Date:** 2026-09-23 · **Branch:** `feat/training-question-bank` at `5bcf9f9`
**Artifact:** `nexus-scribe-batch-002.candidates.json` (`NEXUS-SCRIBE-BATCH-002`, revision 1)
**SHA-256:** `c17014208539db87cce6b26b81071a13d71db4e769664cf64c9d12cd1ca0f7aa` (77,412 bytes, UTF-8, no BOM)

**Status: `CANDIDATE EXTENSION — NOT INTEGRATED`.** This is validation, not
integration. No record was repaired, remapped, promoted or loaded into
`content/question-bank/`. 30 of 30 remain `candidate`/`pending`, and 0 are
production-eligible.

## 1. Integrity

| Check | Result |
|---|---|
| JSON syntax | valid |
| Records | 30 |
| Levels 1–6 | 5 / 5 / 5 / 5 / 5 / 5 |
| `trainingTier` | matches the approved table for all 30 (L6 → Tier 5); `difficultyLevel` keeps L5 and L6 distinct |
| `contentStatus` / `reviewStatus` | 30 `candidate` / 30 `pending` |
| Verification | all 30: `humanVerificationRequired: true`, `humanVerifiedBy`/`On` null, `HUMAN-VERIFY-REQUIRED` |
| Ids | 30 unique; the level hint agrees with `difficultyLevel`; no collision with Pilot 001 r3 |
| Variant groups | 20 groups, 7 reused across levels (intentional); no overlap with Pilot 001 |
| Duplicates | no exact or near-duplicate stems or objectives (token-Jaccard ≥ 0.4 / 0.5) |
| Choices | 4 per item, ids `abcd`, correct id always resolves, every choice has a `why` |
| Sources | 6 defined, every ref resolves, and every item has a locator; `AHDI-MODEL-CURRICULUM` is defined but unused |

## 2. Discrepancies between the authoring report and the JSON

| Report says | JSON says |
|---|---|
| "Six items carry SCRIBE-SCOPE-REVIEW" and lists 8 | **10** records: L3-000001, L3-000005, L5-000001, L5-000002, L5-000004, L6-000001–000005. The list omits **L3-000001**, and names L6-000005 only separately |
| L6-000005 "requires scrutiny" | Its flag is one string containing two flags: `"CLINICAL-REVIEW-NOT-REQUIRED; SCRIBE-SCOPE-REVIEW: …"`. A reader that splits flags by kind sees `CLINICAL-REVIEW-NOT-REQUIRED` and misses the review flag |
| `MULTI-SOURCE-SYNTHESIS-NOT-DIRECTLY-STATED` (treated as a flag) | It is **not a flag on any record**. It is the `verification.locatorConfidence` of **L6-000005 only**. L5-000004 has `REASONED-EXTENSION-OF-SOURCE` in the same field |
| `batchSummary.byQuestionType` | Sums to **33**, not 30. Actual: scenario 9, application 4, next-best-action 4, recognition 3, recall 3, prioritization 3, error-identification 2, interpretation 2 |
| `batchSummary.bySkillArea` | Sums to **36**, omits `Scope of Role / Safety`, and overstates five areas (e.g. Scope of Role 4 vs 2 actual) |
| "8/8/7/7 answer balance" | True, but achieved by a strict `abcd` rotation across all 30 (see §3) |
| "No correct-answer length bias" | No *longest*-answer bias, but an inverse one (see §3) |

## 3. Content validation

**Errors against the current repository schema (hard failures):**

- **E1:** 13 items use a `questionType` outside the closed enum
  (`recognition | recall | interpretation | scenario | workflow-sequencing`):
  `application` ×4 (L2-1, L2-2, L2-3, L2-5), `next-best-action` ×4 (L2-4, L3-2,
  L4-3, L6-4), `prioritization` ×3 (L3-5, L4-4, L6-5), `error-identification`
  ×2 (L3-3, L4-2).
- **E2:** `trainingTier` is an unrecognised key on all 30. The strict schema
  names the key as the error and does not strip it.
- **E3:** The batch envelope (`batchId`, `items`, `revision`, …) is not a
  `QuestionBank`. This matches Pilot 001, which also needed a local adapter.

**Warnings (need a human; not repaired):**

- **W1: predictable key position.** The key sequence is
  `abcdabcd…ab`. The selector shuffles *which* questions appear, but nothing
  shuffles *choices*, so position follows authoring order.
- **W2: inverse length bias.** The correct choice is never the longest (0/30)
  and is uniquely the shortest in 7 (L1-4, L1-5, L2-5, L4-1, L5-1, L5-3, L6-5).
  Mean length is 62.3 chars for the correct choice and 66.3 for the others.
  "Never pick the longest" removes one distractor in every item.
- **W3: L5-000005 contradicts its own rationale.** The LO asks for "the full
  set", and the rationale lists six elements (including *understandable*). The
  keyed answer lists five.
- **W4: L6-000004's key is narrower than its rationale.** The key says IRB/Privacy
  Board approval is required. The rationale also allows researcher
  representations. The item is also framed as a scribe performing a bulk export.
- **W5: L6-000005's objective can't be met by multiple choice.** Its LO says "citing the applicable authority for each",
  which an MCQ cannot assess. It declares `CLINICAL-REVIEW-NOT-REQUIRED` on a
  patient-safety risk ranking. It draws on two sources, but only one
  (`TJC-NPSG-01`) is structured: the schema allows one source per question, so
  `TJC-SCRIBE-FAQ` survives only in flag prose.
- **W6: source currency.** `TJC-NPSG-01` is the January 2025 edition and
  `TJC-SCRIBE-FAQ` was last reviewed 2022-11-17. A reviewer should confirm
  neither was superseded before 2026 use. `AHDI-SCRIBE-JOBDESC`'s URL slug is
  `/medial-scribe/`; confirm it rather than "correct" it.
- **W7: no source carries `jurisdiction`.** All are U.S. bodies, but none says so. This was not inferred.
- **W8: stem echo.** L4-000003's key repeats the stem phrase "new medication
  order".
- **W9: id shape.** `NEXUS-SCRIBE-L<n>-<nnnnnn>` puts the domain before the
  level, whereas Pilot 001 uses `NEXUS-L<n>-<DOMAIN>-<nnnnnn>`. The committed
  bank does not constrain ids, so this is a convention gap, not an error.

**Blocked records:** none by authoring. Under the current schema, the 13 in E1
cannot load.
**Human-review records:** all 30 (`HUMAN-VERIFY-REQUIRED`). Priority:
the 10 `SCRIBE-SCOPE-REVIEW` items, plus L5-000005 (W3).

## 4. D12 competency mapping — PROPOSED, not canonical

**Name collision:** "D12" means three different things:

1. **Owner decision D12** in `DECISION_REGISTER.md`: where reference
   knowledge lives.
2. **The D12 matrix** in *Nexus Knowledgebase Archive v1.0* (2026-09-22): a
   twelve-competency taxonomy, D01–D12.
3. Separately, the module registry's 12 section domains (A2).

The repository contains **no D01–D12 registry**. `CompetencyNode` exists, but no
nodes are defined and its external mappings wait on **A2**, which is open.
The mapping below therefore uses the archive's matrix as a proposal. It is not
wired into code, and it does not create a competency hierarchy.

Matrix: D01 Patient identity · D02 Clinical intent · D03 Safety/escalation ·
D04 Chart extraction · D05 SOAP/documentation · D06 Orders/referrals/fax ·
D07 ICD-10-CM · D08 Med/lab/imaging · D09 Insurance/admin · D10 HIPAA/privacy/
security · D11 Communication/closed-loop · D12 Contradiction/audit/error control.

| Item | Lvl | Type | Skill area | Primary (secondary) | Confidence |
|---|---|---|---|---|---|
| L1-000001 | 1 | recognition | Scribe Role & Responsibilities | D05 | **unclear** (no role axis) |
| L1-000002 | 1 | recognition | Documentation Accuracy | D05 (D12) | high |
| L1-000003 | 1 | recall | Documentation Assistance Competency | D10 | **unclear** (tests a training requirement) |
| L1-000004 | 1 | recall | Patient Safety / EHR Workflow | D01 | high |
| L1-000005 | 1 | recognition | Scope of Role | D05 (D12) | medium |
| L2-000001 | 2 | application* | EHR Navigation & Login | D10 (D12) | medium |
| L2-000002 | 2 | application* | Patient Identification | D01 | high |
| L2-000003 | 2 | application* | HIPAA in EHR Workflow | D10 | high |
| L2-000004 | 2 | next-best-action* | Order-Entry Boundaries | D06 | high |
| L2-000005 | 2 | application* | Documentation Quality | D05 (D12) | high |
| L3-000001 | 3 | scenario | Documentation Judgment | D05 (D11) | medium |
| L3-000002 | 3 | next-best-action* | Provider Review | D05 (D12) | medium |
| L3-000003 | 3 | error-identification* | Order-Entry Boundaries | D06 (D12) | high |
| L3-000004 | 3 | scenario | EHR Navigation & Login | D10 (D12) | medium |
| L3-000005 | 3 | prioritization* | Time-Pressure Prioritization | D11 (D05) | **unclear** |
| L4-000001 | 4 | scenario | Complex Encounter Documentation | D05 (D04) | high |
| L4-000002 | 4 | error-identification* | Documentation QA / Compliance | D12 (D10) | high |
| L4-000003 | 4 | next-best-action* | Order-Entry Boundaries | D06 (D11) | high |
| L4-000004 | 4 | prioritization* | Time-Pressure Accuracy | D05 (D12) | medium |
| L4-000005 | 4 | scenario | Scope of Role | D11 (D02) | **unclear** (no role axis) |
| L5-000001 | 5 | scenario | Integrated Compliance Judgment | D06 + D10 | **unclear** (two axes, no primary) |
| L5-000002 | 5 | interpretation | Systemic QA / Compliance | D12 | **unclear** (organisational, not learner) |
| L5-000003 | 5 | scenario | Patient Identification / Escalation | D01 (D12, D03) | high |
| L5-000004 | 5 | scenario | Peer Workflow / Login | D10 (D12) | medium |
| L5-000005 | 5 | recall | Documentation Quality Assessment | D05 (D12) | high (content defect W3) |
| L6-000001 | 6 | scenario | Integrated Compliance Judgment | D06 + D10 | **unclear** (two axes) |
| L6-000002 | 6 | interpretation | Systemic QA / Compliance | D12 | **unclear** (organisational) |
| L6-000003 | 6 | scenario | Scope of Role / Safety | D05 (D03) | medium |
| L6-000004 | 6 | next-best-action* | HIPAA in EHR Workflow | D10 | high |
| L6-000005 | 6 | prioritization* | Integrated Risk Judgment | D03 (D01, D06, D10, D12) | **unclear** |

\* not in the repository's `questionType` enum (E1). All 30: domain
`Medical Scribe`, provenance = batch source ref + locator, review
`candidate`/`pending`.

**Coverage by primary:** D05 10 · D10 6 · D06 5 · D01 3 · D12 3 · D11 2 · D03 1.
**Zero:** D02, D04, D07, D08, D09. **Unclear: 9 of 30.** The batch's own theme,
*scribe role and scope boundaries*, has no axis in the matrix. That is a
taxonomy gap, not a defect in any one item.

## 5. Provenance

The artifact is pinned byte-for-byte by SHA-256. Each item keeps its `source.ref`
and `locator`, and every source keeps `authority`, `title`, `url` and
`dateOrVersion` exactly as authored. `verification.locatorConfidence` is kept as
a distinct value, so it is never collapsed into a "verified" flag. The batch's
`sourceVerificationMethod` (sources came from model-generated extracts, and
nothing is source-verified) survives only in the pinned bytes. The batch-level fields (`sourceVerificationMethod`,
`excludedCoverage`, `difficultyModel`) have **no home** in `QuestionBankSchema`.
An adapter would drop them, which is why this remains a pinned artifact and not
a loaded bank.

## 6. Capability classification

| Capability | Class |
|---|---|
| Pin + hash + structural verification of the artifact | **A** — done (test) |
| `id` → `questionId` | **B** — same as the Pilot adapter |
| `trainingTier` | **B** — derivable from `difficultyLevel` by the approved table (asserted for all 30); dropping it is lossless only while that holds |
| Loading the 17 enum-compatible items with 0 production-eligible | **A** — verified through the real loader |
| 13 items with new question types | **D** — the enum is closed by design; adding values is a taxonomy decision, and remapping them would silently repair content |
| Batch-level provenance fields | **D** — belongs to the D12 corpus `Provenance` model (WP2+), currently uncommitted work in progress |
| More than one structured source per question (L6-000005) | **E** |
| D01–D12 competency tagging | **D** — no registry; blocked on A2 and on the matrix being adopted |
| Choice-order shuffling (W1) | **D** — a product/runtime behaviour change |
| Production eligibility | **not applicable** — human gate |

## 7. Version status

Batch 002 is a **candidate extension**. It has not been incorporated into any
later knowledgebase version, and no "v1.1" exists. *Knowledgebase Archive v1.0*
was not modified. Only its PDF rendering is on this machine (SHA-256
`ed3bcd26…653f75`). The `.zip`, the `.jsonl`, and *Master Training Content
Archive v1.0.md* were **not found**, so the controlling content specification
could not be checked directly.
