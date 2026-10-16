import { describe, expect, it } from "vitest";
import {
  CHOICE_ONLY_KEYS,
  OPEN_RESPONSE_KINDS,
  OPEN_RESPONSE_SCORING_MODES,
  OpenResponseTaskSchema,
  isOpenResponseTask,
  mayDeliverOpenResponseTask,
  openResponseProductionBlockers
} from "./open-response.js";
import { CORPUS_FAMILIES } from "./schema.js";
import { AssessmentItemSchema } from "./item.js";
import { scoreSelection } from "./scoring.js";
import { KnowledgeCorpusSchema } from "./validate.js";

/**
 * O9 — the first-class open-response task.
 *
 * OWNER-DECIDED 2026-10-15. 114 of the 432 authored records carry zero choices
 * and an `expectedOutput`, and contract B's ITEM family extends a
 * multiple-choice question bank, so it could not represent them at all.
 *
 * What these tests mostly guard is the ways O9 could be quietly undone: a task
 * acquiring choices, a choice-based record passing as a task, an automated
 * scorer appearing without a validated rubric, or an unreviewed task reaching
 * production through a laxer gate than a question faces.
 */

const task = (overrides: Record<string, unknown> = {}) =>
  OpenResponseTaskSchema.safeParse({
    id: "KB-DOCT-KB001-000001",
    family: "TASK",
    kind: "DOCUMENTATION_TASK",
    revision: 1,
    domain: "Medical Scribing",
    prompt: "Reconstruct the encounter note from the packet below.",
    expectedOutput:
      "A written response that satisfies every acceptance criterion and cites the packet lines it rests on.",
    contentStatus: "candidate",
    reviewStatus: "pending",
    provenance: {
      generationMethod: "MACHINE_DRAFTED",
      authoredBy: "machine:claude-code",
      authoredOn: "2026-09-26"
    },
    ...overrides
  });

function parsed(overrides: Record<string, unknown> = {}) {
  const r = task(overrides);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
}

describe("O9: the task is a first-class family", () => {
  it("adds TASK to the corpus families without disturbing the others", () => {
    expect(CORPUS_FAMILIES).toContain("TASK");
    for (const f of ["KNOWLEDGE", "ITEM", "CONTEXT", "CONCEPT"]) {
      expect(CORPUS_FAMILIES, `${f} must survive`).toContain(f);
    }
  });

  it("accepts a well-formed free-text task", () => {
    const r = task();
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (!r.success) return;
    expect(r.data.family).toBe("TASK");
    expect(r.data.expectedOutput.length).toBeGreaterThan(0);
  });

  it("carries the governance spine, so a task is auditable like any record", () => {
    const d = parsed();
    for (const key of ["id", "revision", "contentStatus", "reviewStatus", "provenance", "flags"]) {
      expect(d, `${key} missing from the spine`).toHaveProperty(key);
    }
  });

  it("covers exactly the kinds the authored corpus uses", () => {
    expect([...OPEN_RESPONSE_KINDS].sort()).toEqual([
      "DOCUMENTATION_TASK",
      "QUESTION",
      "SCENARIO",
      "WORKFLOW"
    ]);
  });

  it("rejects a kind it has not been shown to represent", () => {
    expect(task({ kind: "INTERPRETIVE_DANCE" }).success).toBe(false);
  });
});

describe("O9: required fields, and no fabricated choices", () => {
  it("requires expectedOutput - it is what makes this a task", () => {
    // A task without it is a question with its choices missing, which is the
    // confusion O9 exists to prevent.
    const { expectedOutput: _omitted, ...rest } = {
      expectedOutput: "x",
      id: "KB-DOCT-KB001-000001",
      family: "TASK" as const,
      kind: "DOCUMENTATION_TASK" as const,
      revision: 1,
      domain: "Medical Scribing",
      prompt: "Reconstruct the note.",
      contentStatus: "candidate" as const,
      reviewStatus: "pending" as const,
      provenance: {
        generationMethod: "MACHINE_DRAFTED" as const,
        authoredBy: "machine:claude-code",
        authoredOn: "2026-09-26"
      }
    };
    expect(OpenResponseTaskSchema.safeParse(rest).success).toBe(false);
  });

  it("requires the prompt and rejects an empty one", () => {
    expect(task({ prompt: "" }).success).toBe(false);
  });

  it("REJECTS every choice-only key, which is the enforcement", () => {
    // `.strict()` is what makes O9's "no fabricated choices" structural rather
    // than advisory. Each key gets its own assertion so a failure names it.
    for (const key of CHOICE_ONLY_KEYS) {
      const r = task({ [key]: key === "choices" ? [{ id: "a", text: "x" }] : "a" });
      expect(r.success, `${key} must be rejected on a TASK`).toBe(false);
    }
  });

  it("rejects an unknown key outright", () => {
    expect(task({ smuggled: true }).success).toBe(false);
  });
});

describe("O9: the multiple-choice contract is untouched", () => {
  const item = {
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

  it("BACKWARD COMPATIBILITY: an existing item still validates unchanged", () => {
    const r = AssessmentItemSchema.safeParse(item);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("still enforces the 3-5 choice rule - O9 did not relax it", () => {
    // The temptation O9 explicitly refuses: making choices optional so the 114
    // records fit. If this ever passes, D11/D12 was weakened.
    expect(AssessmentItemSchema.safeParse({ ...item, choices: [] }).success).toBe(false);
    expect(
      AssessmentItemSchema.safeParse({ ...item, choices: item.choices.slice(0, 2) }).success
    ).toBe(false);
  });

  it("still requires correctChoiceId on an item", () => {
    const { correctChoiceId: _omitted, ...withoutAnswer } = item;
    expect(AssessmentItemSchema.safeParse(withoutAnswer).success).toBe(false);
  });

  it("an item cannot declare itself a TASK", () => {
    expect(AssessmentItemSchema.safeParse({ ...item, family: "TASK" }).success).toBe(false);
  });
});

describe("O9: scoring integrity - no fabricated score is reachable", () => {
  it("offers exactly one scoring mode, and it requires a human", () => {
    // A second member here would make the prohibition unenforceable, so the
    // count is the assertion.
    expect([...OPEN_RESPONSE_SCORING_MODES]).toEqual(["HUMAN_REVIEW_REQUIRED"]);
  });

  it("defaults every task to HUMAN_REVIEW_REQUIRED", () => {
    expect(parsed().scoringMode).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("rejects any other scoring mode, including a plausible automated one", () => {
    for (const mode of ["AUTOMATED", "RUBRIC", "ACCEPTANCE_CRITERIA", ""]) {
      expect(task({ scoringMode: mode }).success, mode).toBe(false);
    }
  });

  it("a task is identifiable at runtime, so a JS consumer can refuse it", () => {
    expect(isOpenResponseTask(parsed())).toBe(true);
    expect(isOpenResponseTask({ family: "ITEM" })).toBe(false);
    expect(isOpenResponseTask(null)).toBe(false);
    expect(isOpenResponseTask("TASK")).toBe(false);
  });

  it("THE GUARANTEE: a choice-based evaluator cannot score a task", () => {
    // `scoreSelection` is typed to an AssessmentItem, but a migration output or
    // a JS consumer could hand it a task at runtime. It must not return credit.
    const t = parsed();
    const score = scoreSelection(t as never, ["a"]);
    expect(score.credit).toBe(0);
  });

  it("acceptanceCriteria does not become a scorer just by being present", () => {
    // The corpus carries per-criterion `credit` weights on all 432 records.
    // They are a rubric shape that was never validated as a scorer, so their
    // presence must not change the scoring mode.
    const t = parsed({
      acceptanceCriteria: [
        { id: "AC1", requirement: "Identifies the scope boundary.", credit: 0.5 },
        { id: "AC2", requirement: "Routes to the named clinician.", credit: 0.5 }
      ]
    });
    expect(t.scoringMode).toBe("HUMAN_REVIEW_REQUIRED");
    expect(openResponseProductionBlockers(t)).not.toEqual([]);
  });
});

describe("O9: an unreviewed task cannot reach production", () => {
  it("blocks a candidate task, naming every reason", () => {
    const blockers = openResponseProductionBlockers(parsed());
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.join(" ")).toMatch(/contentStatus/);
    expect(blockers.join(" ")).toMatch(/reviewStatus/);
    expect(mayDeliverOpenResponseTask(parsed())).toBe(false);
  });

  it("blocks a task still carrying HUMAN-VERIFY-REQUIRED", () => {
    const t = parsed({
      contentStatus: "production-eligible",
      reviewStatus: "approved",
      flags: ["HUMAN-VERIFY-REQUIRED"],
      applicability: { effectiveFrom: "2026-01-01", jurisdictions: ["UNIVERSAL"] }
    });
    expect(openResponseProductionBlockers(t).join(" ")).toMatch(/HUMAN-VERIFY-REQUIRED/);
    expect(mayDeliverOpenResponseTask(t)).toBe(false);
  });

  it("blocks a task with no applicability", () => {
    const t = parsed({ contentStatus: "production-eligible", reviewStatus: "approved" });
    expect(openResponseProductionBlockers(t).join(" ")).toMatch(/applicability/);
  });

  it("allows one only when lifecycle, review, flags and applicability all pass", () => {
    const t = parsed({
      contentStatus: "production-eligible",
      reviewStatus: "approved",
      applicability: { effectiveFrom: "2026-01-01", jurisdictions: ["UNIVERSAL"] }
    });
    expect(openResponseProductionBlockers(t)).toEqual([]);
    expect(mayDeliverOpenResponseTask(t)).toBe(true);
  });

  it("uses the SAME four predicates the other families face", () => {
    // Not a laxer parallel gate. If a task could ship on weaker conditions than
    // a question, O9 would have become a loophole.
    const t = parsed();
    const reasons = openResponseProductionBlockers(t).join(" ");
    for (const predicate of ["contentStatus", "reviewStatus"]) {
      expect(reasons).toContain(predicate);
    }
  });
});

describe("O9: serialisation and the corpus container", () => {
  it("round-trips through JSON without losing a field", () => {
    const t = parsed({
      safetyFlags: ["SAFETY_SCOPE_BOUNDARY"],
      jurisdictions: ["UNIVERSAL"],
      difficultyBand: "HARD",
      evidence: [{ ref: "NEXUS-KB-ARCHIVE-V1.0", locator: "p.12", supports: "CONTEXT" }]
    });
    const round = OpenResponseTaskSchema.safeParse(JSON.parse(JSON.stringify(t)));
    expect(round.success, round.success ? "" : JSON.stringify(round.error?.issues)).toBe(true);
    if (!round.success) return;
    expect(round.data).toEqual(t);
  });

  it("the corpus container accepts a tasks array", () => {
    const corpus = KnowledgeCorpusSchema.safeParse({
      corpusId: "KB-TEST",
      version: "1.0.0",
      tasks: [parsed()]
    });
    expect(corpus.success, corpus.success ? "" : JSON.stringify(corpus.error?.issues)).toBe(true);
    if (!corpus.success) return;
    expect(corpus.data.tasks).toHaveLength(1);
    expect(corpus.data.tasks[0]!.family).toBe("TASK");
  });

  it("the container still defaults tasks to empty, so existing corpora load", () => {
    const corpus = KnowledgeCorpusSchema.safeParse({ corpusId: "KB-TEST", version: "1.0.0" });
    expect(corpus.success).toBe(true);
    if (corpus.success) expect(corpus.data.tasks).toEqual([]);
  });

  it("the container rejects a task in the items array", () => {
    const corpus = KnowledgeCorpusSchema.safeParse({
      corpusId: "KB-TEST",
      version: "1.0.0",
      items: [parsed()]
    });
    expect(corpus.success).toBe(false);
  });
});
