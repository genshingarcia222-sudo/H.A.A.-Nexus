import { describe, expect, it } from "vitest";
import { AssessmentItemSchema, MODALITIES, requiresCaseContext } from "./item.js";
import { TrainingQuestionSchema } from "../question-bank/schema.js";

/**
 * D12 work package 2 — the assessment item.
 *
 * The item extends the D11 question. Two things are pinned here: the inherited
 * rules still fire (they are applied, not copied), and every modality's
 * required structure is enforced.
 */

const base = {
  questionId: "NEXUS-L2-PRIV-000004",
  family: "ITEM" as const,
  revision: 1,
  domain: "Medical Scribing",
  skillArea: "Privacy & Confidentiality",
  difficultyLevel: 2 as const,
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

const parse = (overrides: Record<string, unknown> = {}) => AssessmentItemSchema.safeParse({ ...base, ...overrides });

describe("the item extends the D11 question rather than replacing it", () => {
  it("accepts an item and defaults its new lists", () => {
    const result = parse();
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.responseFormat).toBe("SINGLE_BEST_ANSWER");
    expect(result.data.knowledgeRefs).toEqual([]);
    expect(result.data.collections).toEqual([]);
    expect(result.data.additionalEvidence).toEqual([]);
  });

  it("keeps every inherited field readable under its original name", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.questionId).toBe(base.questionId);
    expect(result.data.learningObjective).toBe(base.learningObjective);
    expect(result.data.correctChoiceId).toBe("a");
    expect(result.data.variantGroup).toBeUndefined();
  });

  it("still applies the inherited correct-answer rule", () => {
    const result = parse({ correctChoiceId: "z" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain("does not match any choice id");
  });

  it("still applies the inherited duplicate-choice-id rule", () => {
    const result = parse({
      choices: [
        { id: "a", text: "one" },
        { id: "a", text: "two" },
        { id: "c", text: "three" }
      ]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain("Duplicate choice id");
  });

  it("still applies the inherited human-verification gate above candidate", () => {
    const result = parse({ contentStatus: "approved", reviewStatus: "approved" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain("requires a recorded human verification");
  });

  it("leaves the plain question schema untouched for existing bank content", () => {
    // An existing bank record has no modality, family or provenance, and must
    // keep validating exactly as before D12.
    const { family, revision, modality, provenance, ...bankShaped } = base;
    expect(TrainingQuestionSchema.safeParse(bankShaped).success).toBe(true);
  });

  it("rejects an unknown field by name", () => {
    const result = parse({ tier: "pro" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain("tier");
  });
});

describe("choices", () => {
  it("requires three to five", () => {
    expect(parse({ choices: base.choices.slice(0, 2), correctChoiceId: "a" }).success).toBe(false);
    expect(parse({ choices: base.choices.slice(0, 3), correctChoiceId: "a" }).success).toBe(true);
    expect(
      parse({
        choices: [...base.choices, { id: "e", text: "five" }, { id: "f", text: "six" }],
        correctChoiceId: "a"
      }).success
    ).toBe(false);
  });
});

describe("modality decides what structure an item must carry", () => {
  it("covers all seven modalities", () => {
    expect(MODALITIES).toHaveLength(7);
  });

  it("forbids a case context on a direct-knowledge item", () => {
    expect(parse({ contextRef: "NEXUS-CX-PRIV-000001@1" }).success).toBe(false);
  });

  it("requires a case context where the modality is about a case", () => {
    for (const modality of MODALITIES) {
      if (!requiresCaseContext(modality)) continue;
      const result = parse({ modality });
      expect(result.success, `${modality} should require a contextRef`).toBe(false);
    }
  });

  it("requires the context reference to be pinned to a revision", () => {
    const unpinned = parse({ modality: "SITUATIONAL", contextRef: "NEXUS-CX-PRIV-000001" });
    expect(unpinned.success).toBe(false);
    if (unpinned.success) return;
    expect(JSON.stringify(unpinned.error.issues)).toContain("must be pinned");

    expect(parse({ modality: "SITUATIONAL", contextRef: "NEXUS-CX-PRIV-000001@2" }).success).toBe(true);
  });

  it("requires a SOAP task", () => {
    expect(parse({ modality: "SOAP", contextRef: "NEXUS-CX-ICD-000001@1" }).success).toBe(false);
    expect(
      parse({
        modality: "SOAP",
        contextRef: "NEXUS-CX-ICD-000001@1",
        modalityDetail: { soapTask: "IDENTIFY_SECTION" }
      }).success
    ).toBe(true);
  });

  it("requires an error domain", () => {
    expect(parse({ modality: "ERROR_DETECTION", contextRef: "NEXUS-CX-ICD-000001@1" }).success).toBe(false);
    expect(
      parse({
        modality: "ERROR_DETECTION",
        contextRef: "NEXUS-CX-ICD-000001@1",
        modalityDetail: { errorDomain: "DOCUMENTATION" }
      }).success
    ).toBe(true);
  });

  it("requires comparison criteria", () => {
    expect(parse({ modality: "COMPARATIVE_DECISION" }).success).toBe(false);
    expect(parse({ modality: "COMPARATIVE_DECISION", modalityDetail: { criteria: ["applicability"] } }).success).toBe(true);
  });

  it("requires both ends of a transformation", () => {
    expect(
      parse({ modality: "TRANSFORMATION", contextRef: "NEXUS-CX-ICD-000001@1", modalityDetail: { from: "NARRATIVE" } })
        .success
    ).toBe(false);
    expect(
      parse({
        modality: "TRANSFORMATION",
        contextRef: "NEXUS-CX-ICD-000001@1",
        modalityDetail: { from: "NARRATIVE", to: "SOAP" }
      }).success
    ).toBe(true);
  });

  describe("workflow", () => {
    const steps = [
      { stepId: "s1", text: "Locate the term in the Alphabetic Index" },
      { stepId: "s2", text: "Verify the code in the Tabular List" },
      { stepId: "s3", text: "Apply any instructional notes" }
    ];

    it("requires at least three steps, a canonical order and a question position", () => {
      expect(parse({ modality: "WORKFLOW", modalityDetail: { steps: steps.slice(0, 2) } }).success).toBe(false);
      expect(
        parse({
          modality: "WORKFLOW",
          questionType: "workflow-sequencing",
          modalityDetail: { steps, canonicalOrder: ["s1", "s2", "s3"], askedPosition: "NEXT" }
        }).success
      ).toBe(true);
    });

    it("refuses an order that is not a permutation of the steps", () => {
      const result = parse({
        modality: "WORKFLOW",
        modalityDetail: { steps, canonicalOrder: ["s1", "s2"], askedPosition: "ORDER" }
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(JSON.stringify(result.error.issues)).toContain("permutation");
    });

    it("refuses duplicate step ids", () => {
      const result = parse({
        modality: "WORKFLOW",
        modalityDetail: {
          steps: [steps[0]!, steps[0]!, steps[1]!],
          canonicalOrder: ["s1", "s2"],
          askedPosition: "ORDER"
        }
      });
      expect(result.success).toBe(false);
    });
  });

  it("requires a context before segment targets can mean anything", () => {
    expect(parse({ targetSegmentIds: ["S1"] }).success).toBe(false);
  });
});

describe("dates may not disagree with each other", () => {
  it("refuses validUntil that contradicts the applicability window", () => {
    const result = parse({
      validUntil: "2027-09-30",
      applicability: { jurisdictions: ["US"], effectiveFrom: "2026-10-01", effectiveTo: "2028-09-30" }
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain("disagrees");
  });

  it("accepts the FY2027 window stated consistently three ways", () => {
    const result = parse({
      domain: "ICD",
      validUntil: "2027-09-30",
      applicability: { jurisdictions: ["US"], effectiveFrom: "2026-10-01", effectiveTo: "2027-09-30" },
      codingReference: {
        system: "ICD-10-CM",
        jurisdiction: "US",
        release: "FY2027",
        effectiveFrom: "2026-10-01",
        effectiveTo: "2027-09-30",
        codes: []
      }
    });
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
  });

  it("refuses a coding release that contradicts the applicability window", () => {
    const result = parse({
      domain: "ICD",
      applicability: { jurisdictions: ["US"], effectiveFrom: "2026-10-01", effectiveTo: "2027-09-30" },
      codingReference: {
        system: "ICD-10-CM",
        jurisdiction: "US",
        release: "FY2026",
        effectiveFrom: "2025-10-01",
        effectiveTo: "2026-09-30",
        codes: []
      }
    });
    expect(result.success).toBe(false);
  });
});
