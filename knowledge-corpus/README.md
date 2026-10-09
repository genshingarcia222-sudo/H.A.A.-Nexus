# H.A.A. Nexus Knowledgebase corpus

Healthcare training content, developed independently of the application until an
integration contract exists. **Nothing here is live, and nothing here is
approved.**

| | |
| --- | ---: |
| Records | 432 — KB-001 324, KB-002 108 |
| Approved | **0** |
| Source-verified | **0** |
| QA | PASS — 0 errors, 0 warnings, corpus-wide |
| Privacy scan | CLEAR — 0 findings |
| Tests | 71 passing (52 QA, 19 privacy) |
| Branch | `feat/knowledgebase-expansion` |

## Read these first

| File | What it tells you |
| --- | --- |
| `KB_BUILD_STATE.md` | The recovery point. Current state, blockers, next action |
| `source/SOURCE_RECONCILIATION_v1.md` | Why the declared v1.0 archive is not here, and what follows from that |
| `EXISTING_CORPUS_AUDIT.md` | What the repository already held, measured |
| `GAP_ANALYSIS.md` | What each batch closed and what it did not, with the cost of what remains |
| `batches/KB-002/spec.md` | The most recent batch: what it did, and what it deliberately did not |
| `review/OPEN_REVIEW_ITEMS.md` | The review queue, and the owner decisions blocking it |
| `INTEGRATION_BLOCKERS.md` | Why this is not merged |
| `KB_HISTORY.md` | Append-only history |

## Layout

```
registries/   the taxonomies: modules, competencies, difficulty, task types,
              errors, remediations, record types, lifecycle, access classes,
              coding editions, mutation dimensions
schema/       kb-record.schema.json — the published content contract
sources/      source-registry.json — 13 refs, all unverified, each naming the
              repository artifact it was transcribed from
records/      generated records, one file per template family, by batch
batches/      per-batch specification and target distribution
qa/           machine-readable QA report and the rendered scorecard
manifests/    corpus-manifest.json — counts, coverage, checksums, limitations
review/       the review queue
source/       source reconciliation; the archive itself belongs here when supplied
variants/ checkpoints/ archive/ modules/ competencies/   reserved by the charter's
              structure; unused so far
```

Tooling lives in `tools/knowledge-corpus/`, following the repository's convention
for `tools/`. It has no dependencies and imports nothing from
`packages/nexus-core`.

## Commands

```bash
node tools/knowledge-corpus/kb-generate.mjs --batch KB-002    # deterministic
node tools/knowledge-corpus/kb-validate.mjs                     # QA, whole corpus
node tools/knowledge-corpus/kb-validate.mjs  --batch KB-002     # QA, one batch
node tools/knowledge-corpus/kb-privacy-scan.mjs                 # PHI/secret scan
node tools/knowledge-corpus/kb-scorecard.mjs --batch KB-002     # rendered scorecard
node tools/knowledge-corpus/kb-manifest.mjs                     # rebuild manifest
node tools/knowledge-corpus/kb-manifest.mjs --check              # detect drift
node tools/knowledge-corpus/kb-validate.test.mjs                # 52 tests
node tools/knowledge-corpus/kb-privacy-scan.test.mjs            # 19 tests
```

**Run the validator without `--batch` before promoting anything.** Duplicate
detection is corpus-wide, so a per-batch run cannot see one batch cloning another —
which is a bug that existed and was fixed in KB-002.

Or via the workspace: `pnpm kb:validate`, `pnpm kb:manifest:check`.

## The four rules that shape everything here

**1. A record says what it rests on.** `SELF_CONTAINED` means the gold behaviour
follows from the synthetic packet carried inside the record — nothing about the
world is asserted, and the acceptance criteria point at packet lines.
`EXTERNAL_AUTHORITY` means it asserts something about the world, so it cites the
source registry and cannot rise above `candidate_needs_source_verification` until
a registered person opens the source. 300 records are the first kind; 24 are the
second.

**2. A machine cannot promote its own work.** Everything here is
`MACHINE_DRAFTED` under `machine:claude-code-kb-workstream`. The lifecycle
registry marks `human_reviewed` and above as not machine-reachable and the
validator enforces it: a machine-authored record cannot carry those states, cannot
fill `verification.humanVerifiedBy`, and cannot carry `reviewStatus: approved`.

**3. All patient data is synthetic.** `packet.synthetic` is a required literal
`true`. Every person, practice, payer and identifier is invented. Where a scenario
states a payer or practice rule, it states it as a given of that scenario — tagged
`SYNTHETIC-GIVEN-POLICY` — never as a claim about how any real organisation
behaves.

**4. A variant changes the answer, not the wording.** 375 of the 432 records are
counterfactual variants of 57 families. Each mutation rewrites the evidence so the
defensible behaviour changes, and the option that was correct in the base case is
carried in as an explained distractor. A paraphrase is not a variant, and rule
`NOV-SUPERFICIAL` rejects one.

## What this corpus is not

- Not a question bank. `taskType: MCQ` is 19 of 432 (4.4%), and the validator caps
  MCQ at 30% of any batch. All 27 task types are represented.
- Not live. No loader reads this directory. No application file was changed.
- Not entitled. `accessClasses` is metadata; entitlement stays with the entitlement
  engine, and `ASSESSMENT_CLOSED_BOOK` is on zero records because the generator
  cannot assign it.
- Not verified. Not approved. Not production-ready. See `KB_BUILD_STATE.md`.
