# Integration gate — what must be resolved before this corpus goes near `main`

Charter section XXXVII: the Knowledgebase branch stays independent until the
PHASES BUILDING process establishes the integration contract. This file records
the state of that contract. **Nothing here is resolved, so nothing is merged.**

This branch is not merged into `main`, and the corpus is not live. No application
file was modified: no loader, no `packages/nexus-core` schema, no entitlement
code, no Assessment logic, nothing under `content/`, nothing in `.nexus/`.

## The blocker that comes before all the others

**Two implementations of one content contract exist on two branches that have not
met.**

- This branch: `knowledge-corpus/schema/kb-record.schema.json` (JSON Schema) plus
  `tools/knowledge-corpus/kb-validate.mjs` (24 policy rules), holding 324 records.
- `origin/feat/training-question-bank`: `packages/nexus-core/src/knowledge-corpus/`
  (Zod, ~2,700 lines across schema, validate, quality, review, eligibility,
  temporal, conflict, build), holding 42 candidate items as fixtures.

They were deliberately aligned — same lifecycle vocabulary, same provenance
rules, same machine ceiling, same authority classes, same `synthetic: true`
literal, same pinned-reference and computed-temporal principles — but alignment is
not the same as being one system. **Which one survives is an owner decision, and
until it is taken every record in this corpus is written against a schema that may
not be the one ingested.** That is the single largest piece of rework risk here,
and it is recorded rather than resolved because resolving it would mean editing
another device's live branch.

## The contract questions, and their current state

| Question | State | Note |
| --- | --- | --- |
| Storage model | **Open** | Records are JSON files under `knowledge-corpus/records/`. Whether the runtime reads files, a build artifact, or SQLite is undecided. The D12 branch has a deterministic build (WP5) that this corpus does not feed |
| Ingestion mechanism | **Open** | No loader reads `knowledge-corpus/`. Deliberate |
| Indexing | **Open** | Fingerprints exist for duplicate control, not retrieval |
| Retrieval | **Open** | No selector. A corpus record may never reference a learner, a tier, a pool or a delivery, and none does |
| Versioning | **Partly specified** | `revision` per record; any content change bumps it and resets verification. No corpus-level release version yet |
| Provenance | **Specified and enforced** | `MACHINE_DRAFTED` under `machine:<agent-id>`; machine identities cannot review |
| Source updating | **Open** | `snapshotHash` is in the source registry and is `null` everywhere, because nothing was retrieved. Source-change invalidation cannot run until snapshots exist |
| Access control | **Metadata only** | Every record carries `accessClasses`. Nothing enforces them, and nothing in this corpus grants an entitlement |
| Training access | **Metadata present** | 324 records carry `TRAINING` |
| Practice access | **Metadata present** | 324 records carry `PRACTICE` |
| **Assessment restrictions** | **Deliberately unclaimed** | `ASSESSMENT_CLOSED_BOOK` is on **zero** records and the generator cannot assign it. Whether any of this may appear in closed-book Assessment is an owner decision, not a generator default |
| Premium separation | **Metadata present** | 27 records carry `PREMIUM_REALISTIC`. Entitlement remains the entitlement engine's |
| Generated-variant lineage | **Specified and enforced** | 297 variants carry `variantOf`, `parentId`, `templateId`, `mutationTypes`, `variantLineage`. Lineage must resolve and may not be cyclic |
| Analytics linkage | **Open** | Nothing links a record to an outcome. Correctly so: linkage belongs to the runtime, not the corpus |
| Deprecation | **States exist, unused** | `deprecated` and `superseded` are registered; `supersedes` is a field. No record uses them |
| Rollback | **Partly** | Regeneration is deterministic and the manifest checksums 40 files, so a bad batch can be detected and rebuilt. There is no corpus-level rollback |
| Migration strategy | **Open, and blocked on the schema decision above** | |

## Other standing blockers

1. **The declared source archive is absent.** 400 seed records and corpus layer 1
   do not exist here. `source/SOURCE_RECONCILIATION_v1.md`.
2. **Zero records are reviewed.** 324 need content review; 24 need a registered
   reviewer to open a source. `review/OPEN_REVIEW_ITEMS.md`.
3. **The coding-version registry is unverified** and it is load-bearing for every
   coding record the corpus will ever hold.
4. **No reviewer registry exists** on this branch. The D12 branch has `Reviewer`
   and `ReviewRecord`; this one has no registered people, so no review can be
   recorded even if someone performed one.

## What would make merging safe

In order: resolve the schema decision (O1 in the review queue); register
reviewers (O2); review and source-verify a first cohort; define the ingestion and
access-enforcement contract; then migrate the reviewed cohort — not the whole
corpus — behind the access boundaries the contract defines.

Merging earlier would put 324 unreviewed machine-drafted healthcare training
records into the path of an application that has no way to tell them apart from
approved content. The access classes in the metadata do not prevent that; only the
ingestion contract can.
