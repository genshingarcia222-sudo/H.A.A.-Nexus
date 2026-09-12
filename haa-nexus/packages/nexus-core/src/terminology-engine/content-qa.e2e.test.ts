import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateTerminologyEntry } from "./schema.js";

const TERMINOLOGY_PATH = fileURLToPath(new URL("../../../../content/terminology/terminology.json", import.meta.url));

describe("content QA: shipped terminology dictionary", () => {
  it("passes schema validation for every entry", async () => {
    const raw = await readFile(TERMINOLOGY_PATH, "utf-8");
    const entries = JSON.parse(raw);
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const result = validateTerminologyEntry(entry);
      if (!result.success) {
        throw new Error(`Terminology entry "${entry.id}" failed validation:\n${result.errors.join("\n")}`);
      }
    }
  });

  it("has no duplicate ids", async () => {
    const raw = await readFile(TERMINOLOGY_PATH, "utf-8");
    const entries: { id: string }[] = JSON.parse(raw);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
