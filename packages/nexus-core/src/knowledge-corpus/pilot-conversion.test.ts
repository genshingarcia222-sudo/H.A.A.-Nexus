import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertPilotBatch, sentencesOf, splitSituationalStem } from "./pilot-conversion.js";
import type { ConversionPlan, PilotBatch } from "./pilot-conversion.js";
import { validateKnowledgeCorpus } from "./validate.js";
import { deliverableItems } from "./eligibility.js";
import type { Modality } from "./item.js";

/**
 * D12 work package 6 — Pilot Batch 001 revision 3 into the corpus.
 *
 * The frozen r3 fixture is the input and is never written to. What this suite
 * pins is that conversion moves text **verbatim**, keeps every gate closed,
 * and produces nothing a learner could receive.
 */

const R3 = fileURLToPath(new URL("../question-bank/__fixtures__/nexus-pilot-batch-001.candidates.r3.json", import.meta.url));
const R3_SHA256 = "8d845560e94cb3ab275fb48daa7ce1623a584731c8a064a4707766fb03038791";

/** Modality is authored, never inferred — so the plan states all twelve. */
const MODALITIES: Record<string, Modality> = {
  "NEXUS-L1-PRIV-000001": "DIRECT_KNOWLEDGE",
  "NEXUS-L1-PRIV-000002": "DIRECT_KNOWLEDGE",
  "NEXUS-L2-PRIV-000003": "SITUATIONAL",
  "NEXUS-L2-PRIV-000004": "DIRECT_KNOWLEDGE",
  "NEXUS-L2-PRIV-000005": "DIRECT_KNOWLEDGE",
  "NEXUS-L3-PRIV-000006": "SITUATIONAL",
  "NEXUS-L1-ICD-000007": "DIRECT_KNOWLEDGE",
  "NEXUS-L1-ICD-000008": "DIRECT_KNOWLEDGE",
  // Q9 is workflow-sequencing by questionType, but r3 holds no discrete steps
  // and WORKFLOW requires them. Conversion must not invent steps, so it stays
  // DIRECT_KNOWLEDGE until a reviewer authors them.
  "NEXUS-L2-ICD-000009": "DIRECT_KNOWLEDGE",
  "NEXUS-L2-ICD-000010": "DIRECT_KNOWLEDGE",
  "NEXUS-L2-ICD-000011": "DIRECT_KNOWLEDGE",
  "NEXUS-L3-ICD-000012": "SITUATIONAL"
};

const PLAN: ConversionPlan = {
  modalities: MODALITIES,
  authorityClasses: {
    "HHS-PR-SUMMARY": "OFFICIAL_GUIDANCE",
    "HHS-MIN-NECESSARY": "OFFICIAL_GUIDANCE",
    "HHS-BA": "OFFICIAL_GUIDANCE",
    "HHS-FAQ-TREATMENT": "OFFICIAL_GUIDANCE",
    "HHS-PR-SUMMARY-MIN-NEC": "OFFICIAL_GUIDANCE",
    "CDC-ICD10CM": "OFFICIAL_CODE_SET",
    "CDC-ICD10CM-GL-FY27": "OFFICIAL_CODE_SET",
    "CFR-164-502": "PRIMARY_REGULATION"
  },
  contexts: {
    "NEXUS-L2-PRIV-000003": { contextId: "NEXUS-CX-PRIV-000001", role: "medical scribe" },
    "NEXUS-L3-PRIV-000006": { contextId: "NEXUS-CX-PRIV-000002", role: "medical scribe" },
    "NEXUS-L3-ICD-000012": { contextId: "NEXUS-CX-ICD-000001", role: "medical scribe" }
  },
  agent: "machine:claude-code",
  convertedOn: "2026-09-25",
  retrievedOn: "2026-09-20"
};

async function loadBatch(): Promise<{ raw: string; batch: PilotBatch }> {
  const raw = await readFile(R3, "utf-8");
  return { raw, batch: JSON.parse(raw) as PilotBatch };
}

async function convert() {
  const { batch } = await loadBatch();
  return { batch, result: convertPilotBatch(batch, PLAN) };
}

describe("splitting a stem is lossless", () => {
  it("separates the case from the final question", () => {
    const split = splitSituationalStem(
      "A clinic sends a lab report to a specialist. Under the Rule, is authorization required?"
    );
    expect(split).toEqual({
      contextText: "A clinic sends a lab report to a specialist.",
      task: "Under the Rule, is authorization required?"
    });
  });

  it("returns nothing for a stem with no case in front of it", () => {
    expect(splitSituationalStem("What term does the Rule use?")).toBeNull();
  });

  it("does not split inside quoted material", () => {
    const split = splitSituationalStem(
      'A nurse\'s note says the patient "seems like they have diabetes." The provider documented none. What follows?'
    );
    expect(split?.task).toBe("What follows?");
    expect(split?.contextText).toContain("seems like they have diabetes.");
  });

  it("breaks a case into addressable sentences", () => {
    expect(sentencesOf("One thing happened. Then another did.")).toEqual([
      "One thing happened.",
      "Then another did."
    ]);
  });
});

describe("conversion preserves the batch", () => {
  it("reads the frozen r3 fixture and leaves it untouched", async () => {
    const { raw } = await loadBatch();
    expect(createHash("sha256").update(raw, "utf-8").digest("hex")).toBe(R3_SHA256);
  });

  it("converts all twelve items and keeps every answer key", async () => {
    const { batch, result } = await convert();
    expect(result.items).toHaveLength(12);
    expect(result.items.map((item) => item.questionId)).toEqual(batch.items.map((item) => item.id));
    expect(result.items.map((item) => item.correctChoiceId).join("")).toBe("abcdabcdabcd");
  });

  it("rejoins every split stem into exactly the original text", async () => {
    const { batch, result } = await convert();
    const contextsById = new Map(result.contexts.map((context) => [context.id as string, context]));
    let checked = 0;
    for (const item of result.items) {
      const ref = item.contextRef as string | undefined;
      if (!ref) continue;
      const context = contextsById.get(ref.split("@")[0]!);
      const original = batch.items.find((candidate) => candidate.id === item.questionId)!.question;
      expect(`${context!.caseSummary as string} ${item.question as string}`).toBe(original);
      checked += 1;
    }
    expect(checked).toBe(3);
  });

  it("keeps each context's segments verbatim from its case", async () => {
    const { result } = await convert();
    for (const context of result.contexts) {
      const segments = context.information as { text: string }[];
      expect(segments.length).toBeGreaterThan(0);
      for (const segment of segments) {
        expect(context.caseSummary as string).toContain(segment.text);
      }
    }
  });

  it("carries flags forward and records the modality as assigned, not inferred", async () => {
    const { result } = await convert();
    for (const item of result.items) {
      const flags = item.flags as string[];
      expect(flags).toContain("HUMAN-VERIFY-REQUIRED");
      expect(flags.some((flag) => flag.startsWith("MODALITY-ASSIGNED-AT-CONVERSION"))).toBe(true);
    }
    // r3's Q4 flag, restored earlier, must still be here.
    const q4 = result.items.find((item) => item.questionId === "NEXUS-L2-PRIV-000004");
    expect((q4?.flags as string[]).some((flag) => flag.startsWith("SECONDARY-SOURCE-OLD"))).toBe(true);
  });

  it("turns r3's prose retrieval note into a machine entry that cannot pass for a person", async () => {
    const { result } = await convert();
    for (const item of result.items) {
      const entries = item.machineVerification as { verifier: string; note: string }[];
      expect(entries).toHaveLength(1);
      expect(entries[0]!.verifier).toBe("machine:claude-code");
      expect(entries[0]!.note).toContain("RETRIEVED-AUTHORITY");
    }
  });

  it("mints one concept per variant group, stating the batch's own objective", async () => {
    const { batch, result } = await convert();
    const groups = new Set(batch.items.map((item) => item.variantGroup));
    expect(result.concepts).toHaveLength(groups.size);
    const first = result.concepts.find((concept) => concept.id === "PRIV-PHI-DEFINITION");
    expect(first?.statement).toBe(batch.items[0]!.learningObjective);
  });

  it("says plainly that no knowledge records were drafted", async () => {
    const { result } = await convert();
    expect(result.warnings.join("\n")).toContain("no KnowledgeRecords were drafted");
  });

  it("assigns Q10 the FY2027 window from its coding reference", async () => {
    const { result } = await convert();
    const q10 = result.items.find((item) => item.questionId === "NEXUS-L2-ICD-000010");
    expect(q10?.applicability).toEqual({ jurisdictions: ["US"], effectiveFrom: "2026-10-01", effectiveTo: "2027-09-30" });
  });
});

describe("the gates stay shut", () => {
  it("produces a corpus that validates", async () => {
    const { result } = await convert();
    const validated = validateKnowledgeCorpus({
      corpusId: "NEXUS-PILOT-001",
      version: "r3",
      sources: result.sources,
      contexts: result.contexts,
      concepts: result.concepts,
      items: result.items
    });
    expect(validated.success, validated.success ? "" : validated.errors.join("\n")).toBe(true);
  });

  it("leaves every item candidate, pending and unverified", async () => {
    const { result } = await convert();
    for (const item of result.items) {
      expect(item.contentStatus).toBe("candidate");
      expect(item.reviewStatus).toBe("pending");
      const verification = item.verification as { humanVerifiedBy: string | null; humanVerifiedOn: string | null };
      expect(verification.humanVerifiedBy).toBeNull();
      expect(verification.humanVerifiedOn).toBeNull();
    }
  });

  it("delivers nothing to anyone", async () => {
    const { result } = await convert();
    const validated = validateKnowledgeCorpus({
      corpusId: "NEXUS-PILOT-001",
      version: "r3",
      sources: result.sources,
      contexts: result.contexts,
      concepts: result.concepts,
      items: result.items
    });
    expect(validated.success).toBe(true);
    if (!validated.success) return;
    expect(deliverableItems(validated.data, { asOf: "2026-09-25" })).toEqual([]);
    expect(deliverableItems(validated.data, { asOf: "2027-01-01" })).toEqual([]);
  });

  it("refuses to convert an item the plan does not name", async () => {
    const { batch } = await loadBatch();
    const modalities: Record<string, Modality> = { ...MODALITIES };
    delete modalities["NEXUS-L1-PRIV-000001"];
    const result = convertPilotBatch(batch, { ...PLAN, modalities });
    expect(result.items).toHaveLength(11);
    expect(result.warnings.join("\n")).toContain("no modality in the conversion plan");
  });

  it("re-adds the human-verification flag if a batch arrives without it", async () => {
    // Every r3 item already carries the flag, so this needs a batch that does
    // not — otherwise the guard would be untested and could be removed without
    // a single test noticing.
    const { batch } = await loadBatch();
    const stripped: PilotBatch = {
      ...batch,
      items: batch.items.map((item, index) => (index === 0 ? { ...item, flags: [] } : item))
    };
    const result = convertPilotBatch(stripped, PLAN);
    const first = result.items[0]!;
    expect(first.flags as string[]).toContain("HUMAN-VERIFY-REQUIRED");
    expect(result.warnings.join("\n")).toContain("HUMAN-VERIFY-REQUIRED missing in the batch");
  });

  it("is deterministic: the same batch and plan convert identically", async () => {
    const { batch } = await loadBatch();
    expect(JSON.stringify(convertPilotBatch(batch, PLAN))).toBe(JSON.stringify(convertPilotBatch(batch, PLAN)));
  });
});
