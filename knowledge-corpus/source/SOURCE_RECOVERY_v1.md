# Source recovery — Knowledgebase archive v1.0 — **RECOVERED**

**O3 moves from "unrecoverable" to "recovered and identity-verified", for one of
the three named artifacts.** Recovered 2026-10-15 by DEVICE-01.

`SOURCE_RECONCILIATION_v1.md` recorded this archive as absent, and that was
true of what it could see: the file has **never been committed to any branch**,
appears in no blob in the whole repository history, and there are no tags or
releases. It was never in Git. It is on the **owner's local filesystem**, which
the earlier reconciliation ran outside of.

## What was recovered

| | |
|---|---|
| File | `Nexus_Knowledgebase_Archive_v1.0_2026-09-22.pdf` |
| Location | `D:/HAA_Nexus/NEXUS - Prologue/` — **outside the repository** |
| SHA-256 | `ED3BCD2608DC9EA93139210879EC9E7355FDC1AAFFE6FFF6DE48173112653F75` |
| Size | 1,219,286 bytes |
| Format | PDF 1.7, 82 page objects, 433,143 extractable characters |
| Declared | "H.A.A. NEXUS KNOWLEDGEBASE ARCHIVE v1.0 — Human-review edition \| 22 September 2026 \| 400 seed records" |

**It is not committed by this change.** A 1.2 MB binary is not source, and the
reviewable form is the extracted reference data beside this file:
`archive-v1-reference.json`, regenerable from the PDF.

## Identity verified on six independent criteria

The charter said the artifacts establish 400 seed records across five difficulty
bands, 20 knowledge modules and a 12-axis D01–D12 competency matrix. Every one
of those checks out against the recovered file, and the counts agree internally:

| Criterion | Charter | Measured in the archive |
|---|---|---|
| Seed records | 400 | **400 distinct record ids** |
| Difficulty bands | five | **five**: Easy 84, Moderate 84, Hard 84, Very Hard 84, Realistic Premium 64 = **400** |
| Id pattern by band | — | `NEXUS-EA` 84, `NEXUS-MO` 84, `NEXUS-HA` 84, `NEXUS-VE` 84, `NEXUS-REAL` 64 |
| Knowledge modules | 20 | **M01–M20**, all 20 named with scopes |
| Competency matrix | 12-axis D01–D12 | **12 axes**, D01–D12 |
| Self-declared changelog | — | *"2026-09-22 — v1.0 — Initial corpus: 336 tiered competency seeds + 64 Realistic Premium cases; D12 taxonomy; 20 knowledge modules…"* — and 336 + 64 = 400 |

The band counts, the id prefixes and the archive's own changelog line agree with
each other and with the charter. That is why this is recorded as verified rather
than as "a plausible file with the right name".

## Still missing, and still blocking

The archive names its own machine-readable companion, which the charter did not:

| Artifact | Role | Found |
|---|---|---|
| `nexus_knowledgebase_archive_v1.jsonl` | **"Primary machine-readable source"**, per the archive's own front matter | **NO** |
| `nexus_knowledgebase_materials_v1.md` | Generation and content specification, per the charter | **NO** |

Both were searched for across the whole repository history and across the local
filesystem by exact name and by pattern. Neither exists. The archive instructs
*"Preserve record IDs when refining the corpus"*, which the `.jsonl` would make
mechanical and the PDF makes a transcription job.

## What this unblocks, and what it does not

**It does not migrate anything by itself.** `MIGRATION_BLOCKERS.md` lists five
required contract B fields the authored corpus cannot supply. This recovery
touches three of them, and the honest status of each is different:

| Blocker | Effect of the recovery |
|---|---|
| `source` (432 records) | **A real citable source now exists.** `archive-v1-reference.json` gives it a stable id, publisher-equivalent, version and date. **Per-record locators still do not exist** — knowing which archive page a given generated record derives from is a mapping nobody has made, and inventing one would be fabricating provenance |
| `skillArea` (432 records) | **Plausibly unblocked.** The 20 module names are real, authoritative text, and every record carries `moduleIds`. Mapping `moduleIds[0]` to its module name is a derivation from real data rather than an invention — but it is still a **decision**, because a record with two modules has two candidate skill areas |
| `difficultyLevel` / **O4** | **Informed, not answered.** The archive's five bands are now authoritative, and the 84/84/84/84/64 distribution is known. Mapping five bands onto contract B's 1–6 level is still the open question O4 asks |
| `learningObjective` (432) | **Untouched.** The archive is a record corpus, not a set of objectives |
| `questionType` (432) | **Untouched** |
| `choices` (114 records) | **Untouched.** Still the structural blocker: contract B's ITEM extends a multiple-choice bank |

## One finding that is immediately actionable — the coding-version gate

The archive states, verbatim:

> FY2026 ICD-10-CM is active through 30 September 2026; FY2027 begins 1 October 2026

It adds that *"coding items must carry encounter-date/version metadata and use
the applicable official release."*

**Today is 2026-10-15, so FY2027 is the active edition and FY2026 is
superseded.** The archive was published 2026-09-22, while FY2026 was still
current, so any coding content it carries was written against the **superseded**
release. That is not an error in the archive — it is a dated document — but it
means the two edition windows must be kept distinct, and that a corpus record
inherited from this archive cannot be assumed current. This is the B4 question,
and the archive is authoritative for the window boundaries themselves.

**No ICD-10-CM content was ingested, validated or relabelled here**, and the
boundary dates above are quoted from the archive rather than from CMS. CMS
remains the authority for the code sets; this file records only what the archive
declares.

## What was not done

- The 400 seed records were **not** extracted into the corpus. The text is
  recoverable, but a table-layout PDF transcribed into clinical training records
  needs human verification, and a machine transcription presented as the
  original would be exactly the fabrication this file exists to avoid.
- **No record's review status or production eligibility changed.** All 432
  authored records remain `pendingHumanReview`, 0 approved.
- The PDF was **not copied into the repository**, and nothing was deleted or
  moved on the owner's filesystem.
