# Existing corpus audit

**Date: 2026-09-26. Measured, not remembered.**

The charter's Phase C asks for an audit of the existing corpus before any
expansion. The archive it expected to audit is absent
(`source/SOURCE_RECONCILIATION_v1.md`). This is the audit of what the repository
actually holds, established by reading the files and counting them.

## 1. There is already a Knowledgebase architecture, and it is not on `main`

Charter section XXVIII: *"If the repository already has a Knowledgebase
structure: USE THE EXISTING STRUCTURE. Do not create a competing parallel
system."* It does, and the structure is substantial. It lives on
`origin/feat/training-question-bank`, not on `main`:

| Path (on `feat/training-question-bank`) | Lines | What it is |
| --- | ---: | --- |
| `packages/nexus-core/src/knowledge-corpus/schema.ts` | 524 | Record families: `SourceRecord`, `KnowledgeRecord`, `CaseContext`, `AssessmentConcept`, `CompetencyNode` |
| `packages/nexus-core/src/knowledge-corpus/validate.ts` | 505 | Reference integrity and cross-record rules |
| `packages/nexus-core/src/knowledge-corpus/eligibility.ts` | 249 | `isCorpusProductionEligible` / `isDeliverable` |
| `packages/nexus-core/src/knowledge-corpus/quality.ts` | 241 | STRUCTURAL / POLICY / HEURISTIC tiers, ported from `validate_pilot_batch.py` |
| `packages/nexus-core/src/knowledge-corpus/review.ts` | 285 | `Reviewer`, `ReviewRecord`, the human-verification cross-check |
| `packages/nexus-core/src/knowledge-corpus/build.ts` | 363 | Deterministic release build |
| `packages/nexus-core/src/knowledge-corpus/temporal.ts` | 127 | Temporal state computed at a date, never stored |
| `packages/nexus-core/src/knowledge-corpus/conflict.ts` | 125 | `ConflictRecord` |
| `packages/nexus-core/src/knowledge-corpus/ids.ts` | 58 | Id minting |
| `docs/KNOWLEDGE_CORPUS.md` | 373 | The architecture record for owner decision **D12** |
| `docs/KNOWLEDGE_BASE_INTEGRATION_AUDIT.md` | 156 | Integration audit |

That branch is another workstream's (owner decision D12, resolved 2026-09-21).
Charter section XXXVI forbids modifying it. Charter section I.8 requires this
branch to be based directly on canonical `main`. Both were obeyed: this branch is
based on `main` at `6c92a30` and nothing on that branch was touched.

**The consequence is a real architectural constraint, not a detail.** The engine
that will eventually validate and deliver corpus records is not present on this
branch, so this workstream could not import it. What it did instead is described
in §4.

## 2. The machine-readable corpus that exists: 42 candidate items, 0 approved

| Artifact | Location | Items | State |
| --- | --- | ---: | --- |
| Pilot Batch 001 r2 | `Claude outputs/nexus-pilot-batch-001.candidates.r2.json` (on `main`) | 12 | `candidate`, 0 production-eligible |
| Pilot Batch 001 r3 | `packages/nexus-core/src/question-bank/__fixtures__/` (on `feat/training-question-bank`) | 12 | `candidate`, held as a **test fixture**, not content |
| Scribe Batch 002 | `packages/nexus-core/src/question-bank/__fixtures__/` (on `feat/training-question-bank`) | 30 | `candidate`, `HUMAN-VERIFY-REQUIRED` |
| **Total distinct** | | **42** | **0 approved, 0 source-verified** |

Batch 001's own header states the position exactly: *"Pages were retrieved with a
fetch tool that returns a model-generated extract, not raw text. Quotations and
section numbers are therefore UNVERIFIED against the primary documents. No item
is marked SOURCE-VERIFIED."*

`content/question-bank/` on `main` is empty on purpose, and its README says why:
the schema and validator exist, no content has been promoted, and Pilot Batch 001
is deliberately excluded because promotion is a human gate standing at 0 of 12.

### Measured imbalance in the existing 42

- **Difficulty:** batch 001 covers levels 1–3 only (4 / 6 / 2). Levels 4–6 absent.
- **Domain:** batch 001 is 6 privacy and 6 ICD concept items. Batch 002 is 30
  scribe-role and documentation items.
- **Task shape:** every one of the 42 is a four-option single-best-answer
  question. There is no sequencing, no chart extraction, no SOAP
  transformation, no error hunt, no contradiction detection, no handoff, no audit
  reconstruction, and no multi-stage scenario anywhere in the existing corpus.
- **Evaluation:** every item is graded by a single correct option id. There is no
  partial credit, no acceptance criteria, no hard-failure condition, and no
  packet-grounded rubric.
- **Sources:** 13 distinct refs across both batches, all transcribed, none
  verified.

That last pair of findings is the most consequential: **the existing corpus is a
question bank, and the charter's objective (section V) is explicitly that the
Knowledgebase must not become one.**

## 3. Sources

`sources/source-registry.json` was built by transcribing the source tables of the
two existing batch artifacts — 13 refs, each carrying the verification status its
own artifact records, each carrying `carriedFrom` naming the artifact it came
from. Two classifications were corrected during transcription: the Joint
Commission entries were reclassified from `SECONDARY` to `PROFESSIONAL_BODY`,
with the note that an accrediting body's standards are not federal regulation.

`retrievedInThisWorkstream: 0`. `humanVerified: 0`. Nothing was fetched.

## 4. What this workstream built, and why it is not a competing system

Because the D12 engine is on another branch, this workstream built the **content
and tooling layer** on `main`, deliberately shaped so that it aligns rather than
competes:

- **Naming and vocabulary are borrowed, not reinvented.** `contentStatus`,
  `reviewStatus`, `provenance.generationMethod`, `authoredBy: machine:<agent-id>`,
  `evidence[].ref/locator/supports`, `applicability`, `synthetic: true`,
  `snapshotHash`, `revision`, the 50-word excerpt cap and the authority classes
  all follow the D12 schema's names and meanings.
- **The same invariants are enforced**, in a second implementation: closed
  objects, resolving citations, machine verification that cannot impersonate a
  person, honest provenance, synthetic case data, computed rather than stored
  temporal state, and pinned references.
- **Nothing is imported and nothing is exported.** `tools/knowledge-corpus/`
  depends on no repository package. It reads and writes only under
  `knowledge-corpus/`.
- **No application file was touched.** No loader, no schema in
  `packages/nexus-core`, no entitlement code, no Assessment logic, nothing under
  `content/`, and nothing in `.nexus/`.

This is duplication, and it is the honest kind: two implementations of one
contract on two branches that are not yet allowed to meet. The integration gate
(`INTEGRATION_BLOCKERS.md`) records what has to be resolved before they do, and
the first item on it is which of the two schemas survives.

## 5. What was not audited

- The 400 seed records — absent.
- The archive PDF and Markdown — absent.
- Any external source — none was opened.
- The Rust and desktop layers — out of scope for a content workstream.
