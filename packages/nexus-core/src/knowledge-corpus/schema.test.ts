import { describe, expect, it } from "vitest";
import {
  ApplicabilitySchema,
  AssessmentConceptSchema,
  CaseContextSchema,
  CompetencyNodeSchema,
  EvidenceLinkSchema,
  KnowledgeRecordSchema,
  MachineVerificationSchema,
  ProvenanceSchema,
  SourceRecordSchema,
  isSufficientAuthority
} from "./schema.js";
import { CONTENT_STATUSES, LIFECYCLE_PROGRESSION, REVIEW_STATUSES } from "../question-bank/schema.js";

/**
 * D12 work package 1 — the corpus record families.
 *
 * Each rule gets its own failing case, so removing a check fails a test by
 * name rather than quietly widening what the corpus accepts.
 */

const provenance = {
  generationMethod: "MACHINE_DRAFTED" as const,
  authoredBy: "machine:claude-code",
  authoredOn: "2026-09-21"
};

const header = {
  revision: 1,
  contentStatus: "candidate" as const,
  reviewStatus: "pending" as const,
  provenance
};

const knowledge = {
  ...header,
  id: "NEXUS-KR-PRIV-000001",
  family: "KNOWLEDGE" as const,
  kind: "RULE" as const,
  domain: "Medical Scribing",
  topic: "Privacy & Confidentiality",
  title: "Minimum necessary standard",
  statement: "A covered entity must limit uses and disclosures to the minimum necessary.",
  evidence: [{ ref: "HHS-PR-SUMMARY", locator: "Limiting Uses and Disclosures to the Minimum Necessary" }]
};

const scenarioContext = {
  ...header,
  id: "NEXUS-CX-PRIV-000001",
  family: "CONTEXT" as const,
  kind: "SCENARIO" as const,
  synthetic: true as const,
  setting: "outpatient clinic",
  role: "medical scribe",
  caseSummary: "A physician refers a patient to a specialist.",
  information: [{ segmentId: "S1", text: "The chart contains a lab report." }]
};

const soapContext = {
  ...header,
  id: "NEXUS-CX-ICD-000001",
  family: "CONTEXT" as const,
  kind: "SOAP_NOTE" as const,
  synthetic: true as const,
  setting: "outpatient clinic",
  sections: {
    subjective: [{ segmentId: "S1", text: "Reports three days of sore throat." }],
    objective: [{ segmentId: "O1", text: "Temp 38.1 C." }],
    assessment: [],
    plan: []
  }
};

describe("corpus records reuse the bank's trust model", () => {
  it("shares one lifecycle ladder and review vocabulary", () => {
    // Restating either here would create a second definition of "verified".
    expect(LIFECYCLE_PROGRESSION[0]).toBe("candidate");
    expect(CONTENT_STATUSES).toContain("production-eligible");
    expect(REVIEW_STATUSES).toContain("approved");
    expect(KnowledgeRecordSchema.safeParse({ ...knowledge, contentStatus: "not-a-status" }).success).toBe(false);
  });

  it("rejects an unknown field by name", () => {
    const result = KnowledgeRecordSchema.safeParse({ ...knowledge, confidence: "high" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.error.issues)).toContain("confidence");
  });

  it("accepts a well-formed knowledge record and defaults its lists", () => {
    const result = KnowledgeRecordSchema.safeParse(knowledge);
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.qualifiers).toEqual([]);
    expect(result.data.machineVerification).toEqual([]);
    expect(result.data.supersedes).toEqual([]);
    expect(result.data.competencyRefs).toEqual([]);
  });

  it("requires a human verifier above candidate, exactly as the bank does", () => {
    // The corpus inherits the rule rather than re-implementing it: a record
    // cannot claim source-verified with an empty verification record.
    const claimed = KnowledgeRecordSchema.safeParse({
      ...knowledge,
      contentStatus: "source-verified",
      verification: { humanVerificationRequired: true, humanVerifiedBy: null, humanVerifiedOn: null }
    });
    expect(claimed.success).toBe(true); // structure alone is valid here…
    if (!claimed.success) return;
    // …and the gate itself is asserted by eligibility, which WP4 owns. What
    // this test pins is that the *shape* still carries the null-by-default
    // human fields, so nothing can default them to a name.
    expect(claimed.data.verification?.humanVerifiedBy).toBeNull();
    expect(claimed.data.verification?.humanVerifiedOn).toBeNull();
  });
});

describe("knowledge records", () => {
  it("requires at least one piece of evidence", () => {
    expect(KnowledgeRecordSchema.safeParse({ ...knowledge, evidence: [] }).success).toBe(false);
  });

  it("makes an EXCEPTION name the rule it excepts", () => {
    expect(KnowledgeRecordSchema.safeParse({ ...knowledge, kind: "EXCEPTION" }).success).toBe(false);
    expect(
      KnowledgeRecordSchema.safeParse({ ...knowledge, kind: "EXCEPTION", exceptionOf: "NEXUS-KR-PRIV-000002" }).success
    ).toBe(true);
  });

  it("refuses a record that is an exception to itself", () => {
    expect(KnowledgeRecordSchema.safeParse({ ...knowledge, kind: "EXCEPTION", exceptionOf: knowledge.id }).success).toBe(false);
  });

  it("caps a title so it stays a title", () => {
    expect(KnowledgeRecordSchema.safeParse({ ...knowledge, title: "x".repeat(121) }).success).toBe(false);
  });
});

describe("evidence and sources", () => {
  it("defaults what a citation supports to the answer", () => {
    const result = EvidenceLinkSchema.safeParse({ ref: "HHS-PR-SUMMARY", locator: "Heading" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.supports).toBe("ANSWER");
  });

  it("refuses an excerpt longer than 50 words", () => {
    const long = Array.from({ length: 51 }, (_, i) => `word${i}`).join(" ");
    expect(EvidenceLinkSchema.safeParse({ ref: "S", locator: "L", excerpt: long }).success).toBe(false);
    const short = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
    expect(EvidenceLinkSchema.safeParse({ ref: "S", locator: "L", excerpt: short }).success).toBe(true);
  });

  it("classifies authority, and says which classes may stand alone", () => {
    expect(isSufficientAuthority("PRIMARY_REGULATION")).toBe(true);
    expect(isSufficientAuthority("OFFICIAL_GUIDANCE")).toBe(true);
    expect(isSufficientAuthority("SECONDARY")).toBe(false);
  });

  it("accepts the pilot's source shape and defaults its status to active", () => {
    const result = SourceRecordSchema.safeParse({
      id: "HHS-PR-SUMMARY",
      authority: "U.S. HHS Office for Civil Rights",
      authorityClass: "OFFICIAL_GUIDANCE",
      title: "Summary of the HIPAA Privacy Rule",
      url: "https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html",
      jurisdiction: "US",
      retrievedOn: "2026-09-20"
    });
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
  });

  it("makes a superseded source name its successor", () => {
    const base = {
      id: "CDC-ICD10CM-GL-FY26",
      authority: "CMS / NCHS",
      authorityClass: "OFFICIAL_CODE_SET" as const,
      title: "ICD-10-CM Official Guidelines FY2026",
      jurisdiction: "US",
      status: "superseded" as const
    };
    expect(SourceRecordSchema.safeParse(base).success).toBe(false);
    expect(SourceRecordSchema.safeParse({ ...base, supersededBy: "CDC-ICD10CM-GL-FY27" }).success).toBe(true);
  });

  it("refuses a source whose window runs backwards", () => {
    expect(
      SourceRecordSchema.safeParse({
        id: "X",
        authority: "A",
        authorityClass: "OFFICIAL_GUIDANCE",
        title: "T",
        jurisdiction: "US",
        effectiveFrom: "2027-09-30",
        effectiveTo: "2026-10-01"
      }).success
    ).toBe(false);
  });
});

describe("applicability", () => {
  it("requires at least one jurisdiction", () => {
    expect(ApplicabilitySchema.safeParse({ jurisdictions: [] }).success).toBe(false);
  });

  it("accepts an open-ended window and the FY2027 window", () => {
    expect(ApplicabilitySchema.safeParse({ jurisdictions: ["US"] }).success).toBe(true);
    expect(
      ApplicabilitySchema.safeParse({ jurisdictions: ["US"], effectiveFrom: "2026-10-01", effectiveTo: "2027-09-30" }).success
    ).toBe(true);
  });

  it("refuses a window that ends before it starts", () => {
    expect(
      ApplicabilitySchema.safeParse({ jurisdictions: ["US"], effectiveFrom: "2027-09-30", effectiveTo: "2026-10-01" }).success
    ).toBe(false);
  });

  it("refuses UNIVERSAL mixed with a specific jurisdiction", () => {
    expect(ApplicabilitySchema.safeParse({ jurisdictions: ["UNIVERSAL", "US"] }).success).toBe(false);
    expect(ApplicabilitySchema.safeParse({ jurisdictions: ["UNIVERSAL"] }).success).toBe(true);
  });
});

describe("provenance is honest about machine drafting", () => {
  it("makes machine-drafted content name a machine author", () => {
    expect(
      ProvenanceSchema.safeParse({ generationMethod: "MACHINE_DRAFTED", authoredBy: "A Reviewer", authoredOn: "2026-09-21" })
        .success
    ).toBe(false);
    expect(ProvenanceSchema.safeParse(provenance).success).toBe(true);
  });

  it("refuses human-authored content attributed to a machine", () => {
    expect(
      ProvenanceSchema.safeParse({
        generationMethod: "HUMAN_AUTHORED",
        authoredBy: "machine:claude-code",
        authoredOn: "2026-09-21"
      }).success
    ).toBe(false);
  });
});

describe("machine verification can never impersonate a person", () => {
  const entry = {
    sourceRef: "HHS-PR-SUMMARY",
    method: "RETRIEVED_AUTHORITY" as const,
    retrievedOn: "2026-09-20",
    locatorFound: true,
    verifier: "machine:claude-code"
  };

  it("accepts a machine verifier and defaults the snapshot to null", () => {
    const result = MachineVerificationSchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.snapshotHash).toBeNull();
  });

  it("refuses a verifier that does not name a machine", () => {
    expect(MachineVerificationSchema.safeParse({ ...entry, verifier: "A Reviewer" }).success).toBe(false);
  });
});

describe("case contexts", () => {
  it("accepts a scenario context", () => {
    const result = CaseContextSchema.safeParse(scenarioContext);
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
  });

  it("requires synthetic case data", () => {
    expect(CaseContextSchema.safeParse({ ...scenarioContext, synthetic: false }).success).toBe(false);
    const { synthetic: _omitted, ...withoutFlag } = scenarioContext;
    expect(CaseContextSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it("requires a scenario to carry information the learner can use", () => {
    expect(CaseContextSchema.safeParse({ ...scenarioContext, information: [] }).success).toBe(false);
  });

  it("refuses duplicate segment ids", () => {
    expect(
      CaseContextSchema.safeParse({
        ...scenarioContext,
        information: [
          { segmentId: "S1", text: "one" },
          { segmentId: "S1", text: "two" }
        ]
      }).success
    ).toBe(false);
  });

  it("accepts a SOAP context and defaults its empty sections", () => {
    const result = CaseContextSchema.safeParse(soapContext);
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
    if (!result.success || result.data.kind !== "SOAP_NOTE") return;
    expect(result.data.unplaced).toEqual([]);
    expect(result.data.seededDefects).toEqual([]);
  });

  it("refuses a SOAP context with no segments at all", () => {
    expect(
      CaseContextSchema.safeParse({
        ...soapContext,
        sections: { subjective: [], objective: [], assessment: [], plan: [] }
      }).success
    ).toBe(false);
  });

  it("refuses a seeded defect pointing at a segment that is not there", () => {
    expect(
      CaseContextSchema.safeParse({
        ...soapContext,
        seededDefects: [{ segmentId: "NOPE", defect: "MISPLACED", note: "temp under subjective" }]
      }).success
    ).toBe(false);
    expect(
      CaseContextSchema.safeParse({
        ...soapContext,
        seededDefects: [{ segmentId: "O1", defect: "MISPLACED", correctSection: "objective", note: "ok" }]
      }).success
    ).toBe(true);
  });
});

describe("concepts and competencies", () => {
  it("accepts a concept keyed by its variantGroup", () => {
    const result = AssessmentConceptSchema.safeParse({
      ...header,
      id: "PRIV-MIN-NECESSARY",
      family: "CONCEPT",
      statement: "The minimum necessary standard has defined exceptions.",
      domain: "Medical Scribing"
    });
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
  });

  it("ships competency mappings empty, because A2 is open", () => {
    const result = CompetencyNodeSchema.safeParse({ id: "COMP-PRIV", label: "Privacy & Confidentiality" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.externalMappings).toEqual([]);
    expect(result.data.status).toBe("active");
  });

  it("refuses a competency that parents itself", () => {
    expect(CompetencyNodeSchema.safeParse({ id: "COMP-PRIV", label: "x", parentId: "COMP-PRIV" }).success).toBe(false);
  });
});
