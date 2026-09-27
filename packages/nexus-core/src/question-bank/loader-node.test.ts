import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { QUESTION_BANK_DIR, loadQuestionBankDirectory, readQuestionBankFiles } from "./loader-node.js";
import { minimalQuestion } from "./__fixtures__/questions.js";

/**
 * Filesystem discovery, exercised against real directories.
 *
 * The temp-directory tests write throwaway content so discovery mechanics
 * (which files are picked up, in what order, which are skipped) are tested for
 * real rather than mocked. No medical content is invented here: the fixture is
 * the same structural question the other suites use.
 */

const SOURCES = {
  "HHS-PR-SUMMARY": {
    authority: "U.S. HHS Office for Civil Rights",
    title: "Summary of the HIPAA Privacy Rule"
  }
};

function bankJson(bankId: string, questions: unknown[]): string {
  return JSON.stringify({ bankId, version: "1", sources: SOURCES, questions }, null, 2);
}

describe("question bank discovery: the repository's own content directory", () => {
  it("points at content/question-bank and reads it without error", async () => {
    const dir = fileURLToPath(QUESTION_BANK_DIR);
    expect(dir).toMatch(/[/\\]content[/\\]question-bank$/);

    // Empty today by design — the schema and loader exist, no content has been
    // promoted into the bank. This must load cleanly rather than throw.
    const result = await loadQuestionBankDirectory(dir);
    expect(result.success, result.success ? "" : `shipped bank content failed to load:\n  ${result.errors.join("\n  ")}`).toBe(
      true
    );
  });

  it("is not one of the directories another content suite already scans", async () => {
    const dir = fileURLToPath(QUESTION_BANK_DIR);
    expect(dir).not.toMatch(/[/\\]lessons$/);
    expect(dir).not.toMatch(/[/\\]incoming$/);
    expect(dir).not.toMatch(/[/\\]scenarios([/\\].*)?$/);
  });

  it("reads a directory that does not exist as empty, rather than throwing", async () => {
    const missing = path.join(tmpdir(), "haa-nexus-no-such-question-bank-dir");
    await expect(readQuestionBankFiles(missing)).resolves.toEqual([]);
    const result = await loadQuestionBankDirectory(missing);
    expect(result.success).toBe(true);
  });
});

describe("question bank discovery: which files are picked up", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "haa-nexus-qbank-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("picks up .json files in name order and skips the rest", async () => {
    await writeFile(path.join(dir, "zulu.json"), bankJson("ZULU", [{ ...minimalQuestion, questionId: "Q-Z-1" }]));
    await writeFile(path.join(dir, "alpha.json"), bankJson("ALPHA", [{ ...minimalQuestion, questionId: "Q-A-1" }]));
    // Skipped: underscore-prefixed drafts (the convention scenario intake uses
    // for its template) and anything that is not JSON.
    await writeFile(path.join(dir, "_scratch.json"), "{ deliberately broken");
    await writeFile(path.join(dir, "notes.md"), "not content");
    await mkdir(path.join(dir, "nested"));

    const files = await readQuestionBankFiles(dir);
    expect(files.map((f) => f.file)).toEqual(["alpha.json", "zulu.json"]);

    const result = await loadQuestionBankDirectory(dir);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.questions.map((q) => q.questionId)).toEqual(["Q-A-1", "Q-Z-1"]);
  });

  it("fails the load when a discovered file is malformed, naming it", async () => {
    await writeFile(path.join(dir, "good.json"), bankJson("GOOD", [minimalQuestion]));
    await writeFile(path.join(dir, "broken.json"), "{ not json");

    const result = await loadQuestionBankDirectory(dir);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toMatch(/broken\.json: not valid JSON/);
  });

  it("fails the load when two discovered files share a question id", async () => {
    await writeFile(path.join(dir, "one.json"), bankJson("ONE", [minimalQuestion]));
    await writeFile(path.join(dir, "two.json"), bankJson("TWO", [minimalQuestion]));

    const result = await loadQuestionBankDirectory(dir);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toMatch(/duplicate question id "Q-MIN-0001" in one\.json and two\.json/);
  });

  it("refuses a real shipped lesson file dropped into the bank directory", async () => {
    // The mirror of the placement rule: a bank file in content/lessons fails
    // the lesson suite, and a lesson file here fails this one. Neither
    // directory quietly accepts the other's content.
    const lessonPath = fileURLToPath(new URL("../../../../content/lessons/hpi-fundamentals.json", import.meta.url));
    const { readFile } = await import("node:fs/promises");
    await writeFile(path.join(dir, "lesson.json"), await readFile(lessonPath, "utf-8"));

    const result = await loadQuestionBankDirectory(dir);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join("\n")).toMatch(/lesson\.json:/);
  });
});
