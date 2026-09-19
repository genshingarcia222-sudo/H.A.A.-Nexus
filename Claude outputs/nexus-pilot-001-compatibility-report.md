# PILOT 001 COMPATIBILITY REPORT

Date: 2026-09-19. Scope: read-only engineering compatibility gate. No repository file was changed, and no candidate was placed, imported or exposed. Repository evidence is the local checkout (`D:\HAA\H.A.A.-Nexus`) as read this session; git HEAD and origin were NOT observed (no shell on the device), so it is unconfirmed that the checkout equals GitHub head.

## 1. Candidate integrity

| Artifact | Manifest hash | Observed hash | Match |
|---|---|---|---|
| `nexus-pilot-batch-001.candidates.r2.json` | 05fa24d0…aaf3d | 05fa24d093b0f4139cf56490fe573ac480e8ad2bf15ae67978d8efd0dd5aaf3d | YES (session copy and project copy) |
| `validate_pilot_batch.py` | 470674c9…9f23 | 470674c92a8f7b1cd1df36920645aa230d7cf9677cb7590466ad956ad4bc9f23 | YES |
| review worksheet | 77255d1f…1099 | 77255d1ff3e3a683f99d7dc9834c08f2454bba457d08f80e6cc4a63991011099 | YES |
| manifest | not self-hashed | e6667d6a…be664 (session copy and staged project-upload copy identical) | n/a |

Revision 1 (`nexus-pilot-batch-001.candidates.json`, hash 6f5c17b4…4e06) differs from r2, is declared superseded in the manifest, and was not used. No hard stop.

## 2. Repository schema observed

Training model: a lesson-based unit, one JSON file per lesson. `packages/nexus-core/src/training-engine/schema.ts` (zod ^3.23.8), `repository.ts` (in-memory, rejects duplicate lesson id).

TrainingLesson, required: `id`, `title`, `category`, `version`, `explanation` (all non-empty strings). Optional with default `[]`: `examples[]`, `knowledgeChecks[]`, `linkedScenarioIds[]`.
KnowledgeCheck (element of `knowledgeChecks`), required: `question` (non-empty), `options` (array of non-empty strings, min 2), `correctOptionIndex` (integer, min 0). No optional fields.

Observed behavior (read-only probe with zod 3.23.8 on a hand-transcription of the schema; scratch only, not in the repo):
- Unknown keys on a check are silently stripped, not rejected.
- `correctOptionIndex` is not bounds-checked against `options` (index 9 with 2 options passes).
- Duplicate option text passes.

Other conventions: content is bundled by static JSON `import` in `apps/desktop/src/content/scenarios.ts` (3 lessons, 2 scenarios, 1 terminology file) and validated with `validate*()` at module load (throws on failure). Content-QA tests read directories (section 5). A content-hash drift gate exists for scenarios only. Difficulty exists for scenarios only: `difficulty: 1|2|3|4|5|6` (`scenario-engine/types.ts`), labels in `scenario-engine/difficulty.ts`, capability `maxScenarioDifficulty` (`entitlement-engine/capability-matrix.ts`). Training has no difficulty, rationale, source, id-per-check or status field.

## 3. Compatibility matrix

Dry run (read-only): batch container validated as TrainingLesson fails (id, title, category, version, explanation missing); item validated as TrainingLesson fails (title, category, version, explanation missing); item validated as KnowledgeCheck fails (options, correctOptionIndex missing).

| Pilot field | Status | Evidence / note |
|---|---|---|
| items[].question | DIRECTLY COMPATIBLE | `KnowledgeCheckSchema.question` |
| items[].choices[].text | COMPATIBLE WITH TRANSFORMATION | objects to `options: string[]`; min 2 satisfied |
| items[].correctChoiceId | COMPATIBLE WITH TRANSFORMATION | string id to numeric `correctOptionIndex`; order-dependent, so the balanced order must be preserved by any mapping |
| items[].choices[].id | NOT REPRESENTABLE | options have no ids; position only |
| items[].choices[].why | NOT REPRESENTABLE | no per-option explanation field |
| items[].rationale | NOT REPRESENTABLE | no rationale field anywhere in training-engine |
| items[].id | UNKNOWN / REQUIRES PRODUCT OR SCHEMA DECISION | ids exist at lesson level only (slugs such as `hpi-fundamentals`); checks have none. Pilot ids also embed the level (`L1`). |
| items[].difficultyLevel | UNKNOWN / REQUIRES PRODUCT OR SCHEMA DECISION | the 1 to 6 scale exists for scenarios; Training has no field for it |
| items[].domain, skillArea | UNKNOWN / REQUIRES PRODUCT OR SCHEMA DECISION | only free-string `TrainingLesson.category`; whether it maps to either is a taxonomy decision |
| items[].questionType, learningObjective, variantGroup | NOT REPRESENTABLE | no field |
| items[].source, top-level `sources` | NOT REPRESENTABLE | no provenance support in Training; scenario `sourceFact` has a different meaning |
| items[].codingReference | NOT REPRESENTABLE | no ICD or coding structure anywhere in the repository |
| items[].contentStatus, reviewStatus, flags, verification, validUntil | NOT REPRESENTABLE | no lifecycle or status concept for lessons; scenarios use folder plus hash gate |
| top-level batch container (`batchId`, `revision`, `items[]`, notes, `blockedTopics`, `batchSummary`) | NOT REPRESENTABLE | repository unit is one lesson per file, statically imported |

## 4. Missing / unsupported structures

- Required repository fields with no pilot counterpart: `title`, `category`, `version`, `explanation` (lesson level).
- Pilot fields absent from the repository model: choice ids, per-choice explanations, rationale, source and provenance, difficulty on Training content, question type, learning objective, variant group, coding reference, lifecycle and review status, expiry, verification record, batch container.
- Datatype mismatches: correct answer is a string id vs a numeric index; choices are objects vs strings; `revision` is an integer vs lesson `version` string; `difficultyLevel` has no target.
- Identifier mismatch: per-item ids do not fit the lesson-id slug convention, and checks have no ids.
- Structural mismatch: batch file with many items vs one-lesson-per-file.
- Silent-loss hazard: passing pilot fields through the current schema would succeed and discard every extra field without error.
- No selector, no run concept, no seen-item store, no Training persistence, no tier or capability governing Training content.

## 5. Candidate placement safety

Confirmed unsafe:
- `content/lessons/`: `training-engine/content-qa.e2e.test.ts` reads every `.json` there and validates each as a TrainingLesson; the candidate would fail. Also the bundling list in `scenarios.ts` is explicit, so a stray file is not loaded, but the test fails first.
- `content/incoming/`: `scenario-engine/scenario-intake.test.ts` validates every non-underscore `.json` there with `validateScenario`; the candidate would fail.

Also scanned (additional unsafe locations found):
- `content/scenarios/**`: `tools/preflight/preflight.mjs` `scenarioFiles()` recurses under `content/scenarios` and parses every `.json`; `content-qa.e2e.test.ts` (scenario) reads all `.json` in `content/scenarios/live-scribing`.

Not scanned by anything I inspected: a new sibling directory under `content/` (for example `content/candidates/`), or a location outside `content/`. `content/terminology/` is read as a single named file, but it is semantically wrong. This is a factual observation, not a placement decision; nothing was created or moved. Limit: no whole-repo search was possible, only the staged and grepped files, so an unstaged test or script reading such a path is not excluded.

## 6. Learner-surface exposure assessment

Discovery is by explicit static `import` in `apps/desktop/src/content/scenarios.ts`; there is no glob or directory-scan loader in the desktop app. `vite.config.ts`, `vitest.config.ts` and `package.json` have no content-scanning entries. `tauri.conf.json` has no `resources` entry in `bundle`, so no content directory is bundled by directory. Training and Knowledge Base read only the in-memory repositories filled from those imports.

Assessment: a candidate file merely sitting in a non-scanned folder has NO path to a learner today. Exposure would need someone to add an import or a loader. The real near-term risk from a wrong location is test and preflight failure, not learner exposure. No isolation mechanism was added.

## 7. Feedback capability assessment

`NOT CURRENTLY SUPPORTED` for rationale; overall: `PARTIALLY SUPPORTED`.
- Selected answer: SUPPORTED (component state `selected` index in `Training.tsx` `KnowledgeCheckItem`).
- Correct answer shown: SUPPORTED (correct option gets `--nexus-color-accent-muted` background once any option is selected).
- isCorrect: PARTIALLY, computed per option in render; not stored or exposed.
- Green/red states: PARTIALLY. Correct-selected gets an accent border (#0f6e63, a dark teal) plus pale teal fill; wrong-selected gets only a red border (#b3261e), no red fill (`--nexus-color-critical-muted` exists but is unused there). Whether teal satisfies "GREEN" is a product interpretation, not decided here.
- Rationale and per-choice explanations: NOT SUPPORTED (no data field, no UI).
- Also observed: after answering, options remain clickable and the selection can change.

## 8. Validator result

`python3 validate_pilot_batch.py nexus-pilot-batch-001.candidates.r2.json`: exit code 0, `items=12`, positions `a:3 b:3 c:3 d:3`, `correct_is_longest=0`, 0 ERRORs, 12 WARNs ("no human verification recorded yet"). RESULT: PASS (structure and bias only). Not medical verification, not source verification, not production approval. Hash unchanged after the run. Validator not modified.

## 9. Product decisions encountered (unresolved dependencies only)

- PRODUCT DECISION — BLOCKED: Training schema architecture. Item-level unit, choice ids, rationale, source and status all depend on it; the choice between a separate bank and an extension of `knowledgeChecks` decides where every NOT REPRESENTABLE field lives.
- PRODUCT DECISION — BLOCKED: Training entitlement mapping. No Training capability exists; the pilot `difficultyLevel` cannot be tied to any tier and was not.
- PRODUCT DECISION — BLOCKED: where Training difficulty lives (the 1 to 6 scale is scenario-side today), dependent on the schema decision above.
- D10 dependency: any seen-item or anti-repetition history needs storage; web persistence is undecided, so its location was not decided.
- Taxonomy: whether `category` maps to `skillArea` or `domain`.
- A12 relevance: inventory is thin; this pilot does not change it. A2, D1, A7 not touched.
- Engineering observation, not a decision: the current schema strips unknown keys and does not bounds-check `correctOptionIndex`. Reported, not fixed.

## 10. Exact next engineering action

No implementation. The next engineering step is an owner-level decision, delivered as a decision packet: Training schema architecture (separate question bank versus extension of `knowledgeChecks`), with the field-by-field consequences from section 3. Until that decision exists, do not write a schema, adapter, loader or import. In parallel, and independent of it, a human completes the source-locator verification worksheet. If separately authorized later, the only in-scope tooling change would be a read-only check that a candidate file is not located in any scanned path.

No repository change occurred, so there is nothing to commit or push.
