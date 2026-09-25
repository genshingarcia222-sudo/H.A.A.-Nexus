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
| `AssessmentItem` | The D11 Training Question, extended with modality and context | WP2 ✔ |
| `Reviewer`, `ReviewRecord` | Who may verify, and the record of each review | WP3 ✔ |
| `ConflictRecord` | A declared or detected conflict between records | WP4 ✔ |

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

## 4a. The assessment item (WP2)

`AssessmentItem` is `TrainingQuestionSchema`'s object plus D12's fields. The
inherited cross-field rules are **applied, not copied**: `schema.ts` exports
`refineTrainingQuestion`, and the item calls it. Removing that call fails three
tests by name, so the two records cannot drift into meaning different things.

- **Seven modalities**, closed and required, orthogonal to `questionType`.
  `questionType` is the cognitive process; modality is the shape of the task.
- **Single best answer only in v1.** Writing a SOAP note stays with the
  documentation evaluator that already grades drafts.
- **Each modality carries its own required structure**: a case context for
  situational, SOAP, error-detection and transformation items; none for direct
  knowledge; a SOAP task; an error domain; comparison criteria; both ends of a
  transformation; and for workflow, at least three steps with a
  `canonicalOrder` that must be a permutation of them — the one place a
  workflow's true order is stored.
- **Three to five choices.** Two is a coin flip; more than five is a reading
  test.
- **Dates may not disagree.** `validUntil`, `applicability` and
  `codingReference` must state the same window, or the item is rejected rather
  than leaving a reader to believe whichever field they happened to read.
- **Jurisdiction is earned.** An item may not claim to apply where none of its
  cited sources speak. A federal source covers a state claim; the reverse never
  holds, and there is no fallback in either direction.

### Quality rules (WP2)

`quality.ts` ports `validate_pilot_batch.py` into three tiers. STRUCTURAL and
POLICY findings are errors; HEURISTIC findings are warnings and are **never**
verification — nothing here reads a source. Production-only rules (every choice
explained, knowledge grounding, applicability, registry-form citation) do not
block an author drafting a candidate.

Ported and extended: answer-length bias, much-shorter answers, duplicate choice
text, all/none-of-the-above options, ICD items without a release, unlisted
code-like tokens, absolute wording with no exception cited, article cues in the
stem, modality/question-type mismatch, per-file answer-position cap
(`ceil(n/4)+1`, the pilot validator's own), duplicate ids and near-duplicate
stems by trigram overlap.

## 4b. The review log (WP3)

The bank already forbade claiming a status above `candidate` without a recorded
human verifier. On its own that rule is honest but unenforceable: a name and a
date typed into a record look exactly like a name and a date earned by reading
the source. WP3 makes the claim checkable.

**Reviewer** is a registered person. A machine identity cannot be registered as
one and cannot record a review — an agent able to do either could approve its
own work. **ReviewRecord** is one review event, append-only, naming the
reviewer, the date, the stage, the decision, the source snapshots the reviewer
opened, and a `target` pinned as `id@revision`.

What the corpus now enforces:

- **The claim must have a review behind it.** A `humanVerifiedBy` /
  `humanVerifiedOn` pair with no approved SOURCE review of that exact revision
  is rejected.
- **The verifier must be the approver.** The names and the dates must match the
  SOURCE approval, and the reviewer must be registered and active.
- **The review must be of this record.** A review targeting another record, or
  an earlier revision, does not satisfy the claim — a reviewer verified words
  that have since changed.
- **Status cannot outrun evidence.** `source-verified` needs SOURCE;
  `content-reviewed` needs SOURCE and CONTENT; `approved` and
  `production-eligible` need all three, each one's *latest* review being an
  approval. `production-eligible` additionally needs `reviewStatus: approved`.
- **Snapshots cannot be invented.** A record may not claim to have been checked
  against a source snapshot the review does not record.
- **Flags and claims may not contradict.** A record still carrying
  `HUMAN-VERIFY-REQUIRED` cannot also claim verification or a status above
  candidate.

Deliberately not decided here: how many reviewers a record needs, who is
qualified to review what, and any approval threshold. Multiple reviews per
stage are allowed and the latest decides, which supports the normal
request-changes-then-approve path without inventing a quorum.

**One honest limit.** Whether a flag or a claim was *removed* cannot be seen
from a single snapshot; that needs history, and Git holds it. What is enforced
here is the stronger property: a claim that is present must be backed.

## 4c. Deliverability (WP4)

Two predicates, kept apart on purpose.

**`isCorpusProductionEligible`** is static: is this record finished, reviewed
and verified? It delegates to the bank's own `isProductionEligible` for items,
then adds what a bank question has no fields for — the review chain, knowledge
grounding, a concept, an applicability, quality errors, and at least one source
whose authority class may stand alone.

**`isDeliverable`** is relative to a date and a request. It reports every
reason a record is held back, not just the first:

- **Temporal state is computed at `asOf`**, never stored, and the window is the
  *intersection* of the record's own dates, its pinned context's and every
  source's. An item resting on next year's guidelines is not this year's
  content, whatever its own dates say. `CURRENT_ONLY` is the default;
  `INCLUDE_FUTURE` is opt-in; an empty window is `IMPOSSIBLE`, never current.
- **Jurisdiction** must match the request, with `UNIVERSAL` answering any.
- **Sources must still be what was reviewed.** A changed `snapshotHash`, or a
  withdrawn or superseded source, stops delivery without altering the record —
  the change is derived, so nothing is rewritten and nothing is lost.
- **Dependencies must hold.** A pinned context and every cited knowledge record
  must themselves be production-eligible and unexpired.
- **An open conflict stops every record it names**, on both sides. The corpus
  never picks a winner between two authoritative-looking claims; a resolution
  must say how and by whom.
- **Superseded content is history**, not inventory.

`upcomingTransitions` reports records changing state within 60 days, so
re-verification can be scheduled before a pool quietly empties.

Nothing here reads the clock: `asOf` is always an input, because a
deterministic build and a reproducible selection both depend on it.

**Not yet enforced here:** membership of a release manifest. The deterministic
build is WP5; until then this answers "may this be delivered", and the release
gate is the other half of "will it be".

## 4d. The deterministic build (WP5)

`buildCorpus` is a **pure function** of the authoring files, sorted by path,
plus the hash function it is handed. No clock, no network, no randomness, no
environment — so the same inputs always produce a byte-identical bundle and the
same `releaseId`. Tests assert exactly that, including across file order and
across build dates.

- **Canonical output**: keys sorted, two-space indent, LF, trailing newline.
  Array order is never touched, because the order of a SOAP note's segments or
  a workflow's canonical steps is content, not formatting.
- **Failure emits nothing.** A corpus that does not validate produces no
  release at all; a partial bundle would look like a release.
- **Files merge, they do not overlay.** Two files defining one id is a
  duplicate-id error, never last-one-wins.
- **Incremental**: each partition carries its own hash, and `diffPartitions`
  names what was added, changed, removed or left alone. Cross-reference
  validation still runs over the whole index, because a reference can break
  when something *else* changes.
- **`detectUnbumpedRevisions`** catches content edited at the same revision —
  the way an approval silently comes to cover words nobody approved.
- **`invalidationReport`** lists records whose sources have moved, been
  withdrawn or been superseded since review. It **derives; it never mutates**:
  no status is rewritten, the record simply stops being deliverable until
  someone reads the new bytes. A candidate nobody had verified is not
  "invalidated" — it was never resting on those bytes.

The release reports, rather than decides: `upcoming` lists state changes due
within 60 days so re-verification can be scheduled before a pool empties.

## 4e. Pilot Batch 001 conversion (WP6)

`pilot-conversion.ts` turns revision 3 into candidate corpus records. It
**reads** r3 and **writes new** records; the batch artifact and both
hash-pinned fixtures are never touched, and the suite asserts r3's hash
before and after.

Two things are inputs rather than inferences, because both are judgements:
**modality** (the D12 rule is that modality is authored, never guessed from
wording) and **authority class** (which class a publisher belongs to is a fact
about the source, not a string match on its id). An item the plan does not
name is not converted, and the omission is reported.

**Text moves verbatim.** A situational stem is split at its final question
sentence: the case becomes a `CaseContext`, the question stays on the item,
and `caseSummary + " " + question` reproduces r3's original exactly. The test
checks all three situational items, including the one whose case contains a
quotation with a full stop inside it.

What conversion produces: 8 sources, 12 items, 3 scenario contexts and one
concept per variant group, whose statement is the batch's own learning
objective, verbatim. r3's prose retrieval note becomes a structured machine
entry whose verifier must begin `machine:`, so it can never pass for a
person's sign-off.

**Q9 stays DIRECT_KNOWLEDGE** although its `questionType` is
workflow-sequencing: WORKFLOW requires discrete steps and a canonical order,
r3 holds neither, and conversion must not invent them. A reviewer may author
them as a new revision.

**Every gate stays shut.** All twelve remain `candidate` / `pending` with null
human-verification fields, and `deliverableItems` returns nothing — today or
at any later date.

**Not done here:** knowledge records. Drafting a proposition from a rationale
is authoring, not conversion, and production eligibility requires them, so
conversion states the gap rather than filling it. The converted records are
also not written into `content/` yet: no loader reads corpus files, and
committing unread content would add unreviewed clinical material to the
repository for no gain.
## 4f. Dynamic delivery (WP7)

`training-engine/delivery.ts` decides which questions a session receives. It
**composes** the existing selector rather than replacing it: the injected
`RandomSource`, Fisher-Yates and the diversity weights are imported and used
unchanged, and the module sits beside `question-selection.ts` so that file
keeps its boundary test — the selector still imports nothing but the question
bank.

**The compatibility rule.** With an empty exposure snapshot, adaptive off and
an open envelope, delivery reproduces the existing selector's run exactly for
the same seed. Asserted over 200 seeds, because every later behaviour is only
safe if this holds.

**Tiers define an envelope, never an inventory.**
`entitlement-engine/training-envelopes.ts` holds frozen data beside
`CAPABILITY_MATRIX`: allowed difficulties, modalities, domains, collections,
session size, whether adaptive is permitted. **Every tier ships open**,
because Training has no gating today and inventing some would answer a
commercial question nobody has asked. A request outside its envelope is
refused, never quietly narrowed.

**The preference order**, lexicographic: never repeat a concept inside a
session; then the learner's own novelty (unseen, stale, recent); then
cross-learner over-exposure; then adaptive distance; then the inherited
diversity cost; then the seeded shuffle. A learner's own novelty outranks
cross-learner balance, because being asked something you just answered is a
worse experience than a concept being slightly over-represented.

**Exposure is per concept, held outside the corpus**, and arrives as a
snapshot the caller computes. An empty snapshot is valid and means "no
history available" — never "nobody has seen this".

**1-in-7 is a ceiling on a share, not a ban.** It applies only where it can be
measured (a shared ledger), where the sample is large enough (50 deliveries)
and where it is achievable (at least seven concepts in the stratum).
Otherwise the engine records `CROSS_USER_NOT_MEASURABLE`,
`INSUFFICIENT_SAMPLE` or `TARGET_INFEASIBLE_POOL_TOO_SMALL` and carries on.
On a single-device install it is never measurable, and the traces say so.

**Every delivery carries a trace**: novelty, the best novelty that was
available, cross-user share, diversity cost, pool size, stratum and reason
codes. When a fresher item existed and was not taken, the trace must say why.
No field claims global uniqueness; "new to you" is the strongest claim the
product can make.

**Adaptive difficulty is off by default**, cannot leave the envelope, and with
no history is inert.
## 4g. The exposure ledger (WP8, first half)

`persistence/delivery-event-repository.ts` records one item delivered to one
learner in one session, with its selection trace, the corpus release, the
policy and envelope versions, and the D5 population. `learnerRef` is
pseudonymous — a name or an email there would be a privacy defect.

**Append-only by contract.** No update, no delete. A duplicate delivery id is
refused rather than accepted, because a silently accepted copy inflates every
exposure count. An answer is recorded once and never overwritten. Correctness
without the choice that produced it, and an answer timestamped before its
delivery, are both rejected.

**The one-way rule holds here too.** An event may name a record; no record may
name an event. Exposure history cannot change what a correct answer is.

`buildExposureSnapshot` reads the ledger so the selector never has to. It
defaults to `LEARNER_ONLY`: one device cannot see other learners. Stratum
counts appear only when a ledger is declared shared, and only counts cross
over — no other learner's reference reaches the snapshot.

**Still to do in WP8:** the desktop SQLite table (migration 004), its IPC
commands and contract fixtures. The web binding waits on D10.

## 6. Where the work stands

| Work package | State |
|---|---|
| WP1 corpus families and references | Complete |
| WP2 assessment items, modalities, quality rules | Complete |
| WP3 review log and anti-fabrication | Complete |
| WP4 deliverability, time, jurisdiction, conflicts | Complete |
| WP5 deterministic build and invalidation | Complete |
| WP6 Pilot 001 conversion | Complete (no knowledge records drafted; nothing written to `content/`) |
| WP7 dynamic delivery, envelopes, exposure policy | Complete |
| WP8 exposure ledger | Contract and in-memory adapter complete; SQLite, IPC and fixtures outstanding |
| WP9 Training integration and browser verification | Not started |

Independent of all of it: **Pilot Batch 001 stands at 0 of 12 human-verified
and 0 production-eligible**, and no learner-facing behaviour has changed.
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
