import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BAND_LEVEL_HINTS,
  CORPUS_DIFFICULTY_BANDS,
  crosswalkDifficulty,
  hasVerifiedDifficultyLevel,
  unresolvableBands
} from "./difficulty.js";
import { AssessmentItemSchema } from "./item.js";

/**
 * O4 — the archive's five difficulty bands against contract B's six levels.
 *
 * Owner-decided 2026-10-15: the original band stays authoritative source
 * metadata, and no unsupported five-into-six equivalence may be invented.
 *
 * What these tests mostly guard is the ways that decision could be quietly
 * undone: a default level appearing for an ambiguous band, the band being
 * replaced by the level rather than kept beside it, or the transcribed hint
 * table drifting away from the registry it came from.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.join(here, "../../../../knowledge-corpus/registries/difficulty.json");

describe("O4: the crosswalk only resolves what the evidence resolves", () => {
  it("assigns a level for every band the registry hints exactly once", () => {
    for (const band of ["MODERATE", "HARD", "VERY_HARD", "REALISTIC_PREMIUM"] as const) {
      const r = crosswalkDifficulty(band);
      expect(r.status, band).toBe("VERIFIED");
      expect(r.level, band).toBe(BAND_LEVEL_HINTS[band][0]);
      expect(r.band, band).toBe(band);
    }
  });

  it("leaves EASY unresolved, because the registry hints two levels", () => {
    // The whole decision in one case. EASY could plausibly be 1 or 2, and
    // picking either is the invention O4 forbids.
    const r = crosswalkDifficulty("EASY");
    expect(r.status).toBe("AMBIGUOUS");
    expect(r.level).toBeNull();
    expect(r.hint).toEqual([1, 2]);
    expect(r.reason).toMatch(/does not single one out/);
  });

  it("NEVER returns a level for a non-verified status", () => {
    for (const input of ["EASY", undefined, null, "", "NIGHTMARE", 3, {}]) {
      const r = crosswalkDifficulty(input as unknown);
      if (r.status !== "VERIFIED") expect(r.level, String(input)).toBeNull();
    }
  });

  it("distinguishes all four outcomes, which O4 requires", () => {
    // Collapsing these is how an absent value starts looking like a decided one.
    expect(crosswalkDifficulty("HARD").status).toBe("VERIFIED");
    expect(crosswalkDifficulty("EASY").status).toBe("AMBIGUOUS");
    expect(crosswalkDifficulty(undefined).status).toBe("ABSENT");
    expect(crosswalkDifficulty(null).status).toBe("ABSENT");
    expect(crosswalkDifficulty("").status).toBe("ABSENT");
    expect(crosswalkDifficulty("NIGHTMARE").status).toBe("INVALID_BAND");
  });

  it("rejects a numeric level supplied where a band belongs", () => {
    // A record carrying difficulty: 4 is not carrying a band, and must not be
    // read as one.
    const r = crosswalkDifficulty(4);
    expect(r.status).toBe("INVALID_BAND");
    expect(r.level).toBeNull();
  });

  it("every verified level is inside contract B's 1-6 scale", () => {
    for (const band of CORPUS_DIFFICULTY_BANDS) {
      const r = crosswalkDifficulty(band);
      if (r.status !== "VERIFIED") continue;
      expect(r.level).toBeGreaterThanOrEqual(1);
      expect(r.level).toBeLessThanOrEqual(6);
    }
  });

  it("is deterministic", () => {
    expect(crosswalkDifficulty("HARD")).toEqual(crosswalkDifficulty("HARD"));
  });

  it("names EASY as the one band needing authoring", () => {
    expect(unresolvableBands()).toEqual(["EASY"]);
    expect(hasVerifiedDifficultyLevel("EASY")).toBe(false);
    expect(hasVerifiedDifficultyLevel("HARD")).toBe(true);
  });
});

describe("O4: the transcribed hints agree with the registry on disk", () => {
  // `difficulty.ts` transcribes the hints because nexus-core declares no build
  // and cannot read repository files at runtime. This is what stops the
  // transcription drifting away from its source.
  const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));

  it("covers exactly the registry's bands, in its ordinal order", () => {
    expect(registry.bands.map((b: { id: string }) => b.id)).toEqual([...CORPUS_DIFFICULTY_BANDS]);
  });

  it("carries the same repositoryLevelHint for every band", () => {
    for (const band of registry.bands) {
      expect(BAND_LEVEL_HINTS[band.id as keyof typeof BAND_LEVEL_HINTS], band.id).toEqual(
        band.repositoryLevelHint
      );
    }
  });

  it("still reflects the registry's warning that the bands are not that scale", () => {
    // If this note ever disappears, the hint has become a definition and O4's
    // premise needs revisiting rather than silently outliving it.
    expect(registry.mappingNote).toMatch(/NOT that scale/);
  });
});

describe("O4: the contract keeps the band beside the level", () => {
  const base = {
    questionId: "NEXUS-L2-PRIV-000004",
    family: "ITEM" as const,
    revision: 1,
    domain: "Medical Scribing",
    skillArea: "Privacy & Confidentiality",
    difficultyLevel: 4 as const,
    questionType: "recall" as const,
    learningObjective: "Identify a disclosure the minimum necessary standard does not apply to.",
    question: "Which disclosure is outside the minimum necessary standard?",
    choices: [
      { id: "a", text: "A disclosure to the patient themselves" },
      { id: "b", text: "A disclosure to a billing vendor" },
      { id: "c", text: "A disclosure to a colleague for interest" },
      { id: "d", text: "A disclosure to a marketing firm" }
    ],
    correctChoiceId: "a",
    rationale: "The Rule lists disclosures to the individual among its exceptions.",
    source: { ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" },
    modality: "DIRECT_KNOWLEDGE" as const,
    contentStatus: "candidate" as const,
    reviewStatus: "pending" as const,
    provenance: {
      generationMethod: "MACHINE_DRAFTED" as const,
      authoredBy: "machine:claude-code",
      authoredOn: "2026-09-21"
    }
  };
  const parse = (o: Record<string, unknown> = {}) => AssessmentItemSchema.safeParse({ ...base, ...o });

  it("accepts a band alongside a level, and keeps both", () => {
    const r = parse({ difficultyBand: "HARD" });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (!r.success) return;
    expect(r.data.difficultyBand).toBe("HARD");
    expect(r.data.difficultyLevel).toBe(4);
  });

  it("accepts a band whose level is unresolved, which is the EASY case", () => {
    // 63 records look like this after migration: band preserved, no level.
    const { difficultyLevel: _omitted, ...withoutLevel } = base;
    const r = AssessmentItemSchema.safeParse({ ...withoutLevel, difficultyBand: "EASY" });
    // The level is required by the inherited contract, so such a record is a
    // draft rather than a production item - which is the point. What matters
    // here is that the band itself is never the reason it fails.
    if (!r.success) {
      const bandIssues = r.error.issues.filter((i) => String(i.path[0]) === "difficultyBand");
      expect(bandIssues).toEqual([]);
    }
  });

  it("rejects a band the registry does not define", () => {
    expect(parse({ difficultyBand: "NIGHTMARE" }).success).toBe(false);
  });

  it("keeps the band optional, so existing items are unaffected", () => {
    const r = parse();
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.difficultyBand).toBeUndefined();
  });

  it("does not let the band stand in for the level", () => {
    // A consumer needing the numeric scale must not be satisfied by a band.
    const { difficultyLevel: _omitted, ...withoutLevel } = base;
    expect(AssessmentItemSchema.safeParse({ ...withoutLevel, difficultyBand: "HARD" }).success).toBe(
      false
    );
  });
});
