import { describe, expect, it } from "vitest";
import { AssessmentItemSchema } from "./item.js";
import type { AssessmentItem } from "./item.js";
import { checkBatchQuality, checkItemQuality, qualityErrors, qualityWarnings, trigramSimilarity } from "./quality.js";

/**
 * D12 work package 2 — question-quality rules (D12-54).
 *
 * Every rule has a case that fires it and, where it matters, one that does not.
 * A heuristic must stay a warning: the tier is asserted, not just the message.
 */

const provenance = {
  generationMethod: "MACHINE_DRAFTED" as const,
  authoredBy: "machine:claude-code",
  authoredOn: "2026-09-21"
};

function item(overrides: Record<string, unknown> = {}): AssessmentItem {
  const parsed = AssessmentItemSchema.safeParse({
    questionId: "NEXUS-L1-PRIV-000001",
    family: "ITEM",
    revision: 1,
    domain: "Medical Scribing",
    skillArea: "Privacy & Confidentiality",
    difficultyLevel: 1,
    questionType: "recognition",
    learningObjective: "Name the HIPAA term for individually identifiable health information.",
    question: "What term does the HIPAA Privacy Rule use for this information?",
    choices: [
      { id: "a", text: "Protected health information", why: "The Rule's own term." },
      { id: "b", text: "Personal medical data", why: "Not the Rule's term." },
      { id: "c", text: "Confidential patient records", why: "Not the Rule's term." },
      { id: "d", text: "Private clinical details", why: "Not the Rule's term." }
    ],
    correctChoiceId: "a",
    rationale: "The Rule defines protected health information.",
    source: { ref: "HHS-PR-SUMMARY", locator: "What Information is Protected" },
    modality: "DIRECT_KNOWLEDGE",
    contentStatus: "candidate",
    reviewStatus: "pending",
    provenance,
    ...overrides
  });
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
  return parsed.data;
}

const rules = (findings: { rule: string }[]) => findings.map((finding) => finding.rule);

describe("a clean item raises nothing", () => {
  it("passes with no findings at all", () => {
    expect(checkItemQuality(item())).toEqual([]);
  });
});

describe("answer-shape rules", () => {
  it("catches the answer-length bias as a policy error", () => {
    const findings = checkItemQuality(
      item({
        choices: [
          { id: "a", text: "Protected health information, which the Rule defines at length and in detail here" },
          { id: "b", text: "Personal medical data" },
          { id: "c", text: "Confidential records" },
          { id: "d", text: "Private details" }
        ]
      })
    );
    expect(rules(findings)).toContain("answer-length-bias");
    expect(qualityErrors(findings).map((f) => f.rule)).toContain("answer-length-bias");
  });

  it("warns, but only warns, when the answer is far shorter than every distractor", () => {
    const findings = checkItemQuality(
      item({
        choices: [
          { id: "a", text: "PHI" },
          { id: "b", text: "Personal medical data held by a clinic" },
          { id: "c", text: "Confidential patient records of any kind" },
          { id: "d", text: "Private clinical details about a person" }
        ]
      })
    );
    expect(rules(qualityWarnings(findings))).toContain("answer-much-shorter");
    expect(rules(qualityErrors(findings))).not.toContain("answer-much-shorter");
  });

  it("catches duplicate choice text", () => {
    const findings = checkItemQuality(
      item({
        choices: [
          { id: "a", text: "Protected health information" },
          { id: "b", text: "protected health information " },
          { id: "c", text: "Confidential patient records" },
          { id: "d", text: "Private clinical details" }
        ]
      })
    );
    expect(rules(findings)).toContain("duplicate-choice-text");
  });

  it("refuses an all/none of the above option", () => {
    const findings = checkItemQuality(
      item({
        choices: [
          { id: "a", text: "Protected health information" },
          { id: "b", text: "Personal medical data" },
          { id: "c", text: "Confidential patient records" },
          { id: "d", text: "None of the above" }
        ]
      })
    );
    expect(rules(qualityErrors(findings))).toContain("catch-all-choice");
  });
});

describe("production-only rules", () => {
  it("says nothing about a candidate, and everything about a production item", () => {
    const draft = item({
      choices: [
        { id: "a", text: "Protected health information" },
        { id: "b", text: "Personal medical data" },
        { id: "c", text: "Confidential patient records" },
        { id: "d", text: "Private clinical details" }
      ]
    });
    expect(rules(checkItemQuality(draft))).not.toContain("missing-choice-explanation");

    const production = rules(checkItemQuality(draft, { production: true }));
    expect(production).toContain("missing-choice-explanation");
    expect(production).toContain("no-knowledge-grounding");
    expect(production).toContain("no-applicability");
  });

  it("requires the source registry rather than an inline citation", () => {
    const inline = item({
      source: {
        authority: "U.S. HHS Office for Civil Rights",
        title: "Summary of the HIPAA Privacy Rule",
        jurisdiction: "US",
        locator: "What Information is Protected"
      }
    });
    expect(rules(checkItemQuality(inline, { production: true }))).toContain("inline-source");
  });

  it("is satisfied by a fully grounded production item", () => {
    const grounded = item({
      knowledgeRefs: ["NEXUS-KR-PRIV-000001"],
      applicability: { jurisdictions: ["US"] }
    });
    expect(rules(checkItemQuality(grounded, { production: true }))).toEqual([]);
  });
});

describe("coding rules", () => {
  it("requires an ICD item to state its release", () => {
    const findings = checkItemQuality(item({ domain: "ICD" }));
    expect(rules(qualityErrors(findings))).toContain("icd-without-coding-reference");
  });

  it("warns about a code-like token that is not listed", () => {
    const findings = checkItemQuality(
      item({
        domain: "ICD",
        question: "Which code applies, E11.9 or another?",
        codingReference: { system: "ICD-10-CM", jurisdiction: "US", release: "FY2027", codes: [] }
      })
    );
    expect(rules(qualityWarnings(findings))).toContain("unlisted-code-token");
  });

  it("stays quiet when the code is declared", () => {
    const findings = checkItemQuality(
      item({
        domain: "ICD",
        question: "Which code applies, E11.9 or another?",
        codingReference: { system: "ICD-10-CM", jurisdiction: "US", release: "FY2027", codes: ["E11.9"] }
      })
    );
    expect(rules(findings)).not.toContain("unlisted-code-token");
  });
});

describe("wording heuristics", () => {
  it("warns about absolute wording in the correct choice", () => {
    const findings = checkItemQuality(
      item({
        choices: [
          { id: "a", text: "It must always be disclosed to the provider" },
          { id: "b", text: "Personal medical data is exchanged" },
          { id: "c", text: "Confidential patient records are kept" },
          { id: "d", text: "Private clinical details are shared" }
        ]
      })
    );
    expect(rules(qualityWarnings(findings))).toContain("absolute-wording");
  });

  it("stays quiet when an exception is cited alongside it", () => {
    const findings = checkItemQuality(
      item({
        choices: [
          { id: "a", text: "It must always be disclosed to the provider" },
          { id: "b", text: "Personal medical data is exchanged" },
          { id: "c", text: "Confidential patient records are kept" },
          { id: "d", text: "Private clinical details are shared" }
        ],
        additionalEvidence: [{ ref: "HHS-PR-SUMMARY", locator: "Exceptions", supports: "EXCEPTION" }]
      })
    );
    expect(rules(findings)).not.toContain("absolute-wording");
  });

  it("warns when the stem's article gives the answer away", () => {
    const findings = checkItemQuality(
      item({
        question: "Under the Privacy Rule, a business associate is a",
        choices: [
          { id: "a", text: "entity that creates or receives PHI for a covered entity" },
          { id: "b", text: "patient who requests their own record" },
          { id: "c", text: "clinician treating the patient" },
          { id: "d", text: "regulator auditing the clinic" }
        ]
      })
    );
    expect(rules(qualityWarnings(findings))).toContain("grammatical-cue");
  });

  it("warns about a modality and question type that do not fit", () => {
    const findings = checkItemQuality(item({ questionType: "scenario" }));
    expect(rules(qualityWarnings(findings))).toContain("modality-type-mismatch");
  });
});

describe("batch rules", () => {
  const spread = (n: number, choiceId: string) =>
    Array.from({ length: n }, (_, i) =>
      item({ questionId: `NEXUS-L1-PRIV-${String(i + 1).padStart(6, "0")}`, correctChoiceId: choiceId })
    );

  it("accepts the pilot's balanced spread", () => {
    const balanced = ["a", "b", "c", "d"].flatMap((choiceId, index) =>
      Array.from({ length: 3 }, (_, i) =>
        item({
          questionId: `NEXUS-L1-PRIV-${String(index * 3 + i + 1).padStart(6, "0")}`,
          correctChoiceId: choiceId,
          question: `Question number ${index * 3 + i + 1} about the Privacy Rule term used here?`
        })
      )
    );
    expect(rules(checkBatchQuality(balanced))).not.toContain("answer-position-imbalance");
  });

  it("flags a batch where one position dominates", () => {
    const findings = checkBatchQuality(spread(12, "a"));
    expect(rules(qualityErrors(findings))).toContain("answer-position-imbalance");
  });

  it("flags duplicate item ids", () => {
    const findings = checkBatchQuality([item(), item()]);
    expect(rules(findings)).toContain("duplicate-item-id");
  });

  it("warns about near-duplicate stems", () => {
    const findings = checkBatchQuality([
      item({ questionId: "NEXUS-L1-PRIV-000001" }),
      item({
        questionId: "NEXUS-L1-PRIV-000002",
        question: "What term does the HIPAA Privacy Rule use for this information?"
      })
    ]);
    expect(rules(qualityWarnings(findings))).toContain("near-duplicate-stem");
  });

  it("does not flag genuinely different stems", () => {
    const findings = checkBatchQuality([
      item({ questionId: "NEXUS-L1-PRIV-000001" }),
      item({
        questionId: "NEXUS-L1-PRIV-000002",
        question: "Which three kinds of organisation does the Rule call covered entities?"
      })
    ]);
    expect(rules(findings)).not.toContain("near-duplicate-stem");
  });

  it("measures stem similarity in [0, 1]", () => {
    expect(trigramSimilarity("the same text", "the same text")).toBe(1);
    expect(trigramSimilarity("abcdef", "uvwxyz")).toBe(0);
  });
});
