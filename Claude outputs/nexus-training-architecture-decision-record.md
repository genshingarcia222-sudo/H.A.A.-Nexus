# Decision record: canonical Nexus Training content architecture

Date recorded: 2026-09-19. Source: explicit owner instruction in the session ("OPTION B — SEPARATE REUSABLE TRAINING QUESTION BANK"). Supersedes the PENDING status of `nexus-training-architecture-decision-packet.md`. Classification: OWNER-DEFINED PRODUCT CHANGE (architecture authorization, not a schema).

## Decided
- Canonical Training content architecture: a separate, reusable Training Question Bank in which each question is its own record, independent of a lesson.
- Existing lessons and their `knowledgeChecks` are not removed by this decision.

## Not decided by this record (still open)
Owner-level:
- Whether the 6 existing knowledge checks stay in their lessons, coexist with the bank, or are migrated.
- Whether bank questions carry a link to a lesson (and how the recommendation engine uses it).
- Training entitlement mapping; where Training difficulty is defined for entitlement.
- Seen-item and Training-progress persistence (depends on D10).
- A2, D1, A7, A12.
- Taxonomy: mapping of `domain` / `skillArea`.

Engineering design questions inside Option B (from the packet's [U] items): question id format and global uniqueness rule; loader mechanism (today: explicit static imports); storage (files only, or a table; `training_lessons` is title/category/blob-shaped); source list shape (inline vs shared); status filtering so candidates never ship; where the difficulty type is shared with the scenario side; selector rules for ~10 questions, replay diversity and anti-memorization; documentation updates (Architecture §16 does not describe a bank); whether `content_versions` gains a package type.

## Effect on Pilot 001 (unchanged)
- 12 items remain `CANDIDATE`, SOURCE-VERIFICATION-PENDING, 0 production-eligible. Option B does not promote, ingest or approve anything.
- Revision 2 remains the frozen baseline; hashes verified unchanged this session:
  - `nexus-pilot-batch-001.candidates.r2.json` 05fa24d0…aaf3d
  - `validate_pilot_batch.py` 470674c9…9f23
  - review worksheet 77255d1f…1099
  - manifest e6667d6a…be664
  - compatibility report c2cdf3b5… (recorded now; it was edited before this hash was taken)
- Pilot field names are proposals, not the schema. The pilot's shape is evidence for the design, not the design itself.
- Placement constraints remain: not in `content/lessons/`, `content/incoming/` or `content/scenarios/**`, until a bank loader and its tests define a location.
- Human source-locator verification remains an independent workflow and is still 0 of 12.

## Next step
Implementation belongs to the engineering layer (Claude Code) under repository discipline: read the repository, define the smallest bank schema and validator with tests, keep entitlement and persistence out of scope, update docs and changelog, and verify before any commit.
