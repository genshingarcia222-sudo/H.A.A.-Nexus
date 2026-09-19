import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isProductionEligible } from "./schema.js";
import { validateQuestionBank } from "./validate.js";

/**
 * Pilot Batch 001 (revision 2) as a compatibility fixture — and nothing else.
 *
 * This proves one claim: the canonical Question Bank model can carry the pilot's
 * content **without losing a field**. It is the evidence that the schema was
 * designed against real authored content rather than against a guess.
 *
 * What this file is emphatically not:
 * - It does not import the pilot as learner-facing content. The fixture lives
 *   beside the tests, not under `content/`, and no loader reads it.
 * - It does not promote anything. All 12 items are CANDIDATE and
 *   SOURCE-VERIFICATION-PENDING, and the tests below fail if that ever changes
 *   here.
 * - It does not verify a single medical, legal or coding claim. Source
 *   verification is a human gate that stands at 0 of 12, and no code can move it.
 *
 * The file is a byte-identical copy of the frozen revision-2 baseline. Its
 * SHA-256 is asserted against the value in the handoff manifest, so a silent
 * edit to the fixture fails loudly rather than quietly changing what "the pilot"
 * means.
 *
 * The pilot's own field names are an authoring proposal, not this schema. The
 * adapter below is deliberately local to this test: mapping pilot JSON into the
 * bank is a compatibility demonstration, not a supported import path, and
 * building it into the package would be the content pipeline this checkpoint
 * was told not to create.
 */

const FIXTURE = fileURLToPath(new URL("./__fixtures__/nexus-pilot-batch-001.candidates.r2.json", import.meta.url));
const MANIFEST_SHA256 = "05fa24d093b0f4139cf56490fe573ac480e8ad2bf15ae67978d8efd0dd5aaf3d";

/** Pilot item key -> canonical question field. `id` is the only rename. */
const ITEM_FIELD_MAP: Record<string, string> = {
  id: "questionId",
  domain: "domain",
  skillArea: "skillArea",
  difficultyLevel: "difficultyLevel",
  questionType: "questionType",
  learningObjective: "learningObjective",
  question: "question",
  choices: "choices",
  correctChoiceId: "correctChoiceId",
  rationale: "rationale",
  source: "source",
  codingReference: "codingReference",
  variantGroup: "variantGroup",
  contentStatus: "contentStatus",
  reviewStatus: "reviewStatus",
  validUntil: "validUntil",
  flags: "flags",
  verification: "verification"
};

/** Batch-level keys the canonical bank carries. */
const BATCH_FIELDS_CARRIED: Record<string, string> = {
  batchId: "bankId",
  revision: "version",
  sources: "sources",
  items: "questions"
};

/**
 * Batch-level keys the canonical question record does **not** carry — reported
 * here as the exact, complete gap rather than dropped in silence.
 *
 * Every one of them describes the *authoring batch* (how this set of candidates
 * was produced and what is still unverified about it), not the questions. A
 * question record that is reusable across lessons, remediation and Assessment
 * has no business carrying a note about which fetch tool produced an extract in
 * September 2026. They stay with the batch document, which remains the
 * authoritative record for the human review gate.
 */
const BATCH_FIELDS_NOT_CARRIED = [
  "createdOn",
  "schemaStatus",
  "difficultyScale",
  "icdSystemPolicy",
  "sourceVerificationMethod",
  "versionNote",
  "blockedTopics",
  "batchSummary",
  "revisionNotes"
];

interface PilotItem extends Record<string, unknown> {
  id: string;
  contentStatus: string;
  reviewStatus: string;
}

interface PilotBatch extends Record<string, unknown> {
  batchId: string;
  revision: number;
  sources: Record<string, unknown>;
  items: PilotItem[];
}

async function loadPilot(): Promise<{ raw: string; batch: PilotBatch }> {
  const raw = await readFile(FIXTURE, "utf-8");
  return { raw, batch: JSON.parse(raw) as PilotBatch };
}

/** Pilot batch -> canonical bank. Renames `id`; passes everything else through. */
function toQuestionBank(batch: PilotBatch) {
  return {
    bankId: batch.batchId,
    version: String(batch.revision),
    sources: batch.sources,
    questions: batch.items.map(({ id, ...rest }) => ({ questionId: id, ...rest }))
  };
}

describe("pilot 001 r2: the canonical model can represent real authored content", () => {
  it("is the frozen revision-2 baseline, byte for byte", async () => {
    const { raw } = await loadPilot();
    const hash = createHash("sha256").update(raw, "utf-8").digest("hex");
    expect(hash, "the pilot fixture no longer matches the hash recorded in the handoff manifest").toBe(MANIFEST_SHA256);
  });

  it("validates as a question bank with no field left over", async () => {
    const { batch } = await loadPilot();
    const result = validateQuestionBank(toQuestionBank(batch));

    // A strict schema means an unrepresentable field cannot pass quietly: if
    // the pilot carried anything the model has no home for, it appears here as
    // an "unrecognized key" error naming the exact field.
    expect(result.success, result.success ? "" : `pilot cannot be represented:\n  ${result.errors.join("\n  ")}`).toBe(true);
    if (!result.success) return;

    expect(result.data.questions).toHaveLength(12);
    expect(result.data.bankId).toBe("NEXUS-PILOT-001");
    expect(result.data.version).toBe("2");
    expect(Object.keys(result.data.sources).sort()).toEqual(Object.keys(batch.sources).sort());
  });

  it("preserves every canonical field of every item", async () => {
    const { batch } = await loadPilot();
    const result = validateQuestionBank(toQuestionBank(batch));
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const item of batch.items) {
      const parsed = result.data.questions.find((q) => q.questionId === item.id);
      expect(parsed, `item ${item.id} did not survive validation`).toBeDefined();
      if (!parsed) continue;

      const asRecord = parsed as unknown as Record<string, unknown>;
      for (const [pilotKey, bankKey] of Object.entries(ITEM_FIELD_MAP)) {
        if (!(pilotKey in item)) continue;
        expect(asRecord[bankKey], `${item.id}.${pilotKey} was not preserved as ${bankKey}`).toEqual(item[pilotKey]);
      }
    }
  });

  it("names the exact gap: no pilot field is silently dropped", async () => {
    const { batch } = await loadPilot();

    // Item level: every key the pilot uses has a canonical home. A new pilot
    // field with nowhere to go fails here by name.
    for (const item of batch.items) {
      for (const key of Object.keys(item)) {
        expect(ITEM_FIELD_MAP, `pilot item field "${key}" has no canonical mapping`).toHaveProperty(key);
      }
    }

    // Batch level: the container keys split into exactly two sets, carried and
    // not carried, with nothing unaccounted for.
    expect(Object.keys(batch).sort()).toEqual(
      [...Object.keys(BATCH_FIELDS_CARRIED), ...BATCH_FIELDS_NOT_CARRIED].sort()
    );
  });
});

describe("pilot 001 r2: the gates stay closed", () => {
  it("keeps all 12 items candidate-only, with source verification pending", async () => {
    const { batch } = await loadPilot();
    const result = validateQuestionBank(toQuestionBank(batch));
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const question of result.data.questions) {
      expect(question.contentStatus, `${question.questionId} is no longer a candidate`).toBe("candidate");
      expect(question.reviewStatus, `${question.questionId} is no longer pending review`).toBe("pending");
      expect(question.verification?.humanVerifiedBy, `${question.questionId} claims a human verifier`).toBeNull();
      expect(question.verification?.humanVerifiedOn, `${question.questionId} claims a verification date`).toBeNull();
    }
  });

  it("makes none of them production-eligible", async () => {
    const { batch } = await loadPilot();
    const result = validateQuestionBank(toQuestionBank(batch));
    expect(result.success).toBe(true);
    if (!result.success) return;

    const eligible = result.data.questions.filter(isProductionEligible);
    expect(eligible.map((q) => q.questionId)).toEqual([]);
  });

  it("does not live anywhere a loader or a content test would find it", async () => {
    // The pilot is a fixture next to this test. The scanned content paths are
    // content/lessons (lesson content-QA), content/incoming (scenario intake)
    // and content/scenarios (preflight + scenario content-QA); the desktop app
    // discovers content only by explicit static import. A file here is reachable
    // by this test and by nothing else.
    expect(FIXTURE).toMatch(/__fixtures__/);
    expect(FIXTURE).not.toMatch(/[/\\]content[/\\]/);
  });
});
