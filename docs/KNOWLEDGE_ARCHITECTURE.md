# H.A.A. Nexus — Knowledge Architecture

**The authoritative boundary between the three knowledge layers, and the answer to
D18.** Written 2026-10-04 by DEVICE-01 under the owner's master resolution
instruction, at control version `P9-2026-10-02-001`.

**Decision status: CLAUDE-RECOMMENDED AND IMPLEMENTED UNDER STANDING
AUTHORIZATION.** The owner did not personally select the canonical contract. It
was selected from measured repository evidence and from decisions the owner *did*
take (D11, D12, D15). An owner decision overrules any of it.

---

## 1. Three layers, and why they must not collapse into one

| Layer | Holds | Canonical location | Must never be |
|---|---|---|---|
| **Knowledge Archive** | project memory and governance: decisions, control plane, ledger, changelog, phase artifacts, device/session state, development evidence | `docs/`, `.nexus/`, `CHANGELOG.md` | learner-facing content, or reachable from any learner retrieval path |
| **Knowledge Corpus** | canonical learner-facing reference and structured clinical/educational knowledge | `packages/nexus-core/src/knowledge-corpus/` (**the contract**) + the records it ingests | a terminology table, or a dumping ground for project documents |
| **Terminology Lookup** | fast lexical mapping between learner language and clinical terminology | `content/terminology/` + the terminology repository | the source of truth for regulations, coding, or any versioned authority |

**A regulation is not a terminology entry. An ICD-10-CM code is not a terminology
entry. A project decision is not a Knowledge Corpus item.** The three layers carry
different authority models, different lifecycles and different audiences, and the
only reason they look similar is that all three are "text with an id".

### The boundary that matters most

Nothing in the Knowledge Archive may be retrievable by a learner. That is not a
styling preference: `docs/DECISION_REGISTER.md` records what the product cannot
yet do, `.nexus/` records device state, and both would be actively misleading to a
learner and useless as clinical reference. The boundary is currently held by the
fact that **no loader reads either corpus** — which is a true statement today and
not a safeguard. The safeguard is named in §6.

---

## 2. D18 — the canonical content contract

### The measurement (O1), which is evidence and not a decision

`tools/knowledge-corpus/kb-schema-divergence.mjs` on
`origin/feat/knowledgebase-expansion`, run 2026-10-04 at `96ab675`:

| | Contract A — authoring | Contract B — runtime |
|---|---|---|
| Location | `knowledge-corpus/schema/kb-record.schema.json` (+ 24 policy rules in `kb-validate.mjs`) | `packages/nexus-core/src/knowledge-corpus/`, `packages/nexus-core/src/question-bank/` |
| On `main`? | **no** — PR #21, unmerged | **yes**, since D15's merge `c384ac5` |
| Shape | one flat record type discriminated by `recordType` | four typed families (KNOWLEDGE / ITEM / CONTEXT / CONCEPT), 33 `strict()` Zod schemas |
| Fields | 54 declared, 23 required | 54 across the family union |
| Records | **432** (KB-001 324 + KB-002 108), 0 approved | 42 candidate fixtures, 0 human-verified |

**Field-name overlap: 11 of 54.** 43 A-keys have no same-named home in B, and 43
B-fields no record supplies.

**The 11 that do overlap are the whole of the governance spine:** `id`,
`provenance`, `revision`, `reviewStatus`, `verification`, `contentStatus`,
`evidence`, `flags`, `domain`, `rationale`, `choices`.

That single fact reframes the decision. The two teams did not build two rival
governance models — they agree on identity, provenance, lifecycle, review and
verification, exactly as both authors claimed. **What they disagree about is the
content model**, and only that.

### The decision

**Contract B — the D12 Zod model in `packages/nexus-core/src/knowledge-corpus`
— is the canonical runtime-ingestion contract.** It is the single source for
validation, build, ingestion, indexing, retrieval, migration, authoring targets,
content review, question relationships, coding references, and the corpus half of
Phase 10.

**Contract A is retired as a contract.** Its schema file stops being a definition
of what a record *is*.

### Why B, from evidence rather than preference

1. **D12 is an owner decision and B is its implementation.** D12 resolved that
   non-terminology reference knowledge lives in the Nexus Knowledge Corpus.
   Choosing A would overturn D12; choosing B operationalises it. A session may not
   overturn an owner decision under standing authorization.
2. **Only B has a runtime.** DEVICE-02's own `knowledge-corpus/INTEGRATION_BLOCKERS.md`
   records, for its own corpus: storage model **open**, ingestion mechanism
   **open** ("No loader reads `knowledge-corpus/`. Deliberate"), indexing **open**
   ("Fingerprints exist for duplicate control, not retrieval"), retrieval **open**
   ("No selector"). B carries `build.ts`, `eligibility.ts`, `temporal.ts`,
   `conflict.ts`, `references.ts` and `pilot-conversion.ts`. A contract with no
   ingestion path cannot be the ingestion contract.
3. **B is on `main`; A is on an unmerged branch.** The authority order puts
   verified `main` above a feature branch.
4. **B already models the thing the next phase needs.** `codingReference` exists
   in B with `effectiveFrom`/`effectiveTo` cross-validated against
   `applicability` (`item.ts:229-243`). A has only `codingVersion`, a flat string.
   The versioned, provenance-bearing coding reference that ICD-10-CM requires (§5)
   is already B's shape and is absent from A's.
5. **Typed families are the thing that makes the boundary enforceable.** B
   rejects unknown keys (`strict()`), so a record that does not belong cannot
   drift in. A flat 54-field record discriminated by a string cannot express that
   an ITEM may not carry CONTEXT fields.

### What this decision explicitly does not do

- **It does not discard the 432 records.** Their content is the product of real
  authoring work; §3 is the map for moving it.
- **It does not discard A's tooling.** `kb-privacy-scan`, duplicate detection via
  fingerprints, `kb-manifest`, `kb-scorecard` and the 24 policy rules are *gates*,
  not contracts. Gates are retargeted at B-shaped records; that is additive and
  loses nothing.
- **It does not create a third contract, an adapter or a bridge.** The migration
  is one-directional and terminal: records are rewritten into B and A's schema
  stops being consulted. Nothing translates at runtime.
- **It does not merge PR #21.** The integration gate stays shut until the
  migration in §3 is executed and validated. D18 being answered is a precondition
  for that work, not a substitute for it.

---

## 3. The A → B migration map

The 43 A-keys with no same-named home in B, classified. **This classification is
the deliverable; the migration itself is NOT done.** Classes (a) and (b) are
mechanical once written; class (c) needs a per-field decision; class (d) must not
enter the runtime contract at all.

### (a) Rename — same concept, different name

| A | B | Note |
|---|---|---|
| `recordType` | `family` + `kind` | A's one discriminator becomes B's two-level one |
| `prompt` | `question` (ITEM) / `statement` (KNOWLEDGE) | the split is by family |
| `difficulty` | `difficultyLevel` | B also has `difficultyIntent`, which A has no source for |
| `competencyIds`, `sourceCompetencyIds` | `competencyRefs` | two A fields, one B field — the distinction must be preserved in lineage or deliberately dropped |
| `createdAt`, `updatedAt` | — | B does not carry them; they belong to the authoring record, not the knowledge record |
| `scenarioType` | `encounterType` / `setting` | CONTEXT family |
| `taskType` | `modality` / `modalityDetail` / `responseFormat` | one A field, three B fields |

### (b) Structural lift — flat value becomes a nested object

| A | B | Note |
|---|---|---|
| `effectiveFrom`, `effectiveTo` | `applicability.effectiveFrom/.effectiveTo` | B cross-validates these against `codingReference`; A cannot |
| `codingVersion` | `codingReference{system, code, version, source, effectiveFrom, effectiveTo}` | **an upgrade, not a rename.** A flat version string cannot carry the provenance §5 requires |
| `variantOf`, `parentId`, `templateId`, `mutationTypes`, `variantLineage` | `variantGroup`, `supersedes`, `exceptionOf` | 5 → 3. **375 of the 432 records carry variant lineage**, so this is the highest-volume lift and the one most likely to lose information |
| `correctChoiceIds` (array) | `correctChoiceId` (singular) | **a real semantic difference, not a rename.** 318 records use the array form. Whether multi-select items exist, and what B does with them, is an open question this map surfaces rather than answers |

### (c) Semantic gap — B has no equivalent and a decision is required per field

These are policy and safety fields A enforces and B does not model. Each must
either extend B's schema or be consciously dropped. **None may be silently lost.**

`jurisdictions` · `accessClasses` · `privacyFlags` · `safetyFlags` ·
`clinicianJudgmentRequired` · `escalationRequired` · `payerSpecific` ·
`evidenceBasis` · `hardFailureConditions` · `goldBehavior` ·
`acceptanceCriteria` · `errorTargets` · `remediationTargets` · `trapTypes` ·
`expectedOutput` · `steps` · `encounterDate` · `moduleIds`

Three of these are load-bearing for decisions already taken:

- **`accessClasses`** is how a record would ever be marked
  `ASSESSMENT_CLOSED_BOOK`. It is on **zero** records today and the generator
  cannot assign it. **Dispositioned 2026-10-04 (see §6.2): it is not migrated and
  not modelled**, because D4 blocks surfaces rather than records and nothing
  requires a subset rule. Dropping it from the migration is therefore a decision,
  not an oversight — and it is the one class-(c) field deliberately left behind.
- **`jurisdictions`** and **`effectiveFrom/To`** are what make a coding or
  regulatory statement safe to show. §5 depends on them.
- **`clinicianJudgmentRequired`** and **`escalationRequired`** are safety
  metadata. Dropping them silently would be the worst outcome in this document.

### (d) Authoring-pipeline metadata — must NOT enter the runtime contract

`batchId` · `packet` · `canonicalOrder` · `auditTags` · `fingerprints` ·
`ownerRole` · `nextActionOwner`

These describe how a record was produced and who owes work on it. They belong to
the authoring system and to the Knowledge Archive, not to learner-facing
knowledge. `fingerprints` in particular exists for duplicate control during
generation; it is not retrieval metadata and must not become any.

### The 43 B-fields no record supplies

The mirror of the same gap. Most are fields the authoring pipeline never had a
source for — `learningObjective`, `skillArea`, `topic`, `title`, `caseSummary`,
`sections`, `actors`, `seededDefects`, `targetSegmentIds`, `machineVerification`,
`synthetic`, `source`, `knowledgeRefs`, `collections`. **`synthetic` and `source`
are the two that cannot be left unset:** every migrated record is machine-drafted
and must carry `synthetic: true` and its source identity, or the corpus claims an
authority it does not have.

---

## 4. D11 and D12 after this decision

**D11 — the Training Question Bank — is unchanged and remains correct.** Questions
stay independently addressable and reusable in
`packages/nexus-core/src/question-bank/`. The question bank is **not** made a
child of the corpus and the corpus is not made a child of it: they are joined by
reference (`questionId`, `knowledgeRefs`, `competencyRefs`, `codingReference`),
which is what B's family model already expresses. D11 was not re-litigated here.

**D12 — the Knowledge Corpus — becomes operational rather than merely decided.**
What D18 adds is that there is now exactly one implementation of it. What is still
*not* operational, and is not claimed to be:

| D12 capability | State |
|---|---|
| schema, ids, validate, quality, review, eligibility, temporal, conflict, build | present in B, tested |
| records ingested | **none.** B holds 42 candidate fixtures; the 432 authored records are not migrated |
| retrieval / indexing | **not implemented** |
| human verification | **0 of 42 verified, 0 of 432 approved** |

---

## 5. ICD-10-CM as a versioned coding reference

**Authoritative source: the official CMS ICD-10 files.** Third-party coding sites
are discovery aids and never authority. CMS identifies the **FY 2027** ICD-10-CM
files as effective for encounters from **2026-10-01 through 2027-09-30**, which is
the current period as of this document.

The shape, which B already admits through `codingReference`:

```text
KnowledgeRecord ─ codingReference ─ system      ICD-10-CM   (never merged with ICD-10-PCS)
                                  ├ code
                                  ├ version     fiscal year
                                  ├ source      CMS release identity + locator + checksum
                                  └ effectiveFrom / effectiveTo
Question        ─ codingReference[] · terminologyReference[] · knowledgeRefs[]
TerminologyEntry ─ may point at a codingReference; may never own one
```

**Two descriptions, never confused:** the **official CMS code description**, which
is quoted and never altered, and the **Nexus learner explanation**, which is
derived, labelled as derived, and traceable to the official text. Where a code
cannot be paraphrased without clinical interpretation, the official description
stands alone and nothing is invented.

**ICD-10-CM and ICD-10-PCS are separate code systems** and are not merged into one
ambiguous "ICD-10 code" entity. PCS is out of the current learner scope and is
recorded as a separately extensible namespace.

**Status: NOT IMPLEMENTED.** The CMS landing page is reachable from this device
(HTTP 200, verified 2026-10-04); no file has been retrieved, no checksum recorded,
no manifest produced. §I's ingestion requirements are specified and unbuilt.

---

## 6. The enforcement this architecture still lacks

Honest statement of what is *not* protected today, so that no later session reads
this document as a guarantee:

1. **No loader reads either corpus**, so the Archive/Corpus boundary is currently
   held by absence rather than by a check. When a loader is written, it needs a
   source-classification gate so that `docs/` and `.nexus/` can never be a
   retrieval source.
2. **`accessClasses` has no home in B — and the gap is narrower than §3 first
   recorded.** Determined 2026-10-04; the earlier statement here was too strong
   and is corrected below.

   **B already has the seam.** `eligibility.ts` keeps two predicates
   deliberately apart: `isProductionEligible` is static ("is this record
   finished and verified?") and `isDeliverable(record, DeliveryRequest)` is
   relative to a request, where `DeliveryRequest` already carries `asOf`,
   `jurisdictions` and `temporalMode`. What it has no notion of is the *mode the
   request comes from* — whether a learner is mid-Assessment. That, not "B has
   no access model", is the actual gap.

   **D4 as decided does not need a record-level expression.** D4 blocks
   *surfaces*: Knowledge Base off, Training off, direct route access blocked,
   no tier exception. It contains no concept of some records being
   assessment-safe and others not. A Knowledge Corpus browser therefore ships
   under D4 the same way `/knowledge-base` already does — as a gated route
   behind `ReferenceGate`, with the source-scanning invariant catching any
   component that reads corpus content outside one. **The previous claim that a
   browser "must not be built before the record-level expression exists" was
   wrong**, and would have blocked §L behind work nothing requires.

   **What `accessClasses` would actually be for** is a question nobody has
   asked: *may a subset of corpus content be shown during an Assessment?* That
   is a new product decision — it would narrow D4 — and DEVICE-02 reached the
   same conclusion independently, recording `ASSESSMENT_CLOSED_BOOK` as
   "deliberately unclaimed ... an owner decision, not a generator default", with
   the class on zero of its 432 records.

   **Disposition: no schema change, and no new decision entry opened.** Building
   an access-class model now would be the speculative access-control schema this
   work is explicitly forbidden to invent, for a requirement that does not exist.
   If the subset question is ever asked, the answer belongs on `DeliveryRequest`
   as a mode dimension plus a matching record field — and it reopens D4, which is
   an owner decision.
3. **The 432 records are still written against a retired contract.** They are not
   wrong, they are not lost, and they are not yet migrated.
