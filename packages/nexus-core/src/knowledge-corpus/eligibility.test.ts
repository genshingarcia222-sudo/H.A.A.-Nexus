import { describe, expect, it } from "vitest";
import { validateKnowledgeCorpus } from "./validate.js";
import type { KnowledgeCorpus } from "./validate.js";
import { deliverableItems, effectiveWindow, isDeliverable } from "./eligibility.js";
import { detectOverlappingPeriods } from "./conflict.js";
import { intersectWindows, modeAccepts, temporalState, upcomingTransitions } from "./temporal.js";

/**
 * D12 work package 4 — deliverability.
 *
 * Two questions, kept apart: is this record finished and verified, and may it
 * be delivered today. Each failing condition gets its own case, so removing a
 * check fails a test by name.
 */

const provenance = {
  generationMethod: "MACHINE_DRAFTED" as const,
  authoredBy: "machine:claude-code",
  authoredOn: "2026-09-21"
};

const reviewer = { id: "REV-ANA", displayName: "A. Reviewer" };
const verified = {
  humanVerificationRequired: true,
  humanVerifiedBy: "REV-ANA",
  humanVerifiedOn: "2026-09-22",
  reviewedSourceSnapshots: ["hhs-v1", "cms-fy27"]
};

const approvals = (target: string) => [
  { id: `${target}-S`, reviewerId: "REV-ANA", reviewedOn: "2026-09-22", target, stage: "SOURCE", decision: "APPROVE", sourceSnapshots: ["hhs-v1", "cms-fy27"] },
  { id: `${target}-C`, reviewerId: "REV-ANA", reviewedOn: "2026-09-23", target, stage: "CONTENT", decision: "APPROVE" },
  { id: `${target}-F`, reviewerId: "REV-ANA", reviewedOn: "2026-09-24", target, stage: "FINAL", decision: "APPROVE" }
];

const ready = { contentStatus: "production-eligible", reviewStatus: "approved", verification: verified, revision: 1 };

function build(overrides: Record<string, unknown> = {}): KnowledgeCorpus {
  const raw = {
    corpusId: "NEXUS-KNOWLEDGE",
    version: "1",
    sources: [
      {
        id: "HHS-PR-SUMMARY",
        authority: "U.S. HHS Office for Civil Rights",
        authorityClass: "OFFICIAL_GUIDANCE",
        title: "Summary of the HIPAA Privacy Rule",
        jurisdiction: "US",
        snapshotHash: "hhs-v1"
      }
    ],
    knowledge: [
      {
        ...ready,
        id: "NEXUS-KR-PRIV-000001",
        family: "KNOWLEDGE",
        kind: "RULE",
        domain: "Medical Scribing",
        topic: "Privacy & Confidentiality",
        title: "Minimum necessary standard",
        statement: "A covered entity must limit uses and disclosures to the minimum necessary.",
        evidence: [{ ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" }],
        applicability: { jurisdictions: ["US"] },
        provenance
      }
    ],
    concepts: [
      {
        ...ready,
        id: "PRIV-MIN-NECESSARY",
        family: "CONCEPT",
        statement: "The minimum necessary standard has defined exceptions.",
        domain: "Medical Scribing",
        provenance
      }
    ],
    items: [
      {
        ...ready,
        questionId: "NEXUS-L2-PRIV-000004",
        family: "ITEM",
        domain: "Medical Scribing",
        skillArea: "Privacy & Confidentiality",
        difficultyLevel: 2,
        questionType: "recall",
        learningObjective: "Identify a disclosure the standard does not apply to.",
        question: "Which disclosure is outside the minimum necessary standard?",
        choices: [
          { id: "a", text: "A disclosure to the patient themselves", why: "Listed as an exception." },
          { id: "b", text: "A disclosure to a billing vendor", why: "Subject to the standard." },
          { id: "c", text: "A disclosure to a colleague out of interest", why: "Not permitted at all." }
        ],
        correctChoiceId: "a",
        rationale: "The Rule lists disclosures to the individual among its exceptions.",
        source: { ref: "HHS-PR-SUMMARY", locator: "Minimum Necessary" },
        modality: "DIRECT_KNOWLEDGE",
        variantGroup: "PRIV-MIN-NECESSARY",
        knowledgeRefs: ["NEXUS-KR-PRIV-000001"],
        applicability: { jurisdictions: ["US"] },
        provenance
      }
    ],
    reviewers: [reviewer],
    reviews: [
      ...approvals("NEXUS-KR-PRIV-000001@1"),
      ...approvals("PRIV-MIN-NECESSARY@1"),
      ...approvals("NEXUS-L2-PRIV-000004@1")
    ],
    conflicts: [],
    ...overrides
  };
  const result = validateKnowledgeCorpus(raw);
  if (!result.success) throw new Error(result.errors.join("\n"));
  return result.data;
}

const TODAY = "2026-09-25";
const only = (corpus: KnowledgeCorpus) => corpus.items[0]!;
const check = (corpus: KnowledgeCorpus, asOf = TODAY, extra: Record<string, unknown> = {}) =>
  isDeliverable(only(corpus), corpus, { asOf, ...extra });

describe("temporal arithmetic", () => {
  it("intersects windows to the narrowest", () => {
    expect(intersectWindows([{ from: "2026-01-01" }, { from: "2026-10-01", to: "2027-09-30" }, { to: "2027-01-01" }])).toEqual({
      from: "2026-10-01",
      to: "2027-01-01"
    });
  });

  it("reports the state at a date, inclusive at both ends", () => {
    const window = { from: "2026-10-01", to: "2027-09-30" };
    expect(temporalState(window, "2026-09-30")).toBe("FUTURE_EFFECTIVE");
    expect(temporalState(window, "2026-10-01")).toBe("CURRENT");
    expect(temporalState(window, "2027-09-30")).toBe("CURRENT");
    expect(temporalState(window, "2027-10-01")).toBe("EXPIRED");
    expect(temporalState({}, "2026-09-25")).toBe("CURRENT");
  });

  it("calls an empty window impossible rather than current", () => {
    expect(temporalState({ from: "2027-01-01", to: "2026-01-01" }, "2026-06-01")).toBe("IMPOSSIBLE");
    expect(modeAccepts("INCLUDE_FUTURE", "IMPOSSIBLE")).toBe(false);
  });

  it("lets a mode decide which states it accepts", () => {
    expect(modeAccepts("CURRENT_ONLY", "FUTURE_EFFECTIVE")).toBe(false);
    expect(modeAccepts("INCLUDE_FUTURE", "FUTURE_EFFECTIVE")).toBe(true);
    expect(modeAccepts("CURRENT_ONLY", "EXPIRED")).toBe(false);
  });

  it("reports transitions due within the window, soonest first", () => {
    const transitions = upcomingTransitions(
      [
        { id: "FY2027", window: { from: "2026-10-01", to: "2027-09-30" } },
        { id: "FY2026", window: { to: "2026-09-30" } },
        { id: "later", window: { from: "2027-06-01" } }
      ],
      "2026-09-25",
      60
    );
    expect(transitions.map((t) => `${t.id}:${t.becomes}`)).toEqual(["FY2026:EXPIRED", "FY2027:CURRENT"]);
  });
});

describe("a complete corpus delivers", () => {
  it("delivers an item whose chain, sources and dates all hold", () => {
    const corpus = build();
    const result = check(corpus);
    expect(result.reasons).toEqual([]);
    expect(result.deliverable).toBe(true);
    expect(deliverableItems(corpus, { asOf: TODAY })).toHaveLength(1);
  });
});

describe("the static gate", () => {
  it("refuses a candidate, however complete it otherwise looks", () => {
    const corpus = build();
    const candidate = { ...only(corpus), contentStatus: "candidate" as const };
    const result = isDeliverable(candidate, corpus, { asOf: TODAY });
    expect(result.deliverable).toBe(false);
    expect(result.reasons.join("\n")).toContain('contentStatus is "candidate"');
  });

  it("refuses an item with no knowledge behind it", () => {
    const corpus = build();
    const ungrounded = { ...only(corpus), knowledgeRefs: [] };
    expect(isDeliverable(ungrounded, corpus, { asOf: TODAY }).reasons.join("\n")).toContain("cites no knowledge record");
  });

  it("refuses an item whose quality rules fail", () => {
    const corpus = build();
    const biased = {
      ...only(corpus),
      choices: [
        { id: "a", text: "A disclosure to the patient themselves, which the Rule lists as an exception", why: "x" },
        { id: "b", text: "A billing vendor", why: "y" },
        { id: "c", text: "A colleague", why: "z" }
      ]
    };
    expect(isDeliverable(biased, corpus, { asOf: TODAY }).reasons.join("\n")).toContain("answer-length-bias");
  });

  it("refuses an item standing only on a secondary source", () => {
    const corpus = build({
      sources: [
        {
          id: "HHS-PR-SUMMARY",
          authority: "A textbook",
          authorityClass: "SECONDARY",
          title: "Scribing textbook",
          jurisdiction: "US",
          snapshotHash: "hhs-v1"
        }
      ]
    });
    expect(check(corpus).reasons.join("\n")).toContain("authority class that may stand alone");
  });
});

describe("dates decide delivery, not status", () => {
  it("holds back a future-effective item and releases it on the day", () => {
    const corpus = build({
      sources: [
        {
          id: "HHS-PR-SUMMARY",
          authority: "CMS / NCHS",
          authorityClass: "OFFICIAL_CODE_SET",
          title: "ICD-10-CM Official Guidelines FY2027",
          jurisdiction: "US",
          snapshotHash: "hhs-v1",
          effectiveFrom: "2026-10-01",
          effectiveTo: "2027-09-30"
        }
      ]
    });
    const before = check(corpus, "2026-09-30");
    expect(before.deliverable).toBe(false);
    expect(before.temporalState).toBe("FUTURE_EFFECTIVE");

    expect(check(corpus, "2026-10-01").deliverable).toBe(true);
    expect(check(corpus, "2027-09-30").deliverable).toBe(true);
    expect(check(corpus, "2027-10-01").temporalState).toBe("EXPIRED");
  });

  it("inherits a source's window even when the item states none", () => {
    // The pilot's real case: an item resting on next year's guidelines is not
    // this year's content, whatever its own dates say.
    const corpus = build({
      sources: [
        {
          id: "HHS-PR-SUMMARY",
          authority: "CMS / NCHS",
          authorityClass: "OFFICIAL_CODE_SET",
          title: "FY2027 guidelines",
          jurisdiction: "US",
          snapshotHash: "hhs-v1",
          effectiveFrom: "2026-10-01",
          effectiveTo: "2027-09-30"
        }
      ]
    });
    expect(effectiveWindow(only(corpus), corpus)).toEqual({ from: "2026-10-01", to: "2027-09-30" });
  });

  it("delivers a future item only when the request asks for one", () => {
    const corpus = build({
      items: [{ ...build().items[0]!, applicability: { jurisdictions: ["US"], effectiveFrom: "2026-10-01" } }]
    });
    expect(check(corpus, "2026-09-25").deliverable).toBe(false);
    expect(check(corpus, "2026-09-25", { temporalMode: "INCLUDE_FUTURE" }).deliverable).toBe(true);
  });
});

describe("jurisdiction", () => {
  it("refuses an item that does not speak for the requested jurisdiction", () => {
    const corpus = build();
    expect(check(corpus, TODAY, { jurisdictions: ["PH"] }).reasons.join("\n")).toContain("not to PH");
  });

  it("delivers universal material to any request", () => {
    const corpus = build({
      items: [{ ...build().items[0]!, applicability: { jurisdictions: ["UNIVERSAL"] } }]
    });
    expect(check(corpus, TODAY, { jurisdictions: ["PH"] }).deliverable).toBe(true);
  });
});

describe("sources must still be what was reviewed", () => {
  it("stops delivery when a source has changed since review", () => {
    const corpus = build({
      sources: [
        {
          id: "HHS-PR-SUMMARY",
          authority: "U.S. HHS Office for Civil Rights",
          authorityClass: "OFFICIAL_GUIDANCE",
          title: "Summary of the HIPAA Privacy Rule",
          jurisdiction: "US",
          snapshotHash: "hhs-v2"
        }
      ]
    });
    expect(check(corpus).reasons.join("\n")).toContain("has changed since it was reviewed");
  });

  it("stops delivery when a source is withdrawn", () => {
    const corpus = build({
      sources: [
        {
          id: "HHS-PR-SUMMARY",
          authority: "U.S. HHS Office for Civil Rights",
          authorityClass: "OFFICIAL_GUIDANCE",
          title: "Summary of the HIPAA Privacy Rule",
          jurisdiction: "US",
          snapshotHash: "hhs-v1",
          status: "withdrawn"
        }
      ]
    });
    expect(check(corpus).reasons.join("\n")).toContain("withdrawn");
  });
});

describe("dependencies", () => {
  it("refuses an item whose knowledge is not production-eligible", () => {
    const corpus = build();
    const weakened: KnowledgeCorpus = {
      ...corpus,
      knowledge: [{ ...corpus.knowledge[0]!, contentStatus: "candidate" }]
    };
    expect(isDeliverable(only(weakened), weakened, { asOf: TODAY }).reasons.join("\n")).toContain(
      "which is not production-eligible"
    );
  });

  it("refuses an item whose knowledge has expired", () => {
    const corpus = build();
    const stale: KnowledgeCorpus = {
      ...corpus,
      knowledge: [
        { ...corpus.knowledge[0]!, applicability: { jurisdictions: ["US"], effectiveTo: "2026-01-01" } }
      ]
    };
    expect(isDeliverable(only(stale), stale, { asOf: TODAY }).reasons.join("\n")).toContain("expired before");
  });
});

describe("conflicts and supersession", () => {
  it("stops every record an open conflict names", () => {
    const corpus = build({
      conflicts: [
        {
          id: "CONFLICT-0001",
          kind: "CONTRADICTION",
          records: ["NEXUS-L2-PRIV-000004@1", "NEXUS-KR-PRIV-000001@1"],
          detectedBy: "REV-ANA"
        }
      ]
    });
    expect(check(corpus).reasons.join("\n")).toContain("open conflict");
  });

  it("releases them again once the conflict is resolved", () => {
    const corpus = build({
      conflicts: [
        {
          id: "CONFLICT-0001",
          kind: "CONTRADICTION",
          records: ["NEXUS-L2-PRIV-000004@1", "NEXUS-KR-PRIV-000001@1"],
          detectedBy: "REV-ANA",
          status: "resolved",
          resolution: "The newer guidance governs; the older statement was retired.",
          resolvedBy: "REV-ANA"
        }
      ]
    });
    expect(check(corpus).deliverable).toBe(true);
  });

  it("refuses to resolve a conflict without saying how or by whom", () => {
    const result = validateKnowledgeCorpus({
      ...build(),
      conflicts: [
        {
          id: "CONFLICT-0002",
          kind: "CONTRADICTION",
          records: ["NEXUS-L2-PRIV-000004@1", "NEXUS-KR-PRIV-000001@1"],
          detectedBy: "REV-ANA",
          status: "resolved"
        }
      ]
    });
    expect(result.success).toBe(false);
  });

  it("stops a superseded record", () => {
    const corpus = build();
    const withSuccessor: KnowledgeCorpus = {
      ...corpus,
      knowledge: [
        corpus.knowledge[0]!,
        { ...corpus.knowledge[0]!, id: "NEXUS-KR-PRIV-000002", supersedes: ["NEXUS-L2-PRIV-000004"] }
      ]
    };
    expect(isDeliverable(only(withSuccessor), withSuccessor, { asOf: TODAY }).reasons.join("\n")).toContain("superseded by");
  });

  it("suggests overlapping periods without blocking anything", () => {
    const candidates = detectOverlappingPeriods([
      { id: "A", concept: "PRIV-MIN-NECESSARY", jurisdictions: ["US"], from: "2026-01-01" },
      { id: "B", concept: "PRIV-MIN-NECESSARY", jurisdictions: ["US"], to: "2027-01-01" },
      { id: "C", concept: "OTHER", jurisdictions: ["US"] }
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.records).toEqual(["A", "B"]);
  });

  it("does not suggest an overlap for windows that do not meet", () => {
    expect(
      detectOverlappingPeriods([
        { id: "A", concept: "X", jurisdictions: ["US"], to: "2026-09-30" },
        { id: "B", concept: "X", jurisdictions: ["US"], from: "2026-10-01" }
      ])
    ).toEqual([]);
  });
});
