# Nexus Knowledge Corpus — canonical architecture

**Decision:** D12, resolved 2026-09-21 by the owner-commissioned specification
`NEXUS_D12_KNOWLEDGE_BASE_ARCHITECTURE_AND_IMPLEMENTATION_HANDOFF` v1.0.0.
That document is the implementation authority; this one records what exists in
the repository today and why it is shaped that way.

**Branch:** all Question Bank and D12 work lives on
`feat/training-question-bank`. `main` receives none of it during this track.

---

## 1. What the corpus is

One body of evidence-backed, provenance-aware, versioned records:

| Family | Purpose | Implemented |
|---|---|---|
| `SourceRecord` | An authoritative document at a known edition and snapshot | WP1 |
| `KnowledgeRecord` | One sourced proposition — definition, rule, exception, procedure, classification, version fact | WP1 |
| `CaseContext` | Synthetic situational or SOAP case material, shared by items | WP1 |
| `AssessmentConcept` | What a family of variants tests | WP1 |
| `CompetencyNode` | A node in the Training competency registry | WP1 |
| `AssessmentItem` | The D11 Training Question, extended with modality and context | WP2 |
| `Reviewer`, `ReviewRecord` | Who may verify, and the record of each review | WP3 |
| `ConflictRecord` | A declared or detected conflict between records | WP4 |

Runtime structures — delivery policy, exposure ledger, selection traces — are
**not** corpus families. They live outside it and may reference records; no
record may reference them.

## 2. Three things that are not the same

- **Knowledge Archive** — `docs/`, `CHANGELOG.md`, the decision register.
  Project memory. Never medical content.
- **Knowledge Corpus** — this. Learner-facing reference knowledge and the
  questions built on it.
- **Terminology lookup** — `terminology-engine`, unchanged and not merged in.
  It maps a lay term to a clinical term; a regulation is not a terminology
  entry (D12-49).

## 3. Why the bank is extended, not replaced

D11 decided that a Training question is its own record. D12 keeps every field
of `TrainingQuestionSchema` with its existing name and meaning and adds to it.
The loader, repository, selector, M22 run state machine and the pilot fixtures
keep working unchanged, which is why the existing suite stayed green when the
corpus landed.

The lifecycle, review vocabulary and human verification record are **imported
from `question-bank/schema.ts`**, not restated. There is one definition of
"production-eligible" and one of "a person verified this". A second copy would
be a second trust model.

## 4. Rules the schemas enforce today (WP1)

- **Strict objects.** An unrecognised key is a named error, never a silently
  stripped field — the hazard the lesson schema demonstrated.
- **Evidence resolves.** Every citation names a `SourceRecord` in the corpus.
  A dangling ref is unsourced content wearing a citation.
- **Machine verification cannot impersonate a person.** `verifier` must start
  `machine:`, and nothing in a machine entry moves a record up the ladder.
  Only a human review does (and WP3 adds the cross-check that proves it).
- **Provenance is honest.** Machine-drafted content must record
  `machine:<agent-id>` as its author. Pilot Batch 001 is `MACHINE_DRAFTED`,
  because its own batch document says its first-pass extracts were.
- **Case data is synthetic.** `synthetic: true` is a required literal
  (Architecture §27). A context that cannot say so does not load.
- **Time is computed, never stored.** Records carry effective dates; whether
  one is future, current or expired is derived at a date (WP4). A release does
  not go stale because a calendar day passed.
- **References are pinned.** A context is cited as `id@revision`, so editing a
  context cannot silently change an item a reviewer already approved.
- **Exceptions are records.** A rule with exceptions links to them, so a
  question resting on the rule can never teach the absolute version of it.
- **Ids are opaque after minting.** The domain and level inside an id are hints
  for humans reading a diff; nothing parses them.

## 5. What is deliberately absent

No selector, no tier, no learner, no exposure history, no scoring, and no
Assessment wiring. Assessment remains scenario-based; whether a future
question-based Assessment shares Training's pool is still an open product
decision, and the corpus takes no position on it.

## 6. Verification

`pnpm -r test` · `pnpm -r typecheck` · `pnpm -r build`. WP1 added 51 tests in
`knowledge-corpus/schema.test.ts` and `knowledge-corpus/references.test.ts`,
each rule with its own failing case so that removing a check fails a test by
name.
