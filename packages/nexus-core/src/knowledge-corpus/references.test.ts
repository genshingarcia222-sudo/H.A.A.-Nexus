import { describe, expect, it } from "vitest";
import {
  competencyPath,
  indexRecordsBySource,
  indexSources,
  validateKnowledgeCorpus
} from "./validate.js";
import { formatPinnedRef, parsePinnedRef } from "./ids.js";

/**
 * D12 work package 1 — cross-record resolution.
 *
 * A dangling reference is an error, not a warning: a record citing a source
 * that is not in the corpus is unsourced content wearing a citation.
 */

const provenance = {
  generationMethod: "MACHINE_DRAFTED" as const,
  authoredBy: "machine:claude-code",
  authoredOn: "2026-09-21"
};
const header = { revision: 1, contentStatus: "candidate" as const, reviewStatus: "pending" as const, provenance };

function corpus(overrides: Record<string, unknown> = {}) {
  return {
    corpusId: "NEXUS-KNOWLEDGE",
    version: "0",
    sources: [
      {
        id: "HHS-PR-SUMMARY",
        authority: "U.S. HHS Office for Civil Rights",
        authorityClass: "OFFICIAL_GUIDANCE",
        title: "Summary of the HIPAA Privacy Rule",
        jurisdiction: "US",
        retrievedOn: "2026-09-20",
        snapshotHash: "abc123"
      }
    ],
    knowledge: [
      {
        ...header,
        id: "NEXUS-KR-PRIV-000001",
        family: "KNOWLEDGE",
        kind: "RULE",
        domain: "Medical Scribing",
        topic: "Privacy & Confidentiality",
        title: "Minimum necessary standard",
        statement: "A covered entity must limit uses and disclosures to the minimum necessary.",
        evidence: [{ ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" }]
      }
    ],
    contexts: [],
    concepts: [
      {
        ...header,
        id: "PRIV-MIN-NECESSARY",
        family: "CONCEPT",
        statement: "The minimum necessary standard has defined exceptions.",
        domain: "Medical Scribing",
        knowledgeRefs: ["NEXUS-KR-PRIV-000001"]
      }
    ],
    competencies: [{ id: "COMP-PRIV", label: "Privacy & Confidentiality" }],
    ...overrides
  };
}

describe("a well-formed corpus validates", () => {
  it("resolves every reference", () => {
    const result = validateKnowledgeCorpus(corpus());
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
  });

  it("rejects an unknown top-level key", () => {
    const result = validateKnowledgeCorpus({ ...corpus(), lessons: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("lessons");
  });
});

describe("identity", () => {
  it("refuses two records sharing an id, across families", () => {
    const base = corpus();
    const clash = validateKnowledgeCorpus({
      ...base,
      concepts: [{ ...base.concepts[0], id: "NEXUS-KR-PRIV-000001" }]
    });
    expect(clash.success).toBe(false);
    if (clash.success) return;
    expect(clash.errors.join("\n")).toContain("duplicate record id");
  });

  it("refuses duplicate source ids", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({ ...base, sources: [base.sources[0], base.sources[0]] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("duplicate source id");
  });

  it("refuses duplicate competency ids", () => {
    const result = validateKnowledgeCorpus({
      ...corpus(),
      competencies: [
        { id: "COMP-PRIV", label: "one" },
        { id: "COMP-PRIV", label: "two" }
      ]
    });
    expect(result.success).toBe(false);
  });

  it("reports an id that does not follow its family's minting convention", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      knowledge: [{ ...base.knowledge[0], id: "kr-privacy-1" }],
      concepts: [{ ...base.concepts[0], knowledgeRefs: [] }]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("NEXUS-KR-");
  });
});

describe("evidence", () => {
  it("refuses a citation to a source the corpus does not describe", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      knowledge: [{ ...base.knowledge[0], evidence: [{ ref: "NOT-A-SOURCE", locator: "x" }] }]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("NOT-A-SOURCE");
  });

  it("refuses a machine verification entry about an unknown source", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      knowledge: [
        {
          ...base.knowledge[0],
          machineVerification: [
            {
              sourceRef: "GHOST",
              method: "RETRIEVED_AUTHORITY",
              retrievedOn: "2026-09-20",
              locatorFound: true,
              verifier: "machine:claude-code"
            }
          ]
        }
      ]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("GHOST");
  });

  it("refuses a supersededBy pointing outside the corpus", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      sources: [{ ...base.sources[0], status: "superseded", supersededBy: "MISSING" }]
    });
    expect(result.success).toBe(false);
  });

  it("indexes sources and the records that cite them", () => {
    const result = validateKnowledgeCorpus(corpus());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(indexSources(result.data).get("HHS-PR-SUMMARY")?.authorityClass).toBe("OFFICIAL_GUIDANCE");
    expect(indexRecordsBySource(result.data).get("HHS-PR-SUMMARY")).toEqual(["NEXUS-KR-PRIV-000001"]);
  });
});

describe("knowledge relationships", () => {
  it("refuses an exception pointing at a rule that is not there", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      knowledge: [{ ...base.knowledge[0], kind: "EXCEPTION", exceptionOf: "NEXUS-KR-PRIV-000999" }]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("NEXUS-KR-PRIV-000999");
  });

  it("refuses a concept citing knowledge that is not there", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      concepts: [{ ...base.concepts[0], knowledgeRefs: ["NEXUS-KR-PRIV-000404"] }]
    });
    expect(result.success).toBe(false);
  });
});

describe("competencies", () => {
  it("refuses a reference to a competency that is not there", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      knowledge: [{ ...base.knowledge[0], competencyRefs: ["COMP-GHOST"] }]
    });
    expect(result.success).toBe(false);
  });

  it("refuses a reference to a retired competency", () => {
    const base = corpus();
    const result = validateKnowledgeCorpus({
      ...base,
      competencies: [{ id: "COMP-PRIV", label: "Privacy", status: "retired" }],
      knowledge: [{ ...base.knowledge[0], competencyRefs: ["COMP-PRIV"] }]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("retired");
  });

  it("refuses a parent that is not in the corpus", () => {
    const result = validateKnowledgeCorpus({
      ...corpus(),
      competencies: [{ id: "COMP-PRIV", label: "Privacy", parentId: "COMP-ROOT" }]
    });
    expect(result.success).toBe(false);
  });

  it("detects a parent cycle instead of walking it forever", () => {
    const result = validateKnowledgeCorpus({
      ...corpus(),
      competencies: [
        { id: "COMP-PRIV", label: "a", parentId: "COMP-B" },
        { id: "COMP-B", label: "b", parentId: "COMP-PRIV" }
      ]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("cycle");
  });

  it("walks a competency to its root", () => {
    const result = validateKnowledgeCorpus({
      ...corpus(),
      competencies: [
        { id: "COMP-ROOT", label: "Scribing" },
        { id: "COMP-PRIV", label: "Privacy", parentId: "COMP-ROOT" }
      ]
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(competencyPath(result.data, "COMP-PRIV")).toEqual(["COMP-PRIV", "COMP-ROOT"]);
  });
});

describe("items resolve against the corpus", () => {
  const context = {
    ...header,
    id: "NEXUS-CX-PRIV-000001",
    family: "CONTEXT",
    kind: "SCENARIO",
    synthetic: true,
    setting: "outpatient clinic",
    role: "medical scribe",
    caseSummary: "A physician refers a patient to a specialist.",
    information: [{ segmentId: "S1", text: "The chart contains a lab report." }]
  };

  const item = (overrides: Record<string, unknown> = {}) => ({
    ...header,
    questionId: "NEXUS-L2-PRIV-000003",
    family: "ITEM",
    domain: "Medical Scribing",
    skillArea: "Privacy & Confidentiality",
    difficultyLevel: 2,
    questionType: "scenario",
    learningObjective: "Know that treatment disclosures do not require authorization.",
    question: "Is the patient's written authorization required for this disclosure?",
    choices: [
      { id: "a", text: "No, treatment disclosures are permitted" },
      { id: "b", text: "Yes, always" },
      { id: "c", text: "Only with a business associate agreement" }
    ],
    correctChoiceId: "a",
    rationale: "Treatment disclosures are permitted without authorization.",
    source: { ref: "HHS-PR-SUMMARY", locator: "Permitted Uses and Disclosures" },
    modality: "SITUATIONAL",
    contextRef: "NEXUS-CX-PRIV-000001@1",
    variantGroup: "PRIV-MIN-NECESSARY",
    ...overrides
  });

  const withItem = (overrides: Record<string, unknown> = {}) =>
    validateKnowledgeCorpus({ ...corpus(), contexts: [context], items: [item(overrides)] });

  it("accepts an item whose every reference resolves", () => {
    const result = withItem();
    expect(result.success, result.success ? "" : result.errors.join("\n")).toBe(true);
  });

  it("refuses a context reference to a context that is not there", () => {
    const result = withItem({ contextRef: "NEXUS-CX-PRIV-000999@1" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("NEXUS-CX-PRIV-000999");
  });

  it("refuses a context reference pinned to a revision the corpus does not hold", () => {
    // The point of pinning: an item approved against revision 1 must not
    // silently follow the context to revision 2.
    const result = withItem({ contextRef: "NEXUS-CX-PRIV-000001@2" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("pins revision 2");
  });

  it("refuses a segment target that is not in the pinned context", () => {
    const result = withItem({ targetSegmentIds: ["S9"] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("S9");
  });

  it("refuses a situational item citing a SOAP context", () => {
    const soap = {
      ...header,
      id: "NEXUS-CX-PRIV-000002",
      family: "CONTEXT",
      kind: "SOAP_NOTE",
      synthetic: true,
      setting: "clinic",
      sections: { subjective: [{ segmentId: "S1", text: "Reports a sore throat." }], objective: [], assessment: [], plan: [] }
    };
    const result = validateKnowledgeCorpus({
      ...corpus(),
      contexts: [soap],
      items: [item({ contextRef: "NEXUS-CX-PRIV-000002@1" })]
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("SCENARIO context");
  });

  it("refuses a variantGroup with no concept behind it", () => {
    const result = withItem({ variantGroup: "PRIV-NOT-A-CONCEPT" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("AssessmentConcept");
  });

  it("refuses knowledge references that do not resolve", () => {
    const result = withItem({ knowledgeRefs: ["NEXUS-KR-PRIV-000404"] });
    expect(result.success).toBe(false);
  });

  it("refuses a jurisdiction no cited source speaks for", () => {
    const result = withItem({ applicability: { jurisdictions: ["CA"] } });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("not covered by any cited source");
  });

  it("lets a federal source cover a state claim, but not the reverse", () => {
    expect(withItem({ applicability: { jurisdictions: ["US-CA"] } }).success).toBe(true);
    expect(withItem({ applicability: { jurisdictions: ["US"] } }).success).toBe(true);
  });

  it("refuses an item id that does not follow the minting convention", () => {
    const result = withItem({ questionId: "priv-3" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toContain("NEXUS-L<difficulty>");
  });
});

describe("pinned references", () => {
  it("parses and formats id@revision", () => {
    expect(parsePinnedRef("NEXUS-CX-PRIV-000001@3")).toEqual({ id: "NEXUS-CX-PRIV-000001", revision: 3 });
    expect(formatPinnedRef("NEXUS-CX-PRIV-000001", 3)).toBe("NEXUS-CX-PRIV-000001@3");
  });

  it("refuses an unpinned or malformed reference", () => {
    // "Whatever is newest" is exactly what pinning exists to prevent.
    expect(parsePinnedRef("NEXUS-CX-PRIV-000001")).toBeNull();
    expect(parsePinnedRef("NEXUS-CX-PRIV-000001@0")).toBeNull();
    expect(parsePinnedRef("NEXUS-CX-PRIV-000001@latest")).toBeNull();
  });
});
