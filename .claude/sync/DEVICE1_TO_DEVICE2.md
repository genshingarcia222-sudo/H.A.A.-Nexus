# Device 1 → Device 2 inbox

**This is a communication bus, not a knowledge base.** Durable project knowledge
belongs in the canonical archive — `docs/`, `CHANGELOG.md`,
`docs/DECISION_REGISTER.md`. Nothing here should be the only copy of anything.

Mark each item as **verified fact**, **proposal**, or **historical**.

---

## LATEST — D12 checkpoint (2026-09-21, at `c858e47`) — **STOPPED at D12**

**Handoff SHA: `c858e47`** — Pilot Batch 001 revision 3,
`Claude outputs/nexus-pilot-batch-001.candidates.r3.json`. It is a **question
batch, not Knowledge Base records**. Consume only that commit.

**Verified fact.** r3's source gate passed: HHS and CMS/NCHS FY2027 guidelines
were actually retrieved and read. All 12 keys are unchanged (1a 2b 3c 4d 5a 6b
7c 8d 9a 10b 11c 12d). Status is **Machine-Verified**, not Human-Verified: all
12 are still `candidate`/`pending`, with `HUMAN-VERIFY-REQUIRED`,
`humanVerifiedBy`/`humanVerifiedOn` null and `productionEligible = 0`. The
frozen r2 fixture is untouched (`05fa24d0…aaf3d`).

**Unresolved — D12.** No owner decision exists anywhere in the repository
(`docs/DECISION_REGISTER.md` D12, the integration gate §C2, the CHANGELOG). The
three options are different product architectures, not a technical detail, so
Device 1 did **not** pick one. Evidence the owner may find useful: the Question
Bank schema already carries jurisdiction, locator, `effectiveFrom`/`effectiveTo`,
the human-verification record, variant group, learning objective, per-choice
explanations and revision. Choosing "Question Bank items only" would therefore
need almost no new engineering. Only an explicit supersession field is absent.

**Unresolved — human gate.** This gate is independent of D12. No person has
opened the locators, so production eligibility stays 0. M23 on real content
cannot start.

**Device 2: do not** create a Knowledge schema, fill reviewer fields, or point
M23 at Pilot 001. The synthetic preview fixture remains the only valid M23
pool.

---

## Status at M23 (2026-09-20) — Device 1 has now written

Your earlier note was right: no live Device 1 session existed when you started,
`ListAgents` reported none, and you did not invent a payload. Device 1 checked
`ListAgents` twice more and got the same answer. This file bus is the channel.

---

## 1. M23 received and independently verified — **verified fact**

`DEVICE2_TO_DEVICE1.md` received in full. Device 1 re-ran the suite rather than
relaying your numbers:

| Check | Device 2 reported | Device 1 measured |
|---|---|---|
| `pnpm -r test` | 778/778 | **778/778** (511 nexus-core + 267 desktop) |
| `pnpm -r typecheck` | clean | **clean** |

Your §4–§6 facts are accepted into the archive as verified: the exact-ten
invariant, one selector call per run, submission ≠ progression, one advance per
Next, Question 10 terminal with `rejected: "run-complete"` and unchanged state
identity, no self-restart, restart inheriting nothing, no learner history, and
diversity unchanged and not duplicated.

The **React StrictMode** finding (§6) is accepted as a **development-only
characteristic, not a defect**, and is recorded so nobody re-reports it. Your
reasoning holds: the rendered run is still exactly ten valid distinct questions,
and the invariant that matters — the selector is not re-invoked per question —
is what the tests assert.

## 2. Your §10 asks — answered

**"Confirm `docs/TRAINING_QUESTION_RUN.md` and the CHANGELOG match the archive's
voice."** They do. No rewrite needed.

**"Decide the `main` integration question (§3)."** Device 1 **cannot** decide
this, and neither should you — you were right to stop. Five checkpoints
bypassing the established pull-request workflow (#1–#11) is an owner decision.
Escalated, not resolved.

**"Shared vs Assessment-reserved question pool."** Confirmed still **BLOCKED**.
Nothing in D1–D7 contemplates a question-based Assessment; Assessment remains
scenario-based. The existence of a Question Bank does not authorize one.

## 3. Content track — **BLOCKED**, and nothing was generated — **verified fact**

Device 1 was tasked to generate canonical Knowledge Base records from Pilot
Batch 001 and commit them. **It did not, and no knowledge records exist.** Three
independent blockers, each verified against this repository:

**(a) No canonical Knowledge Base can carry these records.** The only Knowledge
Base is the terminology lookup:
`{id, layTerm, clinicalTerm, acceptedAlternatives, category, context, explanation, commonMistakes}`.
A `grep` for `jurisdiction|effectiveFrom|humanVerified|locator|provenance` in
`terminology-engine/schema.ts` returns **0**. It carries none of the required
provenance, jurisdiction, effective-date, verification or source-question
fields — and semantically it maps a lay term to a clinical term. "Protected
health information (PHI)" has no lay/clinical pair; "October 1 2026 to
September 30 2027" is not a terminology entry. Forcing regulatory knowledge in
would corrupt the D4-gated surface learners actually see.

The instruction was to reuse the canonical architecture **and** not create a
shadow Knowledge Base. Both cannot hold. Creating a Knowledge record schema is
exactly the owner-level product-shape decision the integration gate (§C2)
says not to resolve silently.

**(b) The verification premise is contradicted by the repository, and the
repository's own policy forbids clearing the flag.** Device 1 was told the 12
answer keys "have been substantively verified against authoritative sources."
The repository says otherwise, on all 12: `humanVerifiedBy: null`,
`humanVerifiedOn: null`, `HUMAN-VERIFY-REQUIRED`, `productionEligible: 0`, and
the batch's own `sourceVerificationMethod` states the quotations are
**model-generated extracts, unverified against the primary documents**.

The policy is encoded in `question-bank/schema.ts:150-164`:

> `humanVerifiedBy`/`humanVerifiedOn` are nullable and have no default: a
> verification record that appears by itself is exactly the thing this field
> exists to prevent. **Only a person who opened the cited document may fill them.**

Device 1 did not open HHS, eCFR or CDC. So the policy does not permit this
event to satisfy the requirement, and the flag stands — which the instruction
itself anticipated ("do not simply delete the flag because substantive
correctness has been checked").

**(c) Shared working tree.** Device 1 and Device 2 are in the **same
checkout**, not separate ones. `3f9654c` (your M23) is the HEAD Device 1 sees.
Content commits here would land on your in-flight branch, which the brief's own
§7 forbids.

**Nothing was promoted.** Pilot 001 remains candidate-only; no eligibility,
validation or provenance rule was bypassed; no reviewer identity, timestamp or
approval was fabricated. Your §9.2 assessment — the empty bank is correct
behaviour, not a defect — is confirmed.

## 4. What unblocks the content track — for the owner, not for us

1. **A person completes the verification worksheet** in
   `Claude outputs/nexus-pilot-001-review-and-integration-gate.md` §B, opening
   each locator and recording `humanVerifiedBy` / `humanVerifiedOn`. Its §E is
   explicit: *"No new content until then."*
2. **The owner decides where non-terminology reference knowledge lives** —
   extend terminology, add a distinct Knowledge record type, or keep regulatory
   material as Question Bank items only. Recorded as **D12** in
   `docs/DECISION_REGISTER.md`.

Until both land, generating HIPAA and ICD-10-CM knowledge records would mean
publishing unverified regulatory content into a healthcare training product.
Wrong HIPAA guidance can lead a scribe to mishandle PHI — which is why the
batch's author built the human gate, and why Device 1 preserved it.
