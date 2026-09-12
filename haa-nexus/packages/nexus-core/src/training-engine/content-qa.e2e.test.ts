import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateTrainingLesson } from "./schema.js";

const LESSONS_DIR = fileURLToPath(new URL("../../../../content/lessons", import.meta.url));

async function loadAllLessons() {
  const filenames = (await readdir(LESSONS_DIR)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    filenames.map(async (file) => ({
      file,
      parsed: JSON.parse(await readFile(path.join(LESSONS_DIR, file), "utf-8"))
    }))
  );
}

describe("content QA: shipped lessons", () => {
  it("passes schema validation for every lesson file", async () => {
    const files = await loadAllLessons();
    expect(files.length).toBeGreaterThan(0);

    for (const { file, parsed } of files) {
      const result = validateTrainingLesson(parsed);
      if (!result.success) {
        throw new Error(`${file} failed validation:\n${result.errors.join("\n")}`);
      }
    }
  });

  it("includes every lesson id the recommendation engine references", async () => {
    // Kept as literal strings (not an import from recommendation-engine)
    // deliberately: this test should fail loudly if either side drifts,
    // rather than silently staying in sync via a shared constant.
    const referencedByRecommendations = ["hpi-fundamentals", "medical-terminology", "accuracy-and-unsupported-inference"];
    const files = await loadAllLessons();
    const shippedIds = new Set(files.map((f) => f.parsed.id));

    for (const id of referencedByRecommendations) {
      expect(shippedIds.has(id), `recommendation engine references lesson "${id}" but it isn't shipped`).toBe(true);
    }
  });
});
