import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { QUESTION_TYPES, isProductionEligible } from "./schema.js";
import { createQuestionBankRepository } from "./loader.js";
import { validateQuestionBank } from "./validate.js";

/**
 * Batch 002 (NEXUS-SCRIBE-BATCH-002): ingestion validation, not integration.
 *
 * Pins the authored artifact byte for byte and records what the *current*
 * strict Question Bank schema does with it. The adapter is local on purpose,
 * as in the Pilot 001 tests: it is a compatibility probe, not an import path.
 * Nothing here promotes, repairs, or remaps content.
 */

const BATCH = fileURLToPath(new URL("./__fixtures__/nexus-scribe-batch-002.candidates.json", import.meta.url));
const PILOT_R3 = fileURLToPath(new URL("./__fixtures__/nexus-pilot-batch-001.candidates.r3.json", import.meta.url));
const SHA256 = "c17014208539db87cce6b26b81071a13d71db4e769664cf64c9d12cd1ca0f7aa";

// Owner-approved conceptual ladder mapping, restated from the handoff.
const TIER_BY_LEVEL: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 5 };

const raw = readFileSync(BATCH, "utf-8");
const batch = JSON.parse(raw);
const items: any[] = batch.items;
const short = (id: string) => id.replace("NEXUS-SCRIBE-", "");

function toBank(b: any, { dropTier }: { dropTier: boolean }) {
  return {
    bankId: b.batchId,
    version: String(b.revision),
    sources: b.sources,
    questions: b.items.map(({ id, trainingTier, ...rest }: any) =>
      dropTier ? { questionId: id, ...rest } : { questionId: id, trainingTier, ...rest }
    )
  };
}
const compatible = (bank: any) => ({
  ...bank,
  questions: bank.questions.filter((q: any) => (QUESTION_TYPES as readonly string[]).includes(q.questionType))
});

describe("batch 002: integrity", () => {
  it("is the pinned artifact, byte for byte", () => {
    expect(createHash("sha256").update(raw, "utf-8").digest("hex")).toBe(SHA256);
    expect(batch.batchId).toBe("NEXUS-SCRIBE-BATCH-002");
    expect(batch.revision).toBe(1);
  });

  it("holds exactly 30 records, five at each of Levels 1-6", () => {
    expect(items).toHaveLength(30);
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(items.filter((i) => i.difficultyLevel === level), `L${level}`).toHaveLength(5);
    }
  });

  it("keeps Levels 5 and 6 distinct while trainingTier follows the approved table", () => {
    for (const i of items) expect(i.trainingTier, i.id).toBe(TIER_BY_LEVEL[i.difficultyLevel]);
    // Tier 5 is shared; the canonical level is what keeps them apart.
    expect(new Set(items.filter((i) => i.trainingTier === 5).map((i) => i.difficultyLevel))).toEqual(new Set([5, 6]));
    for (const i of items) expect(i.id, "id level hint agrees with difficultyLevel").toContain(`-L${i.difficultyLevel}-`);
  });

  it("has unique ids, none colliding with Pilot 001 r3", () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(30);
    const pilot = JSON.parse(readFileSync(PILOT_R3, "utf-8"));
    expect(pilot.items.filter((p: any) => ids.includes(p.id))).toEqual([]);
  });

  it("reuses variant groups exactly as authored (20 groups, 7 multi-item)", () => {
    const groups = new Map<string, string[]>();
    for (const i of items) groups.set(i.variantGroup, [...(groups.get(i.variantGroup) ?? []), short(i.id)]);
    expect(groups.size).toBe(20);
    const multi = Object.fromEntries([...groups].filter(([, v]) => v.length > 1));
    expect(multi).toEqual({
      "SCRIBE-ACCURACY-PRINCIPLE": ["L1-000002", "L2-000005"],
      "PATIENT-ID-TWO-IDENTIFIERS": ["L1-000004", "L2-000002"],
      "SCRIBE-SCOPE-BOUNDARY": ["L1-000005", "L4-000005", "L6-000003"],
      "SCRIBE-INDEPENDENT-LOGIN": ["L2-000001", "L3-000004", "L4-000002", "L5-000004"],
      "SCRIBE-PENDING-ORDERS": ["L2-000004", "L3-000003"],
      "SCRIBE-INTEGRATED-VIOLATIONS": ["L5-000001", "L6-000001"],
      "SCRIBE-SYSTEMIC-POLICY-GAP": ["L5-000002", "L6-000002"]
    });
  });

  it("every source ref resolves, and every item carries a locator", () => {
    for (const i of items) {
      expect(batch.sources[i.source.ref], `${i.id} -> ${i.source.ref}`).toBeDefined();
      expect(i.source.locator.length, i.id).toBeGreaterThan(0);
    }
  });
});

describe("batch 002: review state is preserved, not promoted", () => {
  it("is 30 candidate / 30 pending, with no human verifier recorded", () => {
    for (const i of items) {
      expect(i.contentStatus, i.id).toBe("candidate");
      expect(i.reviewStatus, i.id).toBe("pending");
      expect(i.verification.humanVerificationRequired, i.id).toBe(true);
      expect(i.verification.humanVerifiedBy, i.id).toBeNull();
      expect(i.verification.humanVerifiedOn, i.id).toBeNull();
      expect(i.flags, i.id).toContain("HUMAN-VERIFY-REQUIRED");
    }
  });

  it("carries SCRIBE-SCOPE-REVIEW on exactly ten records (the JSON, not the prose report)", () => {
    const scope = items.filter((i) => i.flags.some((f: string) => f.includes("SCRIBE-SCOPE-REVIEW"))).map((i) => short(i.id));
    expect(scope).toEqual([
      "L3-000001", "L3-000005", "L5-000001", "L5-000002", "L5-000004",
      "L6-000001", "L6-000002", "L6-000003", "L6-000004", "L6-000005"
    ]);
    // L6-000005 packs two flags into one string; recorded, not repaired.
    const l65 = items.find((i) => i.id === "NEXUS-SCRIBE-L6-000005");
    expect(l65.flags[1].startsWith("CLINICAL-REVIEW-NOT-REQUIRED; SCRIBE-SCOPE-REVIEW:")).toBe(true);
  });

  it("records MULTI-SOURCE-SYNTHESIS-NOT-DIRECTLY-STATED as a locatorConfidence on one record, and as no flag", () => {
    const multi = items.filter((i) => i.verification.locatorConfidence === "MULTI-SOURCE-SYNTHESIS-NOT-DIRECTLY-STATED");
    expect(multi.map((i) => short(i.id))).toEqual(["L6-000005"]);
    expect(items.filter((i) => i.flags.some((f: string) => f.includes("MULTI-SOURCE-SYNTHESIS")))).toEqual([]);
    const extension = items.filter((i) => i.verification.locatorConfidence === "REASONED-EXTENSION-OF-SOURCE");
    expect(extension.map((i) => short(i.id))).toEqual(["L5-000004"]);
  });
});

describe("batch 002: answer-key structure", () => {
  it("balances positions 8/8/7/7, by strict a-b-c-d rotation", () => {
    const keys = items.map((i) => i.correctChoiceId).join("");
    expect(keys).toBe("abcdabcdabcdabcdabcdabcdabcdab");
    expect([..."abcd"].map((k) => [...keys].filter((c) => c === k).length)).toEqual([8, 8, 7, 7]);
  });

  it("never makes the correct choice the longest option (inverse bias recorded)", () => {
    const uniquelyShortest: string[] = [];
    for (const i of items) {
      const correct = i.choices.find((c: any) => c.id === i.correctChoiceId).text.length;
      const others = i.choices.filter((c: any) => c.id !== i.correctChoiceId).map((c: any) => c.text.length);
      expect(correct, `${i.id} correct is at least tied-longest`).toBeLessThan(Math.max(...others));
      if (correct < Math.min(...others)) uniquelyShortest.push(short(i.id));
    }
    expect(uniquelyShortest).toEqual(["L1-000004", "L1-000005", "L2-000005", "L4-000001", "L5-000001", "L5-000003", "L6-000005"]);
  });
});

describe("batch 002: current repository compatibility", () => {
  it("is rejected as authored: batch envelope is not a bank", () => {
    expect(validateQuestionBank(batch).success).toBe(false);
  });

  it("is rejected by the strict schema for trainingTier (30) and out-of-enum questionType (13)", () => {
    const result = validateQuestionBank(toBank(batch, { dropTier: false }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.filter((e) => e.includes("'trainingTier'"))).toHaveLength(30);
    const typeErrors = result.errors.filter((e) => e.includes("questionType"));
    expect(typeErrors).toHaveLength(13);
  });

  it("names exactly which 13 items the closed questionType enum excludes", () => {
    const outside = items.filter((i) => !(QUESTION_TYPES as readonly string[]).includes(i.questionType));
    expect(Object.fromEntries(outside.map((i) => [short(i.id), i.questionType]))).toEqual({
      "L2-000001": "application", "L2-000002": "application", "L2-000003": "application",
      "L2-000004": "next-best-action", "L2-000005": "application", "L3-000002": "next-best-action",
      "L3-000003": "error-identification", "L3-000005": "prioritization", "L4-000002": "error-identification",
      "L4-000003": "next-best-action", "L4-000004": "prioritization", "L6-000004": "next-best-action",
      "L6-000005": "prioritization"
    });
  });

  it("loads the 17 enum-compatible items alongside Pilot r3 with nothing production-eligible", () => {
    const pilot = JSON.parse(readFileSync(PILOT_R3, "utf-8"));
    const pilotBank = { bankId: pilot.batchId, version: String(pilot.revision), sources: pilot.sources,
      questions: pilot.items.map(({ id, ...rest }: any) => ({ questionId: id, ...rest })) };
    const result = createQuestionBankRepository([
      { file: "b002.json", contents: JSON.stringify(compatible(toBank(batch, { dropTier: true }))) },
      { file: "p001r3.json", contents: JSON.stringify(pilotBank) }
    ]);
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
    if (!result.success) return;
    expect(result.repository.size).toBe(29);
    expect(result.repository.getProductionEligible()).toEqual([]);
    expect(result.repository.getAll().filter(isProductionEligible)).toEqual([]);
  });

  it("loads deterministically, independent of file order", () => {
    const b = JSON.stringify(compatible(toBank(batch, { dropTier: true })));
    const one = createQuestionBankRepository([{ file: "a.json", contents: b }]);
    const two = createQuestionBankRepository([{ file: "a.json", contents: b }]);
    expect(one.success && two.success).toBe(true);
    if (!one.success || !two.success) return;
    expect(one.repository.getAll().map((q) => q.questionId)).toEqual(two.repository.getAll().map((q) => q.questionId));
  });
});

describe("batch 002: malformed records are rejected", () => {
  const base = compatible(toBank(batch, { dropTier: true }));
  const mutate = (fn: (q: any) => any) => ({ ...base, questions: [fn(structuredClone(base.questions[0])), ...base.questions.slice(1)] });
  const fails = (bank: any, pattern: RegExp) => {
    const r = validateQuestionBank(bank);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.join("\n")).toMatch(pattern);
  };

  it("rejects promotion without a human verifier", () =>
    fails(mutate((q) => ({ ...q, contentStatus: "production-eligible", reviewStatus: "approved" })), /human verification/));
  it("rejects a dangling correct answer", () => fails(mutate((q) => ({ ...q, correctChoiceId: "z" })), /does not match any choice/));
  it("rejects a dangling source ref", () => fails(mutate((q) => ({ ...q, source: { ref: "NOPE", locator: "x" } })), /not defined/));
  it("rejects an unknown field by name instead of stripping it", () => fails(mutate((q) => ({ ...q, trainingTier: 1 })), /trainingTier/));
  it("rejects a duplicate id", () =>
    fails({ ...base, questions: [...base.questions, base.questions[0]] }, /Duplicate question id/));
  it("rejects an out-of-scale difficulty", () => fails(mutate((q) => ({ ...q, difficultyLevel: 7 })), /difficultyLevel/));
});

