import { describe, expect, it } from "vitest";
import { ReviewRecordSchema, ReviewerSchema, decidingReview, requiredStagesFor } from "./review.js";
import { validateKnowledgeCorpus } from "./validate.js";

/**
 * D12 work package 3 — the review log, and what it makes impossible.
 *
 * The bank already forbade claiming verification without a recorded verifier.
 * These tests are about the half that makes the rule enforceable: a claim must
 * be backed by a review record naming a registered person, against the exact
 * revision, at the stage the claimed status needs. A syntactically perfect
 * fake must fail.
 */

const provenance = {
  generationMethod: "MACHINE_DRAFTED" as const,
  authoredBy: "machine:claude-code",
  authoredOn: "2026-09-21"
};

const reviewer = { id: "REV-ANA", displayName: "A. Reviewer", qualification: "RHIT" };

const source = {
  id: "HHS-PR-SUMMARY",
  authority: "U.S. HHS Office for Civil Rights",
  authorityClass: "OFFICIAL_GUIDANCE",
  title: "Summary of the HIPAA Privacy Rule",
  jurisdiction: "US",
  snapshotHash: "abc123"
};

function knowledge(overrides: Record<string, unknown> = {}) {
  return {
    id: "NEXUS-KR-PRIV-000001",
    family: "KNOWLEDGE",
    revision: 1,
    kind: "RULE",
    domain: "Medical Scribing",
    topic: "Privacy & Confidentiality",
    title: "Minimum necessary standard",
    statement: "A covered entity must limit uses and disclosures to the minimum necessary.",
    evidence: [{ ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" }],
    contentStatus: "candidate",
    reviewStatus: "pending",
    provenance,
    ...overrides
  };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: "REVIEW-0001",
    reviewerId: "REV-ANA",
    reviewedOn: "2026-09-22",
    target: "NEXUS-KR-PRIV-000001@1",
    stage: "SOURCE",
    decision: "APPROVE",
    sourceSnapshots: ["abc123"],
    ...overrides
  };
}

const verified = {
  humanVerificationRequired: true,
  humanVerifiedBy: "REV-ANA",
  humanVerifiedOn: "2026-09-22"
};

function corpus(overrides: Record<string, unknown> = {}) {
  return {
    corpusId: "NEXUS-KNOWLEDGE",
    version: "0",
    sources: [source],
    knowledge: [knowledge()],
    reviewers: [reviewer],
    reviews: [],
    ...overrides
  };
}

const errorsOf = (result: ReturnType<typeof validateKnowledgeCorpus>) => (result.success ? [] : result.errors).join("\n");

describe("the review record itself", () => {
  it("accepts a well-formed review", () => {
    expect(ReviewRecordSchema.safeParse(review()).success).toBe(true);
  });

  it("requires the target to name an exact revision", () => {
    expect(ReviewRecordSchema.safeParse(review({ target: "NEXUS-KR-PRIV-000001" })).success).toBe(false);
  });

  it("refuses a review recorded by a machine", () => {
    expect(ReviewRecordSchema.safeParse(review({ reviewerId: "machine:claude-code" })).success).toBe(false);
  });

  it("refuses to register a machine as a reviewer", () => {
    // An agent that could register itself could approve its own work.
    expect(ReviewerSchema.safeParse({ id: "machine:claude-code", displayName: "Claude" }).success).toBe(false);
    expect(ReviewerSchema.safeParse(reviewer).success).toBe(true);
  });

  it("maps each status to the stages the lifecycle requires", () => {
    expect(requiredStagesFor("candidate")).toEqual([]);
    expect(requiredStagesFor("source-verified")).toEqual(["SOURCE"]);
    expect(requiredStagesFor("content-reviewed")).toEqual(["SOURCE", "CONTENT"]);
    expect(requiredStagesFor("approved")).toEqual(["SOURCE", "CONTENT", "FINAL"]);
    expect(requiredStagesFor("production-eligible")).toEqual(["SOURCE", "CONTENT", "FINAL"]);
    expect(requiredStagesFor("blocked")).toEqual([]);
  });

  it("lets the latest review of a stage decide it", () => {
    const first = review({ id: "R1", decision: "REQUEST_CHANGES", reviewedOn: "2026-09-20" });
    const second = review({ id: "R2", decision: "APPROVE", reviewedOn: "2026-09-22" });
    const parsed = [first, second].map((raw) => ReviewRecordSchema.parse(raw));
    expect(decidingReview(parsed, "SOURCE")?.id).toBe("R2");
  });
});

describe("a valid review chain is accepted", () => {
  it("lets a source-verified record stand on an approved SOURCE review", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [knowledge({ contentStatus: "source-verified", reviewStatus: "in-review", verification: verified })],
        reviews: [review()]
      })
    );
    expect(result.success, errorsOf(result)).toBe(true);
  });

  it("lets a production-eligible record stand on all three stages", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({
            contentStatus: "production-eligible",
            reviewStatus: "approved",
            verification: { ...verified, reviewedSourceSnapshots: ["abc123"] }
          })
        ],
        reviews: [
          review(),
          review({ id: "REVIEW-0002", stage: "CONTENT", reviewedOn: "2026-09-23" }),
          review({ id: "REVIEW-0003", stage: "FINAL", reviewedOn: "2026-09-24" })
        ]
      })
    );
    expect(result.success, errorsOf(result)).toBe(true);
  });

  it("accepts a rejected-then-approved history for one stage", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [knowledge({ contentStatus: "source-verified", reviewStatus: "in-review", verification: verified })],
        reviews: [
          review({ id: "REVIEW-0000", decision: "REQUEST_CHANGES", reviewedOn: "2026-09-21" }),
          review()
        ]
      })
    );
    expect(result.success, errorsOf(result)).toBe(true);
  });
});

describe("fabricated verification is rejected", () => {
  it("refuses a human verification with no review behind it at all", () => {
    // The core case: a name and a date typed into the record.
    const result = validateKnowledgeCorpus(corpus({ knowledge: [knowledge({ verification: verified })] }));
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("no approved SOURCE review");
  });

  it("refuses a verifier who is not a registered reviewer", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({
            contentStatus: "source-verified",
            verification: { ...verified, humanVerifiedBy: "REV-GHOST" }
          })
        ],
        reviews: [review({ reviewerId: "REV-GHOST" })]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("not a registered reviewer");
  });

  it("refuses an inactive reviewer", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        reviewers: [{ ...reviewer, status: "inactive" }],
        knowledge: [knowledge({ contentStatus: "source-verified", verification: verified })],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("inactive reviewer");
  });

  it("refuses a verifier who is not the person who approved", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        reviewers: [reviewer, { id: "REV-BEN", displayName: "B. Other" }],
        knowledge: [
          knowledge({
            contentStatus: "source-verified",
            verification: { ...verified, humanVerifiedBy: "REV-BEN" }
          })
        ],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("does not match the reviewer who approved");
  });

  it("refuses a verification date that is not the review's date", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({
            contentStatus: "source-verified",
            verification: { ...verified, humanVerifiedOn: "2026-09-19" }
          })
        ],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("does not match the SOURCE review date");
  });

  it("refuses half a verification", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({ verification: { humanVerificationRequired: true, humanVerifiedBy: "REV-ANA", humanVerifiedOn: null } })
        ],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("both humanVerifiedBy and humanVerifiedOn");
  });

  it("refuses a snapshot the reviewer never reported seeing", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({
            contentStatus: "source-verified",
            verification: { ...verified, reviewedSourceSnapshots: ["abc123", "never-seen"] }
          })
        ],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("never-seen");
  });
});

describe("the review must be of this record, at this revision", () => {
  it("refuses a review of a different record", () => {
    // item A claiming review record R, where R reviews item B.
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({ contentStatus: "source-verified", verification: verified }),
          knowledge({ id: "NEXUS-KR-PRIV-000002", title: "Другое", statement: "Another rule." })
        ],
        reviews: [review({ target: "NEXUS-KR-PRIV-000002@1" })]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("requires a SOURCE review of NEXUS-KR-PRIV-000001@1");
  });

  it("refuses a review of an earlier revision", () => {
    // A reviewer verified words that have since changed.
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [knowledge({ revision: 2, contentStatus: "source-verified", verification: verified })],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("reviews revision 1, but the corpus holds revision 2");
  });

  it("refuses a review targeting a record that is not in the corpus", () => {
    const result = validateKnowledgeCorpus(corpus({ reviews: [review({ target: "NEXUS-KR-PRIV-000404@1" })] }));
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("NEXUS-KR-PRIV-000404");
  });

  it("refuses duplicate review and reviewer ids", () => {
    const duplicateReviews = validateKnowledgeCorpus(corpus({ reviews: [review(), review()] }));
    expect(duplicateReviews.success).toBe(false);
    expect(errorsOf(duplicateReviews)).toContain("duplicate review id");

    const duplicateReviewers = validateKnowledgeCorpus(corpus({ reviewers: [reviewer, reviewer] }));
    expect(duplicateReviewers.success).toBe(false);
    expect(errorsOf(duplicateReviewers)).toContain("duplicate reviewer id");
  });
});

describe("status cannot outrun the review evidence", () => {
  it("refuses content-reviewed with only a source review", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [knowledge({ contentStatus: "content-reviewed", verification: verified })],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("requires a CONTENT review");
  });

  it("refuses a status resting on a review that asked for changes", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [knowledge({ contentStatus: "source-verified", verification: verified })],
        reviews: [review({ decision: "REQUEST_CHANGES" })]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("REQUEST_CHANGES");
  });

  it("refuses production-eligible whose reviewStatus is not approved", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [knowledge({ contentStatus: "production-eligible", reviewStatus: "in-review", verification: verified })],
        reviews: [
          review(),
          review({ id: "REVIEW-0002", stage: "CONTENT" }),
          review({ id: "REVIEW-0003", stage: "FINAL" })
        ]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain('requires reviewStatus "approved"');
  });

  it("refuses a record that claims verification while still flagged as needing it", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        knowledge: [
          knowledge({
            contentStatus: "source-verified",
            verification: verified,
            flags: ["HUMAN-VERIFY-REQUIRED"]
          })
        ],
        reviews: [review()]
      })
    );
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("HUMAN-VERIFY-REQUIRED");
  });
});

describe("items are held to the same chain", () => {
  const item = (overrides: Record<string, unknown> = {}) => ({
    questionId: "NEXUS-L1-PRIV-000001",
    family: "ITEM",
    revision: 1,
    domain: "Medical Scribing",
    skillArea: "Privacy & Confidentiality",
    difficultyLevel: 1,
    questionType: "recognition",
    learningObjective: "Name the HIPAA term for individually identifiable health information.",
    question: "What term does the Rule use?",
    choices: [
      { id: "a", text: "Protected health information" },
      { id: "b", text: "Personal medical data" },
      { id: "c", text: "Confidential records" }
    ],
    correctChoiceId: "a",
    rationale: "The Rule's own term.",
    source: { ref: "HHS-PR-SUMMARY", locator: "What Information is Protected" },
    modality: "DIRECT_KNOWLEDGE",
    contentStatus: "candidate",
    reviewStatus: "pending",
    provenance,
    ...overrides
  });

  it("refuses an item whose human verification has no review", () => {
    const result = validateKnowledgeCorpus(corpus({ items: [item({ verification: verified })] }));
    expect(result.success).toBe(false);
    expect(errorsOf(result)).toContain("items.0");
  });

  it("accepts an item with a complete chain", () => {
    const result = validateKnowledgeCorpus(
      corpus({
        items: [item({ contentStatus: "source-verified", reviewStatus: "in-review", verification: verified })],
        reviews: [review({ target: "NEXUS-L1-PRIV-000001@1" })]
      })
    );
    expect(result.success, errorsOf(result)).toBe(true);
  });
});

describe("candidates are left alone", () => {
  it("asks nothing of a candidate that claims nothing", () => {
    const result = validateKnowledgeCorpus(corpus({ knowledge: [knowledge({ flags: ["HUMAN-VERIFY-REQUIRED"] })] }));
    expect(result.success, errorsOf(result)).toBe(true);
  });
});
