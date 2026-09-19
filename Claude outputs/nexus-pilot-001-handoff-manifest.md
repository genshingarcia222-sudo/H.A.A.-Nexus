# Pilot Batch 001: integration-gate handoff manifest

Baseline: Revision 2, frozen for this gate. 12 items, all `CANDIDATE` / `SOURCE-VERIFICATION-PENDING`, 0 PRODUCTION-ELIGIBLE. Prepared 2026-09-19.

## 1. Canonical artifacts (identify by hash before use)

| Role | File | SHA-256 |
|---|---|---|
| Canonical candidate file | `nexus-pilot-batch-001.candidates.r2.json` | 05fa24d093b0f4139cf56490fe573ac480e8ad2bf15ae67978d8efd0dd5aaf3d |
| Structural validator (authoring-side) | `validate_pilot_batch.py` | 470674c92a8f7b1cd1df36920645aa230d7cf9677cb7590466ad956ad4bc9f23 |
| Review worksheet and integration notes | `nexus-pilot-001-review-and-integration-gate.md` | 77255d1ff3e3a683f99d7dc9834c08f2454bba457d08f80e6cc4a63991011099 |
| This manifest | `nexus-pilot-001-handoff-manifest.md` | (not self-hashed) |

`nexus-pilot-batch-001.candidates.json` (revision 1) is superseded. It is kept only as history and must not be ingested: it has the answer-length bias, the wrong "unspecified" locator, and the item-4 marketing distractor.

If the candidate file's hash differs from the value above, stop and ask; a changed file is a new revision.

## 2. Frozen baseline (must not regress)

- 12 items; statuses unchanged (candidate / pending); `productionEligible` = 0.
- Correct-choice positions: a=3, b=3, c=3, d=3. Do not reorder choices to "fix" anything.
- ICD "unspecified" reference: Section I.A.9.b (item 11).
- Item 4 regulatory basis: 45 CFR 164.502(b)(2)(i), with the older HHS page as secondary.
- ICD policy: U.S. ICD-10-CM leads; no specific ICD codes appear in any item; FY27 guidelines take effect 2026-10-01 (FY26 in force until then).
- Difficulty: repository 6-level scale, Levels 1 to 3 only, as authoring proposals with no entitlement meaning.
- Validator result on r2: PASS (structure and bias only). This is not approval.

## 3. Current gate status

| Gate | State |
|---|---|
| Structural (authoring-side validator) | PASS |
| Repository schema validation | NOT RUN (Claude Code, next engineering gate) |
| Technical compatibility report | NOT PRODUCED |
| Source locator human verification | NOT DONE for any item |
| Content approval / revision | NOT DONE |
| Medical-truth, source, ICD, scribe-scope gates | OPEN |
| Production eligibility | 0 of 12 |

A passing validator does not promote anything. Promotion needs both gates: engineering (schema plus compatibility report) and human (locator verification, then approval or revision).

## 4. Issues, separated

### Content review issues (human reviewers; Claude Code does not resolve these)
- C1. Locator verification, all 12 items. Worksheet section B. Items 6 and 7 rest on a single extract; items 1, 9 and 11 carry sentences seen in only one extract.
- C2. Pedagogical review of the remaining short-answer-length cues in items 2 (correct choice 27 characters vs 33/48/48) and 4 (52 vs 69/87/88). Reported only. No rewrite or new content has been made.
- C3. Single-defensible-answer check on the legal-style items 3 and 6, and on item 11's distractor about a provider documenting no diagnosis.
- C4. Item 10 is date-bound and expires 2027-09-30.
- C5. FY27 versus FY26: ICD items cite FY27, which is not in force until 2026-10-01.
- C6. Scribe-scope: no AHDI or Joint Commission material was used; item 12 deliberately teaches no next action.
- C7. HHS minimum-necessary page (2013) is a secondary source only.

### Engineering issues (Claude Code)
- E1. Run the candidate JSON through the repository's real schema validation. The current `TrainingLesson.knowledgeChecks` cannot carry: stable item id, choice ids, per-choice explanations, rationale, source, difficulty level, question type, learning objective, variant group, status, expiry, codingReference, verification block.
- E2. File placement: not in `content/lessons/` (its content-QA test validates every JSON there as a lesson) and not in `content/incoming/` (scenario intake). Use a location outside every scanned path, or a dedicated loader with its own test.
- E3. Nothing from this batch may reach a runtime selector or learner surface while items are candidates. Confirm the Training UI still reads lessons only.
- E4. Produce a technical compatibility report: for each pilot field, whether the current repository can represent it, needs a schema change, or has no home. State facts and options; do not choose.
- E5. Port the validator's rules into repository tooling only after the schema question is decided by the owner; until then the authoring-side script is the reference.
- E6. Feedback UI (green/red fills, correct-answer highlight, rationale, per-choice explanations) is unimplemented or unverified. Separate engineering work, not part of this gate.

## 5. Exact handoff requirements for Claude Code

1. Verify the SHA-256 of the candidate file and the validator before reading them.
2. Read the candidate file as data only. Do not edit it, reorder choices, change statuses, or set any `verification` field.
3. Run `python3 validate_pilot_batch.py nexus-pilot-batch-001.candidates.r2.json` and record the result; expected PASS with `correct_is_longest=0`.
4. Compare the candidate fields against the repository's actual training schema and produce the technical compatibility report described in E4. Keep it fact-only.
5. Do not create a schema, migration, loader, question bank or UI change unless the owner has resolved the schema architecture. If a proposal is useful, label it PROPOSAL and keep it out of the working tree.
6. Do not map any item or difficulty level to a subscription tier or capability.
7. Do not import the batch into any directory scanned by existing content tests (E2).
8. Report anything the batch or the repository contradicts as REPOSITORY / SPEC MISMATCH — REVIEW REQUIRED.
9. Return the compatibility report; do not change item content. Content changes go back through the human gate.

## 6. Human gate (before approval)

Locator verification per worksheet section B, then a decision per item: approve as source-verified, revise, or reject. Only verification recorded against an actually opened authoritative document may set `humanVerifiedBy` and `humanVerifiedOn`. Revisions produce a new revision file and a new hash; they do not overwrite r2.

## 7. Unresolved product decisions (preserved, not decided here)

- Training schema architecture: separate question bank or extension of lesson knowledge checks.
- Training entitlement mapping. No capability governs Training content today.
- Registry domain alignment (A2), Assessment tier (D1), web persistence (D10), recommendations and competency (A7), thin content inventory (A12).
- Whether Training progress and seen-item history are stored, and where (depends on D10).

## 8. Session checkpoint

```text
SESSION CHECKPOINT
HEAD / Origin: NOT OBSERVED (no git access this session)
Clean/dirty: repository untouched by me
Completed checkpoint: pilot r2 frozen; handoff manifest prepared
Tests / Build: not run (Python validator only)
CHANGELOG: not touched
Open product decisions: Section 7
Open technical blockers: E1 to E6
Training status: lessons only; owner requirements unimplemented
Content status: 12 candidates, SOURCE-VERIFICATION-PENDING, 0 eligible
UI status: unverified
Next finishable branch: Claude Code compatibility report (engineering);
  human locator verification (content)
```
