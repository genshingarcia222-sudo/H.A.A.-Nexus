# Knowledge Base integration audit

**Date:** 2026-09-20 · **Performed at:** `3f9654c` on `feat/training-question-bank`
**Purpose:** establish what a Knowledge Base content integration would actually
connect to, before any content is consumed.

**Headline finding: there is no canonical Knowledge Base content model.** What
the application calls the Knowledge Base is a terminology search screen. There
is no article type, no provenance, no jurisdiction, no effective period and no
version metadata anywhere in it. An integration cannot be performed against a
canonical path that does not exist, and inventing one is an architecture
decision of the same weight as D11.

---

## 1. What exists today

| Concern | Reality |
|---|---|
| "Knowledge Base" | `apps/desktop/src/routes/KnowledgeBase.tsx` — a search box over terminology |
| Schema | `terminology-engine/schema.ts` → `TerminologyEntrySchema` |
| Repository | `terminology-engine/repository.ts` → `InMemoryTerminologyRepository` (`get` / `list` / `search`) |
| Loader | none of its own — bundled by static import in `apps/desktop/src/content/scenarios.ts`, validated at module load |
| Content | `content/terminology/terminology.json` — a flat array, **4 entries** |
| Tests | `terminology-engine/content-qa.e2e.test.ts` — schema validity, duplicate ids |

`TerminologyEntry` is `{ id, layTerm, clinicalTerm, acceptedAlternatives[],
category, context?, explanation, commonMistakes[] }`.

Architecture Package §17 is consistent with this and says so explicitly:
knowledge articles were *"folded into `training_lessons.category = 'reference'`
in MVP rather than a new table"*, flagged at the time as a scope-minimising
deviation to revisit *"if reference content outgrows the lesson schema"*. That
condition has now arrived.

## 2. The gap, field by field

A sourced Knowledge Base record needs things `TerminologyEntry` has no home for.
Because the schema is **not** strict (`z.object` without `.strict()`), extra
fields would be **silently stripped** — the exact hazard the Question Bank was
built to avoid.

| Needed | `TerminologyEntry` |
|---|---|
| Article identity distinct from a term pair | ✗ — identity is a term mapping |
| Provenance (authority, title, url, locator) | ✗ |
| Jurisdiction | ✗ |
| Effective period (`effectiveFrom` / `effectiveUntil`) | ✗ |
| Release / version metadata | ✗ |
| Content lifecycle and review status | ✗ |
| Human verification record | ✗ |
| Relationship to a Question Bank item | ✗ |
| Duplicate / supersession policy across versions | ✗ (only duplicate-id rejection at registration) |

**The only provenance model in the repository is the Question Bank's**
(`source` as shared-ref or inline citation, plus `codingReference`), and it is
deliberately scoped to questions.

## 3. Assessment access — already correct, nothing to invent

This is the cleanest result of the audit.

`mayAccessReferenceMaterial(session)` in `simulation-engine/session-machine.ts`
returns `false` for an assessment that is not yet `completed`, and `true`
otherwise. `/knowledge-base` and `/training` are both listed in
`REFERENCE_ROUTES`, and `ReferenceGate` blocks direct navigation to them, not
merely the nav links.

Consequence: **any content injected into the Knowledge Base is automatically
closed-book during an active Assessment**, and reopens on submission. This is
owner decision **D4**, already implemented and already tested —
`closedBookBoundary.test.tsx` covers direct navigation, nav-link removal,
tier-independence, the full before/during/after lifecycle, and a source scan
asserting the rule lives in the domain rather than being re-implemented per
route.

So the §6 requirement is satisfied by existing architecture. **No new product
policy is needed and none was invented.** Knowledge Base content does not
become an Assessment answer key, because Assessment cannot reach it while an
attempt is open.

One boundary worth stating: D4 governs a **runtime learner surface**, not the
archive. `content/` remains fully available to authoring and validation tooling,
as `referenceRoutes.ts` already documents.

## 4. Question Bank boundary — unaffected

Question Bank eligibility is untouched by anything in this audit.
`getProductionEligible()` remains the single gate, candidate content remains
unservable, and Pilot Batch 001 remains candidate-only with 0 production-
eligible. A Knowledge Base is a *reference* surface; it does not and must not
become a second path by which unverified content reaches a learner.

If Knowledge Base records are ever derived from Question Bank items, the
relationship must be a reference in one direction only — a KB article may cite a
question's source, but a KB article must never confer eligibility on a question.

## 5. Duplicate and version handling

- **Scenarios** have a content-hash drift gate (`content-hashes.json`, keyed
  `scenarioId@version`). Terminology and lessons do not.
- **Terminology** rejects a duplicate `id` at registration and has a
  duplicate-id content-QA test. There is no supersession concept: a corrected
  entry would have to reuse its id or become a second entry, and nothing records
  which is current.
- A versioned Knowledge Base would need an explicit rule for
  *replaces / superseded-by*, which does not exist anywhere in the repository.

## 6. FY2027 ICD-10-CM effective dates

`effectiveFrom` / `effectiveTo` exist in exactly one place: the Question Bank's
optional `codingReference`, ISO-date validated (`schema.ts:144-145`).

**Nothing reads them.** There is no "active coding release" concept in the
application at all — no code path selects, labels or filters by release.

Therefore the §5 requirement — *verify the application does not falsely label
FY2027 as the active coding release before 2026-10-01* — **holds today, and for
the strongest possible reason: the application makes no claim about which
release is active.** No false labelling is currently possible.

This is a fact about absence, not about correctness. If a Knowledge Base ever
presents a release as current, that logic will have to be written, and it will
need to compare against the real date and the stored effective period rather
than assuming the newest record wins. Pilot 001 already carries the trap: its
FY2027 items are *not* current until 2026-10-01, and item 10 expires 2027-09-30.

## 7. Minimum required integration changes

To integrate sourced Knowledge Base content, in order:

1. **An owner decision on the Knowledge Base content model** — whether reference
   articles are a new canonical type (as the Question Bank is) or an extension
   of terminology. This is the D11-shaped decision, unasked and unanswered.
2. A canonical schema carrying identity, provenance, jurisdiction, effective
   period, version/supersession, lifecycle and verification — `.strict()`, so
   nothing is silently stripped.
3. A validator following the `validateScenario` / `validateQuestionBank`
   convention (hard failures, all errors reported).
4. A repository and a platform-neutral loader plus Node-only discovery, mirroring
   the Question Bank split, since `nexus-core` carries no `node:` imports.
5. A content location scanned by no existing suite — `content/knowledge-base/`
   would parallel `content/question-bank/`.
6. A supersession rule for versioned records.
7. Tests, and a Knowledge Base surface that renders provenance and effective
   period rather than hiding them.

**None of steps 2–7 should begin before step 1.**

## 8. Status

`INTEGRATION BLOCKED — NO CANONICAL KNOWLEDGE BASE CONTENT MODEL`
`CONTENT HANDOFF NOT RECEIVED — NO DEVICE 1 COMMIT SHA`

Both are recorded in `.claude/sync/DEVICE2_TO_DEVICE1.md`. Nothing was consumed,
no placeholder records were created, and no safety gate was altered.
