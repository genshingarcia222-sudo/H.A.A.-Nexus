# Decision packet: canonical Nexus Training content architecture

Date: 2026-09-19. Status: DECISION PENDING (owner). This packet does not rank or select an option, and it proposes no schema. Pilot 001 stays at 12 candidates, SOURCE-VERIFICATION-PENDING, 0 production-eligible. No content was generated or revised.

Evidence base: `nexus-pilot-001-compatibility-report.md` plus the repository files read this session (local checkout; git HEAD not observed).

Tags used below. **[V]** verified directly in the repository or its documents. **[C]** follows directly from a verified fact, but is not itself observed. **[U]** unknown until a design is specified.

## 1. Verified repository facts this packet relies on

- F1 [V] `TrainingLesson` requires `id`, `title`, `category`, `version`, `explanation`; `knowledgeChecks[]` is optional (default `[]`) and each check is `{question, options: string[], correctOptionIndex}` (`training-engine/schema.ts`).
- F2 [V] The schema is a default zod object: unknown keys are stripped silently; `correctOptionIndex` is not bounds-checked; duplicate option text passes.
- F3 [V] Checks have no id. Lesson ids are unique per `InMemoryTrainingLessonRepository`; its API is `get`, `list`, `byCategory`.
- F4 [V] The Training screen lists lessons, opens one lesson, and shows that lesson's checks. There is no run concept, selector or progress store.
- F5 [V] The recommendation engine deep-links lesson ids; a content-QA test hard-codes three lesson ids; `linkedScenarioIds` is lesson-level.
- F6 [V] Content is bundled by an explicit static import list in `apps/desktop/src/content/scenarios.ts` and validated at module load (a failure throws). Content-QA tests scan `content/lessons/`, `content/scenarios/live-scribing/`, `content/incoming/`; preflight scans `content/scenarios/**`.
- F7 [V] Difficulty 1 to 6 exists only on scenarios (`scenario-engine/types.ts`, `difficulty.ts`) and in the scenario-named capability `maxScenarioDifficulty`. Training has no difficulty field.
- F8 [V] Current inventory: 3 lessons, 6 knowledge checks, 2 checks per lesson, each lesson with an `explanation`.
- F9 [V] Migration `001_initial.sql` defines `training_lessons(id, title, category, content_json, version)` and marks it "Not yet written"; no TypeScript persistence or IPC code references lessons. The architecture doc (§16) describes lessons as content packages with `explanation`, `examples`, `exercises`, `knowledgeChecks`, `linkedScenarioIds` (the schema has no `exercises`; already reported as a mismatch).

## 2. The two options (neutral descriptions)

**Option 1. Extend the existing `knowledgeChecks` architecture.** The lesson stays the unit of content; checks gain whatever additional fields are chosen.

**Option 2. Separate reusable Training Question Bank architecture.** A new content type in which each question is its own record, independent of a lesson; lessons remain as they are.

## 3. Consequence comparison

| Dimension | Option 1: extend `knowledgeChecks` | Option 2: separate question bank |
|---|---|---|
| Rationale | Check has no rationale field [V, F1]; a new field is a change to the check object. Until added, a supplied rationale is silently discarded [V, F2]. Per-choice explanations do not fit `options: string[]` [C]; how they are carried is [U]. | Rationale is a field of the new record by definition [C]. The new schema, validator and reader do not exist [V, F3, F4]. |
| Source / provenance | No provenance field anywhere in training-engine [V]. Provenance would live inside lesson files, at check level [C]. | Per-record field, inline or by reference to a shared source list [U]. |
| Question IDs | Checks are identified only by position in an array [V, F3]. A check id needs a new field plus a uniqueness rule (within lesson, or global) [U]. No existing code references check ids [C, F5]. | Record-level id is native [C]. Global uniqueness rule must be defined [U]. Pilot ids follow a different pattern from lesson slugs; separate id space, so no collision [C]. |
| Difficulty | No field on lesson or check [V, F7]. A level would sit on the lesson (one level per lesson) or on each check (mixed levels inside a lesson); either is a choice [U]. | Per-record field [C]. |
| Both, difficulty | The 1 to 6 scale is defined on the scenario side only [V]; reusing it for Training requires sharing or duplicating that type [U]. Mapping to capabilities is a separate decision (section 5). | same |
| Domain / skill | One free-string `category` per lesson; `byCategory` exists [V, F3]. A check inherits its lesson's category [C]; finer skill needs a new per-check field [C]. | Per-record `domain`/`skillArea` [C]. The repository has no query API by such attributes; only `byCategory` for lessons exists [V]. |
| Review status | No lifecycle field for lessons [V]. Scenarios use folder plus hash gate [V, F6]. Lesson files are bundled whole and validated at load [V]; a candidate check inside an imported lesson would ship with it unless the UI filters [C]. | Candidate and approved items can live in separate files or stores [C]; any loader must still filter by status [U]. |
| Question variants | No variant concept [V]. Variants would be additional checks in the same lesson or extra lessons, linked by a new field [C, U]. | A variant-group field per record [C]; selector rules are [U]. |
| 10-question runtime selection | The screen shows one lesson's checks; each lesson holds 2 [V, F4, F8]. A ~10-question run needs a step that gathers checks across lessons; `list()` makes that possible [C], but checks lack ids for tracking [V]. Current checks are written as follow-ups to their lesson's explanation [V, files], so a cross-lesson run separates them from that text [C]. No selector exists in either option [V]. | Selection operates directly over the record pool [C]. Nothing exists yet [V]. |
| Replay diversity | Pool size is bounded by checks embedded in lessons: 6 today [V]. Each new lesson file requires an `explanation` [V, F1]. | Pool can grow without authoring lessons [C]; questions not tied to a lesson lose the lesson link unless a link field is added [U]. |
| Anti-memorization | Needs check ids (absent [V]) and metadata for variant/skill spread [U]. | Needs the same capabilities; native id and `variantGroup` are available in the record [C]. Selector design is [U]. |
| Future archive scale | Granularity is file per lesson; every new file needs an edit to the static import list [V, F6]. All imported JSON is bundled into the build [C]. The `training_lessons` table stores one JSON blob per lesson, with no attribute queries inside it [V, C]. | Loader is undefined [U]. With today's mechanism, each new file is also a code edit [C, F6]; a directory-scanning loader would be a new mechanism [V: none exists]. Storage: `training_lessons` is title/category/blob-shaped; whether a question needs its own table is [U]. |
| Existing lesson compatibility | Existing 3 lessons and 6 checks stay valid if new fields are optional [C, F1]. Lesson viewer, recommendation links and content-QA are unaffected [C]. Stays within the documented §16 structure [V]. | Lessons are untouched [C]. The existing 6 checks either stay (two content types coexist) or are moved [U]. Adds a content type not described in §16, so documentation must change [C]. |
| Migration impact | TypeScript schema and its tests change [C]. `training_lessons.content_json` is a text blob, so added JSON keys need no SQL column change [C]; the table is unused today [V]. No content migration if new fields are optional [C]. | New schema, validator, loader, tests and docs [C]. Whether a DB table is required is [U]. `content_versions` lists package types scenario, terminology, lesson (architecture doc) [V]; hashing bank content would need a new type [C]. |

## 4. Facts that hold under either option

- The compatibility report's NOT REPRESENTABLE list is the same set of fields either way: rationale, per-choice explanations, source, question id, difficulty, domain/skill, question type, learning objective, variant group, coding reference, review status, expiry, verification. Only where they live differs.
- Feedback UI (rationale display, green and red fills) is a separate engineering item [V, compatibility report §7].
- Any candidate content needs a non-scanned location or a new loader with its own tests [V, F6].
- No selector, run concept or seen-item store exists [V].
- The current schema's silent stripping of unknown keys [V] applies to any field added before the schema knows it.

## 5. Kept separate, not decided here

- Training entitlement mapping. No Training capability exists; `maxScenarioDifficulty` is scenario-named.
- Seen-item and Training-progress persistence, and where it lives (depends on D10).
- Where Training difficulty is defined for entitlement purposes.
- A2, D1, A7, A12.
- The taxonomy question of whether `category` corresponds to `domain` or `skillArea`.

## 6. Inputs the owner may want to state (these inform the decision; they are not answers I assume)

1. Should a question be usable on its own, outside any lesson?
2. Must every question stay attached to a lesson's explanation?
3. May candidate content share a file with shipped content?
4. Expected archive size: tens, hundreds or thousands of questions?

## 7. Human source verification (independent workflow)

Unchanged and not gated by this decision: worksheet in `nexus-pilot-001-review-and-integration-gate.md`, section B. 0 of 12 items are human-verified. Do not set any `humanVerifiedBy` or `humanVerifiedOn` until a person has actually opened the authoritative document.

## 8. Gate

No content, schema, loader or import until the owner resolves this architecture gate.
