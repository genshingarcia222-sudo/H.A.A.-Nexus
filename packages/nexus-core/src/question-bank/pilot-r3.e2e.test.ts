import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isProductionEligible } from "./schema.js";
import { createQuestionBankRepository } from "./loader.js";
import { validateQuestionBank } from "./validate.js";

/**
 * Pilot Batch 001 revision 3 — the source-corrected successor to the frozen r2
 * baseline, pinned here so its safeguards are enforced by the suite rather than
 * only by a one-off script run.
 *
 * r3 corrected wording and provenance against retrieved HHS and CMS/NCHS
 * documents. That is **machine** verification. It is not the human gate:
 * `schema.ts` reserves `humanVerifiedBy`/`humanVerifiedOn` for a person who
 * opened the cited document, so every item must still be candidate-only and
 * none may be production-eligible. These tests fail if that changes here.
 *
 * The r2 fixture and its manifest hash are untouched; this file only reads r2
 * to prove r3 did not move an answer key.
 *
 * As in the r2 test, the pilot-to-bank adapter is deliberately local: it is a
 * compatibility demonstration, not a supported import path.
 */

const R3 = fileURLToPath(new URL("./__fixtures__/nexus-pilot-batch-001.candidates.r3.json", import.meta.url));
const R2 = fileURLToPath(new URL("./__fixtures__/nexus-pilot-batch-001.candidates.r2.json", import.meta.url));
const R3_SHA256 = "8d845560e94cb3ab275fb48daa7ce1623a584731c8a064a4707766fb03038791";

interface PilotChoice {
  id: string;
  text: string;
}

interface PilotItem extends Record<string, unknown> {
  id: string;
  choices: PilotChoice[];
  correctChoiceId: string;
  flags: string[];
  codingReference?: Record<string, unknown>;
}

interface PilotBatch extends Record<string, unknown> {
  batchId: string;
  revision: number;
  sources: Record<string, unknown>;
  items: PilotItem[];
}

async function load(path: string): Promise<{ raw: string; batch: PilotBatch }> {
  const raw = await readFile(path, "utf-8");
  return { raw, batch: JSON.parse(raw) as PilotBatch };
}

function toQuestionBank(batch: PilotBatch) {
  return {
    bankId: batch.batchId,
    version: String(batch.revision),
    sources: batch.sources,
    questions: batch.items.map(({ id, ...rest }) => ({ questionId: id, ...rest }))
  };
}

describe("pilot 001 r3: integrity against r2", () => {
  it("is the pinned revision-3 artifact, byte for byte", async () => {
    const { raw, batch } = await load(R3);
    expect(createHash("sha256").update(raw, "utf-8").digest("hex")).toBe(R3_SHA256);
    expect(batch.revision).toBe(3);
  });

  it("keeps the same 12 items and moves no answer key", async () => {
    const r2 = (await load(R2)).batch;
    const r3 = (await load(R3)).batch;
    expect(r3.items.map((i) => i.id)).toEqual(r2.items.map((i) => i.id));
    expect(r3.items.map((i) => i.correctChoiceId)).toEqual(r2.items.map((i) => i.correctChoiceId));
    expect(r3.items.map((i) => i.correctChoiceId).join("")).toBe("abcdabcdabcd");
  });

  it("uses exactly the batch and item fields r2 did", async () => {
    const r2 = (await load(R2)).batch;
    const r3 = (await load(R3)).batch;
    expect(Object.keys(r3).sort()).toEqual(Object.keys(r2).sort());
    const keys = (b: PilotBatch) => [...new Set(b.items.flatMap((i) => Object.keys(i)))].sort();
    expect(keys(r3)).toEqual(keys(r2));
  });

  it("drops no review flag that r2 raised", async () => {
    // A flag is a warning to the human reviewer. Revision 3's first pass lost
    // one silently; this pins the rule that r3 may add or reword warnings but
    // never remove a flag kind.
    const r2 = (await load(R2)).batch;
    const r3 = (await load(R3)).batch;
    const kind = (flag: string) => (flag.split(/[:;]/)[0] ?? flag).trim();
    for (const [index, before] of r2.items.entries()) {
      const after = new Set((r3.items[index]?.flags ?? []).map(kind));
      for (const flag of before.flags) {
        expect(after.has(kind(flag)), `${before.id} lost flag ${kind(flag)}`).toBe(true);
      }
    }
  });
});

describe("pilot 001 r3: structural safeguards", () => {
  it("never makes the correct choice the uniquely longest option", async () => {
    const { batch } = await load(R3);
    for (const item of batch.items) {
      const correct = item.choices.find((c) => c.id === item.correctChoiceId);
      expect(correct, `${item.id} has no correct choice`).toBeDefined();
      const others = item.choices.filter((c) => c.id !== item.correctChoiceId).map((c) => c.text.length);
      expect(correct!.text.length, `${item.id}: correct choice is the longest option`).toBeLessThanOrEqual(Math.max(...others));
    }
  });

  it("carries Q10's FY2027 period as a dated U.S. ICD-10-CM release", async () => {
    const { batch } = await load(R3);
    const q10 = batch.items.find((i) => i.id === "NEXUS-L2-ICD-000010");
    expect(q10?.codingReference).toMatchObject({
      system: "ICD-10-CM",
      jurisdiction: "US",
      release: "FY2027",
      effectiveFrom: "2026-10-01",
      effectiveTo: "2027-09-30"
    });
  });
});

describe("pilot 001 r3: the gates stay closed", () => {
  it("validates as a question bank with no field left over", async () => {
    const { batch } = await load(R3);
    const result = validateQuestionBank(toQuestionBank(batch));
    expect(result.success, result.success ? "" : `r3 cannot be represented:\n  ${result.errors.join("\n  ")}`).toBe(true);
  });

  it("records machine verification without claiming a human", async () => {
    const { batch } = await load(R3);
    const result = validateQuestionBank(toQuestionBank(batch));
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const q of result.data.questions) {
      expect(q.contentStatus, q.questionId).toBe("candidate");
      expect(q.reviewStatus, q.questionId).toBe("pending");
      expect(q.verification?.humanVerificationRequired, q.questionId).toBe(true);
      expect(q.verification?.humanVerifiedBy, `${q.questionId} claims a human verifier`).toBeNull();
      expect(q.verification?.humanVerifiedOn, `${q.questionId} claims a verification date`).toBeNull();
      expect(q.flags, q.questionId).toContain("HUMAN-VERIFY-REQUIRED");
    }
    expect(result.data.questions.filter(isProductionEligible)).toEqual([]);
  });

  it("loads through the real loader with nothing production-eligible", async () => {
    const { batch } = await load(R3);
    const result = createQuestionBankRepository([
      { file: "nexus-pilot-batch-001.candidates.r3.json", contents: JSON.stringify(toQuestionBank(batch)) }
    ]);
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
    if (!result.success) return;
    expect(result.repository.size).toBe(12);
    expect(result.repository.getProductionEligible()).toEqual([]);
  });

  it("rejects r3 if someone promotes an item without a human verifier", async () => {
    // The eligibility guard, exercised on real content: promoting an item past
    // candidate while the verification record is still empty must fail.
    const { batch } = await load(R3);
    const bank = toQuestionBank(batch);
    const [first, ...rest] = bank.questions;
    const result = validateQuestionBank({
      ...bank,
      questions: [{ ...first, contentStatus: "approved", reviewStatus: "approved" }, ...rest]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toMatch(/human verification/);
  });
});
