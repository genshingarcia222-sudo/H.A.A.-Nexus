# Integration gate — what must be resolved before this corpus goes near `main`

Charter section XXXVII: the Knowledgebase branch stays independent until the
PHASES BUILDING process establishes the integration contract. This file records
the state of that contract. **Nothing here is resolved, so nothing is merged.**

This branch is not merged into `main`, and the corpus is not live. No application
file was modified: no loader, no `packages/nexus-core` schema, no entitlement
code, no Assessment logic, nothing under `content/`, nothing in `.nexus/`.

## The gate was assessed on the merged result — 2026-10-14, DEVICE-01

**Verdict: DO NOT MERGE YET. Six of seven criteria pass; criterion 2 fails.**
`docs/KB_INTEGRATION_GATE_PR21.md`, assessed at `main` = `3c496e3` against PR #21
head `8ce93b3`, on a real local merge in a throwaway worktree. Nothing was merged
to `main` and nothing was pushed. The merge decision was reported, not taken.

**This supersedes what the rest of this file used to say.** Every record here, in
the register and in the handoff said PR #21 was blocked on **D18** — and D18 was
discharged on 2026-10-04, so that reason had outlived itself. The gate was re-run
against the repository rather than against the stale note, and it now fails for a
different and better reason.

**Criterion 2 — no open decision is resolved, narrowed or implied — FAILS, and
the mechanism is worth stating exactly.** Merging does not resolve D18 and does
not reopen it. What it does is **narrow O6**. Today the 18 class (c) fields live
on a branch and the migration may carry or drop each one as a forward-looking
choice. Once they are on `main` with `kb-validate.mjs`'s 24 rules live in the
repository — `SAFETY-PRECEDENCE` among them — dropping any of them stops being
"a field we chose not to carry forward" and becomes **"a safety guarantee removed
from `main`"**. The option set is unchanged; the cost and the meaning of one
option change materially. That is what "narrowed" is for.

**The prescribed fix is an ordering, not a change to this corpus:** resolve O5
and O6 → migrate on this lane → integrate the migrated result **as one unit**.
Then `main` receives records in the canonical contract, the retired JSON Schema
arrives labelled as an authoring artifact rather than as live content, and no
safety field is dropped from `main` because none was ever on it unmigrated. O5
and O6 were resolved the same day; the migration is B7.

**What the other six criteria established**, measured rather than asserted: scope
touches no other lane's owned files; the local merge is genuinely **zero-conflict**
so no §10 policy was needed; **90 KB tests pass on the merged result** including
the KB-001 byte-identity regeneration test; `.nexus/` is **byte-identical** in the
merged tree; no application, runtime, Rust, bundler, CI or entitlement code is
added; and the CHANGELOG entry carries its explicit "not verified, and not
claimed" section.

**Two findings worth keeping from someone else's reading of this corpus.** The
record count was re-derived from the files rather than read off the manifest and
**432 is correct** — each committed JSON file is a template *group*, so the 57-file
count is not the record count, which is exactly the sort of discrepancy that gets
propagated. And the `.gitattributes` rule `knowledge-corpus/**/*.json -text` was
called out as right for the reason it was written: the corpus is pinned by
SHA-256, so a line-ending conversion on checkout would report drift for a reason
unrelated to content — the same failure mode that was *discovered* in `Cargo.toml`
during the release build the same day, and here anticipated.

**PR #22 is explicitly outside this gate**, being open against this branch rather
than `main`, and the assessment did not touch it.

---

## The blocker that came before all the others — RESOLVED 2026-10-04

**D18 chose Contract B.** The D12 Zod model in
`packages/nexus-core/src/knowledge-corpus/` is canonical for validation, build,
ingestion, indexing, retrieval, migration, authoring and review. This lane's
`knowledge-corpus/schema/kb-record.schema.json` is the **retired** contract, and
all 432 records are written against it.

Decided by DEVICE-01 under the owner's standing authorization, acting on the
owner's master resolution instruction — **not an owner decision**. The register
entry says so explicitly, and so does this one. Architecture:
`docs/KNOWLEDGE_ARCHITECTURE.md`.

**What the measurement reframed.** Field-name overlap is 11 of 54, and those 11
are the entire governance spine: `id`, `provenance`, `revision`, `reviewStatus`,
`verification`, `contentStatus`, `evidence`, `flags`, `domain`, `rationale`,
`choices`. The two lanes never built rival governance models. They agree on
identity, provenance, lifecycle and review, and disagree only about the content
model — which is why this was a migration question rather than a trust question.

**What this does not do.** The 432 records are **not** migrated; the deliverable
was the field-level map (`docs/KNOWLEDGE_ARCHITECTURE.md` §3), and PR #21 is
still not merged. D18 is a precondition for that work, not a substitute for it.
The open items are now the migration itself and the class (c) per-field
decisions — see `review/OPEN_REVIEW_ITEMS.md` O5 and O6.

### The superseded framing, kept because it explains this branch's shape

**Two implementations of one content contract existed, and the merge of one of
them to `main` did not choose between them.**

- This branch: `knowledge-corpus/schema/kb-record.schema.json` (JSON Schema) plus
  `tools/knowledge-corpus/kb-validate.mjs` (24 policy rules), holding **432**
  records after batch KB-002 (2026-09-27).
- `main`, as of D15's merge `c384ac5` (2026-09-27):
  `packages/nexus-core/src/knowledge-corpus/` (Zod, ~2,700 lines across schema,
  validate, quality, review, eligibility, temporal, conflict, build), holding 42
  candidate items as fixtures. Until that merge it was on
  `feat/training-question-bank` only.

They were deliberately aligned — same lifecycle vocabulary, same provenance
rules, same machine ceiling, same authority classes, same `synthetic: true`
literal, same pinned-reference and computed-temporal principles — but alignment is
not the same as being one system. **Which one survives is an owner decision, and
until it is taken every record in this corpus is written against a schema that may
not be the one ingested.** That is the single largest piece of rework risk here.

D15's merge did not answer it. It put the Zod model on `main`, which makes the
question easier to act on and no closer to decided; DEVICE-01's integration note
on this branch's pull request says the same, and the decision register was updated
to say so explicitly so that a later session cannot read the merge as an answer.
Being able to import the engine is not a reason to: building **432** records
against the wrong contract would multiply the rework rather than remove it. KB-002
added 108 records while this stayed undecided, so the exposure grew rather than
held — which is a reason to take the decision, not a reason to stop generating,
and it is recorded here so the cost is visible.

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
| Training access | **Metadata present** | All 432 records carry `TRAINING` |
| Practice access | **Metadata present** | All 432 records carry `PRACTICE` |
| **Assessment restrictions** | **Deliberately unclaimed** | `ASSESSMENT_CLOSED_BOOK` is on **zero** records and the generator cannot assign it. Whether any of this may appear in closed-book Assessment is an owner decision, not a generator default |
| Premium separation | **Metadata present** | 27 records carry `PREMIUM_REALISTIC`. Entitlement remains the entitlement engine's |
| Generated-variant lineage | **Specified and enforced** | 375 variants carry `variantOf`, `parentId`, `templateId`, `mutationTypes`, `variantLineage`. Lineage must resolve and may not be cyclic |
| Analytics linkage | **Open** | Nothing links a record to an outcome. Correctly so: linkage belongs to the runtime, not the corpus |
| Deprecation | **States exist, unused** | `deprecated` and `superseded` are registered; `supersedes` is a field. No record uses them |
| Rollback | **Partly** | Regeneration is deterministic and the manifest checksums 40 files, so a bad batch can be detected and rebuilt. There is no corpus-level rollback |
| Migration strategy | **Open, and blocked on the schema decision above** | Now a same-branch migration rather than a cross-branch one, which lowers the mechanical cost and changes nothing about the decision |

## Other standing blockers

1. **The declared source archive is absent.** 400 seed records and corpus layer 1
   do not exist here. `source/SOURCE_RECONCILIATION_v1.md`.
2. **Zero records are reviewed.** 432 need content review; 24 need a registered
   reviewer to open a source. `review/OPEN_REVIEW_ITEMS.md`.
3. **The coding-version registry is unverified** and it is load-bearing for every
   coding record the corpus will ever hold.
4. **No reviewer registry exists.** The D12 model on `main` defines `Reviewer` and
   `ReviewRecord` as types; no registered people exist in either lane, so no review
   can be recorded even if someone performed one. Since D15, this is a shared gap
   rather than a per-branch one.

## What would make merging safe

In order: resolve the schema decision (O1 in the review queue); register
reviewers (O2); review and source-verify a first cohort; define the ingestion and
access-enforcement contract; then migrate the reviewed cohort — not the whole
corpus — behind the access boundaries the contract defines.

Merging earlier would put 432 unreviewed machine-drafted healthcare training
records into the path of an application that has no way to tell them apart from
approved content. The access classes in the metadata do not prevent that; only the
ingestion contract can.
