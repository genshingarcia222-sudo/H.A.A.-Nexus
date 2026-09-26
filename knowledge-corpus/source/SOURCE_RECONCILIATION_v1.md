# Source reconciliation — Knowledgebase archive v1.0

**Status: BLOCKED. Reconciliation could not be performed.**
**Date: 2026-09-26. Branch: `feat/knowledgebase-expansion`, based on `main` at `6c92a30`.**

## What the workstream charter said to reconcile

The charter (section III) names two source artifacts and instructs that both be
located, read, compared, and preserved before any new material is generated:

1. `nexus_knowledgebase_materials_v1.md` — the machine-oriented generation and
   content specification.
2. `Nexus_Knowledgebase_Archive_v1.0.pdf` — the human-review and archive
   representation.

It states that together they establish 400 seed records across five difficulty
bands, 20 knowledge modules, a 12-axis D01–D12 competency matrix, the
dynamic-generation rules, the evidence hierarchy, the provenance requirements,
contradiction handling, the safety and privacy override behaviour, and the
source and version governance rules.

## What is actually present

**Neither file exists.** Both were searched for by exact name and by pattern
across the whole filesystem of this session, and across the repository:

```
find / -iname "*nexus_knowledgebase*" -o -iname "*Knowledgebase_Archive*"   → no results
grep -ril "knowledgebase" (repository, excluding node_modules)              → CHANGELOG.md,
                                                                              docs/PHASE_8_3_ASSESSMENT_MODE.md
```

Neither of those two hits is the archive; both are incidental prose mentions.

The two files are not in the working tree, not in `Claude outputs/`, not tracked
on `main` at `6c92a30`, and not attached to this session. They were not supplied
to this session in any form.

## Consequence, stated plainly

- **No comparison was performed.** There is nothing to compare.
- **No discrepancies were recorded**, because recording a discrepancy between two
  documents that were never read would be fabrication.
- **The 400 seed records are not in this corpus.** No part of them has been
  reconstructed from memory of an earlier conversation. Under the repository's
  own authority order, conversational memory is the weakest source and is not
  project state; a remembered record set is not a record set.
- **The charter's Phase C ("audit the existing 400 records") could not be run
  against them.** What was audited instead is the machine-readable corpus
  material that *does* exist in the repository — see
  `../EXISTING_CORPUS_AUDIT.md`, which measures it rather than assuming it.
- **Charter section XXIX's instruction that "the first expansion should address
  measured gaps" was honoured against the gaps that could be measured**, namely
  those in the repository's real corpus artifacts, not those in an absent
  archive.

## What was legitimately carried forward from the charter

The charter itself is owner-supplied specification, and it is present. The
taxonomies it states in full were transcribed into machine-readable registries
and are traceable to it:

| Registry | Charter section |
| --- | --- |
| `../registries/modules.json` (M01–M20) | IX |
| `../registries/competencies.json` (KB-D01–KB-D12) | VIII, IV |
| `../registries/difficulty.json` (5 bands) | X |
| `../registries/task-types.json` (27 types) | VII layer 3 |
| `../registries/error-taxonomy.json` (18 patterns) | VII layer 5 |
| `../registries/remediations.json` (16) | VII layer 5, XLIII |
| `../registries/record-types.json` (18 object types) | XX |
| `../registries/lifecycle.json` (11 states) | XXII |
| `../registries/access-classes.json` (6) | XXXIII |
| `../registries/coding-versions.json` (2 editions) | XIV |
| `../registries/mutation-dimensions.json` (29 dimensions, 12 traps) | XI, XII, XIII |

This is transcription of a specification, not recovery of a corpus. A taxonomy
is a set of labels; the 400 records were content, and content cannot be
transcribed from a description of it.

## Source-of-truth rule, pending the archive

Until the archive is supplied, the controlling order for this workstream is:

1. The repository at a verified pushed commit.
2. The owner-supplied charter, for taxonomy and governance only.
3. Nothing else. In particular, no field is populated from an inferred archive
   value, and no record claims `source_id` or `source_version` pointing at the
   absent archive.

When the archive arrives, it is added under `knowledge-corpus/source/` unmodified,
a real reconciliation replaces this document, and the 400 seed records are
imported as a distinct preserved layer (charter section VII layer 1) with their
original ids intact. They are **not** to be merged into, renumbered within, or
deduplicated against batch KB-001; KB-001's ids are minted and will not be
recycled.

## Unblocking this

Supply either file to the repository or to a session, in any readable form. The
Markdown specification is the more useful of the two first, because it is the
one that carries the record content and the generation rules.
