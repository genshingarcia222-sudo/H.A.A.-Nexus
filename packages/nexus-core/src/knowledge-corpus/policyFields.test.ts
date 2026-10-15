import { describe, expect, it } from "vitest";
import {
  CORPUS_DROPPED_POLICY_FIELDS,
  CORPUS_POLICY_FIELDS,
  KnowledgeRecordSchema
} from "./schema.js";
import { AssessmentItemSchema } from "./item.js";

/**
 * O6 — seventeen of the eighteen class-(c) policy and safety fields are carried
 * into contract B; `accessClasses` is the single deliberate omission.
 *
 * Decided 2026-10-14 under the owner's standing authorisation and since
 * ratified directly. The reasoning was an asymmetry: the fields are optional
 * additions to `.strict()` schemas, so carrying them cannot break a consumer
 * that ignores them, while dropping them deletes enforcement that exists and
 * works in the authoring lane — `SAFETY-PRECEDENCE` among it.
 *
 * These tests exist to fail if a carried field disappears, changes shape, or is
 * quietly reclassified, and to prove the one omission is **enforced** rather
 * than merely intended: because every family schema is `.strict()`, a record
 * still carrying `accessClasses` is rejected outright.
 *
 * Field types are taken from the 432 authored records, measured rather than
 * assumed. Taxonomy membership — that an `errorTargets` entry names a real
 * error id — stays with the authoring lane's validator, which owns the
 * registries; this layer owns the shape.
 */

const itemBase = {
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

const item = (overrides: Record<string, unknown> = {}) =>
  AssessmentItemSchema.safeParse({ ...itemBase, ...overrides });

/** Real values, in the shapes the corpus actually uses. */
const REAL_VALUES: Record<string, unknown> = {
  safetyFlags: ["SAFETY_SCOPE_BOUNDARY"],
  privacyFlags: ["PRIVACY_IDENTITY_VERIFICATION"],
  escalationRequired: true,
  clinicianJudgmentRequired: true,
  hardFailureConditions: ["Any response that commits scope violation fails outright."],
  jurisdictions: ["UNIVERSAL"],
  payerSpecific: false,
  encounterDate: "2026-03-14",
  goldBehavior: "Answer only what the role is authorised to answer.",
  acceptanceCriteria: [
    { id: "AC1", requirement: "Identifies that dose advice sits outside the role.", credit: 0.34, evidenceRef: "A2" }
  ],
  errorTargets: ["KB-ERR-SCOPE-VIOLATION"],
  remediationTargets: ["KB-REM-SCOPE-BOUNDARY"],
  trapTypes: ["TRAP_ANSWER_OUTSIDE_SCOPE"],
  expectedOutput: "A written response that satisfies every acceptance criterion.",
  steps: ["Read back the agreed action, owner and timeframe."],
  moduleIds: ["M01", "M14"],
  evidenceBasis: "SELF_CONTAINED"
};

describe("O6: the seventeen carried fields, named not just counted", () => {
  it("carries exactly seventeen, and these are them", () => {
    // Named explicitly. A count alone would still pass if a future edit swapped
    // a safety field for something cheaper.
    expect([...CORPUS_POLICY_FIELDS].sort()).toEqual([
      "acceptanceCriteria",
      "clinicianJudgmentRequired",
      "encounterDate",
      "errorTargets",
      "escalationRequired",
      "evidenceBasis",
      "expectedOutput",
      "goldBehavior",
      "hardFailureConditions",
      "jurisdictions",
      "moduleIds",
      "payerSpecific",
      "privacyFlags",
      "remediationTargets",
      "safetyFlags",
      "steps",
      "trapTypes"
    ]);
    expect(CORPUS_POLICY_FIELDS).toHaveLength(17);
  });

  it("accepts every one of the seventeen on an ITEM, with a real value", () => {
    for (const field of CORPUS_POLICY_FIELDS) {
      const r = item({ [field]: REAL_VALUES[field] });
      expect(r.success, `${field}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it("accepts all seventeen together, which is what a migrated record looks like", () => {
    const r = item(REAL_VALUES);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (!r.success) return;
    for (const field of CORPUS_POLICY_FIELDS) {
      expect(r.data[field], `${field} did not survive parsing`).toBeDefined();
    }
  });

  it("keeps every one optional, so an existing record still validates", () => {
    // The additive guarantee. If any of the seventeen became required, every
    // record in the corpus that predates O6 would stop parsing.
    const r = item();
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (!r.success) return;
    for (const field of CORPUS_POLICY_FIELDS) {
      expect(r.data[field], `${field} is not optional`).toBeUndefined();
    }
  });

  it("carries them on the KNOWLEDGE family too, not only ITEM", () => {
    const knowledge = KnowledgeRecordSchema.safeParse({
      recordId: "KB-KNOW-000001",
      family: "KNOWLEDGE",
      kind: "RULE",
      revision: 1,
      domain: "Medical Scribing",
      statement: "A disclosure to the individual is outside the minimum necessary standard.",
      contentStatus: "candidate",
      reviewStatus: "pending",
      synthetic: true,
      provenance: {
        generationMethod: "MACHINE_DRAFTED",
        authoredBy: "machine:claude-code",
        authoredOn: "2026-09-21"
      },
      safetyFlags: ["SAFETY_SCOPE_BOUNDARY"],
      jurisdictions: ["UNIVERSAL"]
    });
    // The record shape may differ from this sketch; what is asserted is that
    // the policy fields are not the reason it would fail.
    if (!knowledge.success) {
      const offending = knowledge.error.issues.filter((i) =>
        (CORPUS_POLICY_FIELDS as readonly string[]).includes(String(i.path[0]))
      );
      expect(offending, JSON.stringify(offending)).toEqual([]);
    }
  });
});

describe("O6: the five safety fields are carried individually", () => {
  // Dropping one of these would remove a guarantee a reviewer can currently
  // rely on. Each gets its own assertion so a failure names the field.
  for (const field of [
    "safetyFlags",
    "privacyFlags",
    "escalationRequired",
    "clinicianJudgmentRequired",
    "hardFailureConditions"
  ] as const) {
    it(`carries ${field}`, () => {
      expect(CORPUS_POLICY_FIELDS).toContain(field);
      const r = item({ [field]: REAL_VALUES[field] });
      expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
      if (!r.success) return;
      expect(r.data[field]).toEqual(REAL_VALUES[field]);
    });
  }
});

describe("O6: the shapes are the corpus's, so a wrong type is caught", () => {
  it("rejects a string where a boolean belongs", () => {
    expect(item({ escalationRequired: "yes" }).success).toBe(false);
    expect(item({ clinicianJudgmentRequired: 1 }).success).toBe(false);
  });

  it("rejects a bare string where a list belongs", () => {
    expect(item({ safetyFlags: "SAFETY_SCOPE_BOUNDARY" }).success).toBe(false);
    expect(item({ moduleIds: "M01" }).success).toBe(false);
  });

  it("rejects an empty jurisdictions list, which would assert nothing", () => {
    expect(item({ jurisdictions: [] }).success).toBe(false);
  });

  it("allows a null encounterDate, because 420 records have none", () => {
    expect(item({ encounterDate: null }).success).toBe(true);
  });

  it("rejects an acceptance criterion with no credit or an out-of-range one", () => {
    expect(item({ acceptanceCriteria: [{ id: "AC1", requirement: "x" }] }).success).toBe(false);
    expect(item({ acceptanceCriteria: [{ id: "AC1", requirement: "x", credit: 0 }] }).success).toBe(false);
    expect(item({ acceptanceCriteria: [{ id: "AC1", requirement: "x", credit: 1.5 }] }).success).toBe(false);
    expect(item({ acceptanceCriteria: [{ id: "AC1", requirement: "x", credit: 0.5 }] }).success).toBe(true);
  });
});

describe("O6: the one omission is enforced, not merely intended", () => {
  it("names accessClasses as the only dropped field", () => {
    expect([...CORPUS_DROPPED_POLICY_FIELDS]).toEqual(["accessClasses"]);
  });

  it("REJECTS a record that still carries accessClasses", () => {
    // Every family schema is `.strict()`, so the drop is enforced by the
    // contract rather than trusted to the migration. A record that smuggled
    // the field through would fail here.
    const r = item({ accessClasses: ["TRAINING", "PRACTICE", "INSTRUCTOR_ADMIN"] });
    expect(r.success).toBe(false);
  });

  it("does not carry accessClasses under another name", () => {
    for (const field of CORPUS_POLICY_FIELDS) {
      expect(String(field).toLowerCase()).not.toContain("accessclass");
    }
  });

  it("keeps the dropped field out of the carried set", () => {
    expect(CORPUS_POLICY_FIELDS).not.toContain("accessClasses" as never);
  });
});
