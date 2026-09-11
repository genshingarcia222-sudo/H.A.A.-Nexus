import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateScenario } from "./validate.js";

const CONTENT_DIR = fileURLToPath(new URL("../../../../content/scenarios/live-scribing", import.meta.url));
const SAMPLE_SCENARIO_PATH = path.join(CONTENT_DIR, "SCRIBE-FM-014-v1.0.json");

async function loadAllScenarioFiles(): Promise<{ file: string; parsed: unknown }[]> {
  const filenames = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    filenames.map(async (file) => ({
      file,
      parsed: JSON.parse(await readFile(path.join(CONTENT_DIR, file), "utf-8"))
    }))
  );
}

describe("content QA: every shipped scenario package", () => {
  it("passes schema validation with no hard failures (Architecture Package Section 29)", async () => {
    const files = await loadAllScenarioFiles();
    expect(files.length).toBeGreaterThan(0); // guards against an accidentally-empty content dir

    for (const { file, parsed } of files) {
      const result = validateScenario(parsed);
      if (!result.success) {
        throw new Error(`${file} failed validation:\n${result.errors.join("\n")}`);
      }
    }
  });

  it("never traces a requirement's sourceFact to an unprovided numeric vital/lab value", async () => {
    // A blunt, generic version of the fabrication check below: no shipped
    // scenario should ever let a requirement's sourceFact itself contain a
    // number+unit pattern typical of a vital sign or lab value, since that
    // would mean the requirement is asking the learner to restate a
    // fabricated-looking value rather than a genuine encounter fact.
    const files = await loadAllScenarioFiles();
    const vitalPattern = /\b\d+(\.\d+)?\s*(°?c|°?f|bpm|mmhg|mg\/dl)\b/i;

    for (const { file, parsed } of files) {
      const scenario = parsed as {
        requiredDocumentation: { sourceFact: string }[];
        optionalDocumentation: { sourceFact: string }[];
      };
      const allSourceFacts = [
        ...scenario.requiredDocumentation.map((r) => r.sourceFact),
        ...scenario.optionalDocumentation.map((r) => r.sourceFact)
      ];
      const offender = allSourceFacts.find((fact) => vitalPattern.test(fact));
      expect(offender, `${file} has a suspicious numeric sourceFact: "${offender}"`).toBeUndefined();
    }
  });
});

describe("real content package: SCRIBE-FM-014-v1.0.json", () => {
  it("is present on disk and passes schema validation", async () => {
    const raw = await readFile(SAMPLE_SCENARIO_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const result = validateScenario(parsed);

    if (!result.success) {
      // Surface the actual validation errors in the test failure output
      // rather than a bare boolean, since this is meant to be a useful
      // content-QA check, not just a smoke test.
      throw new Error(`Sample scenario failed validation:\n${result.errors.join("\n")}`);
    }

    expect(result.success).toBe(true);
  });

  it("encodes the fabrication rule as data: the temperature error has no matching sourceFact", async () => {
    const raw = await readFile(SAMPLE_SCENARIO_PATH, "utf-8");
    const scenario = JSON.parse(raw);

    const allSourceFacts: string[] = [
      ...scenario.requiredDocumentation.map((r: { sourceFact: string }) => r.sourceFact),
      ...scenario.optionalDocumentation.map((r: { sourceFact: string }) => r.sourceFact)
    ];

    // The scenario's encounter never provides a temperature value anywhere,
    // so no requirement should ever trace to one.
    expect(allSourceFacts.some((fact) => /\d+(\.\d+)?\s*°?c/i.test(fact))).toBe(false);
  });
});
