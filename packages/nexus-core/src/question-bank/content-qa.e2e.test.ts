import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isProductionEligible } from "./schema.js";
import { validateQuestionBank } from "./validate.js";

/**
 * Content QA for the question bank's own directory, `content/question-bank/`.
 *
 * That directory is deliberately *not* `content/lessons/` (whose content-QA
 * suite validates every JSON as a TrainingLesson), *not* `content/incoming/`
 * (scenario intake), and *not* under `content/scenarios/` (preflight and the
 * scenario content-QA suite). A bank file in any of those is read as something
 * it is not and fails a test that has nothing to do with it.
 *
 * Like scenario intake, this is optional: with no bank content shipped, these
 * tests pass and say nothing. They exist now so the first file dropped there is
 * checked on arrival rather than after a reviewer notices.
 *
 * This suite checks the directory's contents directly. The loader that reads it
 * for a consumer lives in `loader-node.ts` and is covered by its own suite;
 * nothing here loads bank content into the application, and no selector exists
 * — choosing which questions a learner sees is a separate, still-undecided
 * piece of work.
 */

const BANK_DIR = fileURLToPath(new URL("../../../../content/question-bank", import.meta.url));

async function loadBanks(): Promise<{ file: string; parsed: unknown }[]> {
  if (!existsSync(BANK_DIR)) return [];
  const files = (await readdir(BANK_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  return Promise.all(
    files.map(async (file) => ({
      file,
      parsed: JSON.parse(await readFile(path.join(BANK_DIR, file), "utf-8"))
    }))
  );
}

describe("content QA: question bank files", () => {
  it("the question bank directory exists and is not one of the scanned content paths", () => {
    expect(existsSync(BANK_DIR), "content/question-bank is missing").toBe(true);
    expect(BANK_DIR).not.toMatch(/[/\\]lessons$/);
    expect(BANK_DIR).not.toMatch(/[/\\]incoming$/);
    expect(BANK_DIR).not.toMatch(/[/\\]scenarios[/\\]?$/);
  });

  it("every bank file passes the real validator, with actionable errors when it does not", async () => {
    const failures: string[] = [];
    for (const { file, parsed } of await loadBanks()) {
      const result = validateQuestionBank(parsed);
      if (!result.success) failures.push(`${file}:\n    ${result.errors.join("\n    ")}`);
    }
    expect(failures, `bank files that do not validate:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("no shipped question claims to be production-eligible without a recorded human verification", async () => {
    // The schema already refuses a promoted status with no verifier. This is the
    // second lock, stated in terms of what actually matters: no question reaches
    // this directory claiming it may be shown to a learner unless a person
    // signed for it.
    const offenders: string[] = [];
    for (const { file, parsed } of await loadBanks()) {
      const result = validateQuestionBank(parsed);
      if (!result.success) continue;
      for (const question of result.data.questions) {
        if (question.contentStatus === "production-eligible" && !isProductionEligible(question)) {
          offenders.push(`${file}: ${question.questionId}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no two bank files reuse a question id", async () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const { file, parsed } of await loadBanks()) {
      const result = validateQuestionBank(parsed);
      if (!result.success) continue;
      for (const question of result.data.questions) {
        if (seen.has(question.questionId)) {
          collisions.push(`${question.questionId}: ${seen.get(question.questionId)} and ${file}`);
        }
        seen.set(question.questionId, file);
      }
    }
    expect(collisions).toEqual([]);
  });
});
