import { describe, expect, it } from "vitest";
import { createQuestionBankRepository, loadQuestionBanks } from "./loader.js";
import { fullyPopulatedQuestion, minimalQuestion } from "./__fixtures__/questions.js";

const SOURCES = {
  "HHS-PR-SUMMARY": {
    authority: "U.S. HHS Office for Civil Rights",
    title: "Summary of the HIPAA Privacy Rule",
    url: "https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html"
  }
};

function bankJson(bankId: string, questions: unknown[], version = "1"): string {
  return JSON.stringify({ bankId, version, sources: SOURCES, questions });
}

function errorsFrom(files: { file: string; contents: string }[]): string[] {
  const result = loadQuestionBanks(files);
  expect(result.success, "expected this load to fail, but it succeeded").toBe(false);
  return result.success ? [] : result.errors;
}

describe("question bank loader: content that should load", () => {
  it("loads a valid bank", () => {
    const result = loadQuestionBanks([{ file: "privacy.json", contents: bankJson("PRIVACY", [minimalQuestion]) }]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.banks).toHaveLength(1);
    expect(result.banks[0]?.file).toBe("privacy.json");
    expect(result.questions.map((q) => q.questionId)).toEqual(["Q-MIN-0001"]);
  });

  it("loads nothing from no files, without complaining", () => {
    const result = loadQuestionBanks([]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.banks).toEqual([]);
    expect(result.questions).toEqual([]);
  });

  it("loads several files and orders them deterministically by name", () => {
    // Given in the wrong order on purpose: a directory listing's order must not
    // decide what a consumer sees.
    const result = loadQuestionBanks([
      { file: "zulu.json", contents: bankJson("ZULU", [fullyPopulatedQuestion]) },
      { file: "alpha.json", contents: bankJson("ALPHA", [minimalQuestion]) }
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.banks.map((b) => b.file)).toEqual(["alpha.json", "zulu.json"]);
    expect(result.questions.map((q) => q.questionId)).toEqual(["Q-MIN-0001", "Q-FULL-0001"]);
  });

  it("preserves every canonical field through the load", () => {
    const result = loadQuestionBanks([{ file: "icd.json", contents: bankJson("ICD", [fullyPopulatedQuestion]) }]);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const [loaded] = result.questions;
    expect(loaded).toBeDefined();
    if (!loaded) return;
    expect(loaded).toEqual(fullyPopulatedQuestion);
  });
});

describe("question bank loader: content that must be rejected", () => {
  it("rejects malformed JSON, naming the file", () => {
    const errors = errorsFrom([{ file: "broken.json", contents: "{ not json" }]);
    expect(errors.join("\n")).toMatch(/^broken\.json: not valid JSON/m);
  });

  it("rejects schema-invalid content", () => {
    const { correctChoiceId, ...noAnswerKey } = minimalQuestion;
    const errors = errorsFrom([{ file: "bad.json", contents: bankJson("BAD", [noAnswerKey]) }]);
    expect(errors.join("\n")).toMatch(/bad\.json: questions\.0\.correctChoiceId/);
  });

  it("rejects an unknown field rather than dropping it", () => {
    // Silent field loss is the hazard the strict schema exists to prevent, and
    // the loader must not reintroduce it by shrugging at extra keys.
    const errors = errorsFrom([
      { file: "extra.json", contents: bankJson("EXTRA", [{ ...minimalQuestion, tier: "pro" }]) }
    ]);
    expect(errors.join("\n")).toMatch(/extra\.json:.*tier/);
  });

  it("rejects an invalid content status", () => {
    const errors = errorsFrom([
      { file: "status.json", contents: bankJson("STATUS", [{ ...minimalQuestion, contentStatus: "READY" }]) }
    ]);
    expect(errors.join("\n")).toMatch(/status\.json: questions\.0\.contentStatus/);
  });

  it("rejects a status above candidate with no recorded human verification", () => {
    const errors = errorsFrom([
      {
        file: "promoted.json",
        contents: bankJson("PROMOTED", [{ ...minimalQuestion, contentStatus: "production-eligible" }])
      }
    ]);
    expect(errors.join("\n")).toMatch(/requires a recorded human verification/);
  });

  it("rejects a question id duplicated across two files, naming both", () => {
    const errors = errorsFrom([
      { file: "one.json", contents: bankJson("ONE", [minimalQuestion]) },
      { file: "two.json", contents: bankJson("TWO", [minimalQuestion]) }
    ]);
    expect(errors.join("\n")).toMatch(/duplicate question id "Q-MIN-0001" in one\.json and two\.json/);
  });

  it("reports every problem across every file, not just the first", () => {
    const errors = errorsFrom([
      { file: "a.json", contents: "{ not json" },
      { file: "b.json", contents: bankJson("B", [{ ...minimalQuestion, difficultyLevel: 9 }]) }
    ]);
    expect(errors.some((e) => e.startsWith("a.json"))).toBe(true);
    expect(errors.some((e) => e.startsWith("b.json"))).toBe(true);
  });

  it("loads nothing at all when any file fails", () => {
    // A partial load would leave a consumer working from a subset of the bank
    // without knowing it.
    const result = loadQuestionBanks([
      { file: "good.json", contents: bankJson("GOOD", [minimalQuestion]) },
      { file: "bad.json", contents: "{ not json" }
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects a lesson-shaped and a scenario-shaped file", () => {
    const lesson = {
      id: "hpi-fundamentals",
      title: "HPI Fundamentals",
      category: "Documentation Fundamentals",
      version: "1.0",
      explanation: "...",
      knowledgeChecks: [{ question: "Which belongs in the HPI?", options: ["a", "b"], correctOptionIndex: 0 }]
    };
    expect(errorsFrom([{ file: "lesson.json", contents: JSON.stringify(lesson) }]).length).toBeGreaterThan(0);

    const scenario = { scenarioId: "SCRIBE-FM-014", version: "1.0", title: "x", difficulty: 2 };
    expect(errorsFrom([{ file: "scenario.json", contents: JSON.stringify(scenario) }]).length).toBeGreaterThan(0);
  });
});

describe("question bank loader: status survives the load", () => {
  it("leaves a candidate a candidate", () => {
    const result = loadQuestionBanks([{ file: "c.json", contents: bankJson("C", [minimalQuestion]) }]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const [loaded] = result.questions;
    expect(loaded?.contentStatus).toBe("candidate");
    expect(loaded?.reviewStatus).toBe("pending");
  });
});

describe("createQuestionBankRepository", () => {
  it("loads straight into a populated repository", () => {
    const result = createQuestionBankRepository([
      { file: "a.json", contents: bankJson("A", [minimalQuestion]) },
      { file: "b.json", contents: bankJson("B", [fullyPopulatedQuestion]) }
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.repository.size).toBe(2);
    expect(result.repository.getById("Q-MIN-0001")?.contentStatus).toBe("candidate");
    // Candidates are present for tooling, and gated away from learner surfaces.
    expect(result.repository.getProductionEligible()).toEqual([]);
  });

  it("builds no repository at all when content fails to load", () => {
    const result = createQuestionBankRepository([{ file: "bad.json", contents: "{ not json" }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toMatch(/bad\.json/);
  });
});
