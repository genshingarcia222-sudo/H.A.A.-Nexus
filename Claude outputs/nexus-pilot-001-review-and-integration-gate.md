# Pilot Batch 001 (revision 2): review worksheet and Claude Code integration gate

Status: 12 candidates, `candidate` / `pending`, 0 production-eligible. Difficulty (repository 6-level scale) and ICD lead (U.S. ICD-10-CM) settled by the owner on 2026-09-19. Training entitlement and schema shape remain BLOCKED and are not decided here.

## A. What changed in revision 2

- Answer-length bias fixed. Revision 1 actually had the correct choice as the longest option in 8 of 12 items (my earlier report said 6; that was wrong). Revision 2: 0 of 12. Correct-choice position is now 3 each of a, b, c, d.
- Locator correction: the "unspecified" guideline is Section I.A.9.b, not I.B.18.
- Item 4 now rests on 45 CFR 164.502(b)(2)(i). The marketing distractor was removed because a marketing disclosure made under an authorization could arguably be exempt.
- Item 1 no longer asserts the "including demographic data" detail, which was not re-extracted.
- Two known weak spots remain: item 2 and item 4 have the correct choice as the shortest or near-shortest option. It is a mild cue, not the strong one the length bias was.

## B. Human verification worksheet

Important: every quotation below came from a fetch tool that returns a model-generated extract of the page, not raw page text. Two extracts agreeing raises confidence but is not verification. A person must open the document and tick each row. Record name and date in `verification.humanVerifiedBy` and `humanVerifiedOn`.

| Item | Open this | Confirm |
|---|---|---|
| 1 | HHS Privacy Rule summary, heading "What Information is Protected" | Sentence: the Rule protects all "individually identifiable health information" held or transmitted by a covered entity or its business associate. Also confirm the summary names this information "protected health information (PHI)" (naming sentence NOT re-extracted). |
| 2 | Same page, heading "Who is Covered by the Privacy Rule" | Covered: health plans, health care clearinghouses, and providers that transmit health information electronically in connection with standard transactions. |
| 3 | HHS FAQ (treatment without authorization) + summary heading "Permitted Uses and Disclosures" | FAQ answer says Yes for treatment without authorization; treatment definition includes consultation and referral. Regulation basis 45 CFR 164.506. |
| 4 | eCFR 45 CFR 164.502(b)(2) | Exception (i): disclosures to or requests by a health care provider for treatment. Record the eCFR as-of date. |
| 5 | HHS summary, "Permitted Uses and Disclosures" | Treatment definition (provision, coordination, or management ... including consultation and referral). Confirm payment and health care operations are described as separate categories with the examples used in the distractors (premium/coverage; quality assessment; audits/legal). |
| 6 | HHS Business Associates page | Definition (functions on behalf of a covered entity involving creating, receiving, maintaining, or transmitting PHI) and the satisfactory-assurances-by-written-arrangement requirement. Only ONE extract so far. Confirm that storing records fits "maintaining PHI." |
| 7 | CDC/NCHS ICD-10-CM page | NCHS responsible for the U.S. clinical modification; WHO owns ICD-10; CMS develops ICD-10-PCS. Only ONE extract so far, and that extract mentioned FY2024 resources on the page, so also check the page for stale text. |
| 8 | FY27 Official Guidelines, Section I.A.1 | Index and Tabular List sentence. |
| 9 | FY27 Guidelines, Section I.B.1 | Index-then-Tabular sentence and the "essential to use both" sentence (the second was in the first extract only). |
| 10 | FY27 Guidelines title page | Effective period October 1, 2026 to September 30, 2027. Item expires 2027-09-30. |
| 11 | FY27 Guidelines, Section I.A.9.b | The "unspecified" sentence. The "should be reported when they most accurately reflect what is known" sentence came from the first extract only. |
| 12 | FY27 Guidelines, Sections I.A.19 and I.B.14 | I.A.19 sentence on the provider's diagnostic statement; I.B.14 heading and its exception list (extract listed: BMI, depth of non-pressure chronic ulcers, pressure ulcer stage, coma scale, NIHSS, SDOH, laterality, blood alcohol level, underimmunization status, firearm injury intent). Confirm the list, and that no exception could make a nurse's "seems like diabetes" note a valid basis for a diagnosis code. |

Additional reviewer judgment calls (not source lookups):
- Item 3 and item 6 are legal-style items. Confirm each has exactly one defensible answer.
- Item 11 distractor "provider documented no diagnosis at all" must not be defensible.
- Item 12: no next action (query or escalate) is taught, deliberately. A scribe-scope source (AHDI or Joint Commission) has not been retrieved.
- Item 10 is date-bound. Retire or refresh it after 2027-09-30.
- FY27 takes effect 2026-10-01. Today (2026-09-19) FY26 is still the code set in force; ICD items citing FY27 are not "current" until that date, and section numbers can move between fiscal years.

## C. Claude Code integration gate (technical only)

The following are requirements for Claude Code. None of them decides a product question.

1. Do NOT place the batch file in `content/lessons/`. The lesson content-QA test reads every `.json` there and validates it as a `TrainingLesson`, which these records are not. Do NOT place it in `content/incoming/` either; that folder's intake suite treats drafts as scenarios. Choose a folder outside every scanned path, or add a dedicated loader with its own test.
2. The batch fields have no counterpart in the current repository schema: stable item id, choice ids (the current schema uses `correctOptionIndex`), per-choice explanations, rationale, source, difficulty level, question type, learning objective, variant group, status, expiry. Decide how the repository carries them. Whether this is a separate question bank or an extension of `knowledgeChecks` is an owner-level product shape decision; do not resolve it silently.
3. Keep candidate items out of any runtime selector until they are approved. Nothing in this batch may reach a learner. The current Training screen reads lessons only, so this holds by default; keep it that way.
4. Reuse `validate_pilot_batch.py` as the starting point for a repository validator: it enforces candidate/pending status, four unique choice ids, a valid correct choice, a defined source, ICD items carrying a `codingReference`, no undeclared code-like tokens, expiry, no correct-is-longest, and balanced correct positions. It does not check medical truth or source accuracy.
5. When a repository validator exists, port these rules and add: reject any item whose status is above `candidate` without a recorded human verification; flag item ids that collide with existing ids.
6. The repository's entitlement mapping for Training content does not exist. The validator must not invent one. Item `difficultyLevel` is an authoring proposal only.
7. Feedback UI (selected green or red fill, correct answer green, rationale, per-choice explanation) needs its own verification; the current rendering is border and background styling whose colors were not checked.

## D. Gates that remain closed

Source gate: no item SOURCE-VERIFIED. Medical-truth gate: privacy items rest on HHS/OCR and the eCFR; ICD items on CDC/NCHS; none human-checked. ICD gate: no specific codes; FY27 not yet in force. Scribe-scope gate: no AHDI or Joint Commission material used. Production gate: 0 of 12 eligible.

## E. Next finishable step

A person completes section B. If every row passes, set `humanVerifiedBy` and `humanVerifiedOn`, move eligible items to `SOURCE-VERIFIED` per the lifecycle, and hand the file to Claude Code for section C. No new content until then.
