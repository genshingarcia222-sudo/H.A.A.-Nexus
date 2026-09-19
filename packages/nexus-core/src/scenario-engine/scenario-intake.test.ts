import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateScenario } from "./validate.js";

/**
 * Scenario intake: the on-ramp for clinically authored content.
 *
 * A12 is blocked on clinical authoring, not on engineering — but an author
 * should not have to discover the schema by trial and error, or wait for a
 * reviewer to find a missing field. A draft dropped into `content/incoming/`
 * is checked here, against the **real** schema (`validateScenario`), so there
 * is no second definition of what valid content is.
 *
 * Intake deliberately does not check clinical truth. Whether a finding is
 * correct, safe, or appropriate for its difficulty is a human judgement that
 * no schema can make. This only proves a draft is structurally reviewable.
 *
 * The folder is optional: with no drafts, these tests pass and say nothing.
 */

const INCOMING_DIR = fileURLToPath(new URL("../../../../content/incoming", import.meta.url));
const RELEASED_DIR = fileURLToPath(new URL("../../../../content/scenarios/live-scribing", import.meta.url));

async function jsonFilesIn(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
}

async function loadIncoming(): Promise<{ file: string; parsed: unknown }[]> {
  const files = await jsonFilesIn(INCOMING_DIR);
  return Promise.all(
    files.map(async (file) => ({
      file,
      parsed: JSON.parse(await readFile(path.join(INCOMING_DIR, file), "utf-8"))
    }))
  );
}

describe("scenario intake: drafts awaiting clinical review", () => {
  it("every draft in content/incoming passes the real schema, with actionable errors when it does not", async () => {
    const drafts = await loadIncoming();
    const failures: string[] = [];

    for (const { file, parsed } of drafts) {
      const result = validateScenario(parsed);
      if (!result.success) {
        // The author needs the path and the reason, not "invalid".
        failures.push(`${file}:\n    ${result.errors.join("\n    ")}`);
      }
    }

    expect(failures, `drafts that cannot be reviewed yet:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("no draft reuses the id and version of released content", async () => {
    // Shipping a second SCRIBE-FM-014@1.0 would break the content-hash gate
    // and make a stored attempt ambiguous about what it was scored against.
    const drafts = await loadIncoming();
    if (drafts.length === 0) return;

    const released = new Set(
      (await Promise.all(
        (await jsonFilesIn(RELEASED_DIR)).map(async (file) => {
          const parsed = JSON.parse(await readFile(path.join(RELEASED_DIR, file), "utf-8")) as {
            scenarioId: string;
            version: string;
          };
          return `${parsed.scenarioId}@${parsed.version}`;
        })
      ))
    );

    const clashes = drafts
      .map(({ file, parsed }) => {
        const p = parsed as { scenarioId?: string; version?: string };
        return { file, key: `${p.scenarioId}@${p.version}` };
      })
      .filter(({ key }) => released.has(key));

    expect(clashes, `drafts colliding with released content: ${clashes.map((c) => `${c.file} (${c.key})`).join(", ")}`).toEqual(
      []
    );
  });

  it("no two drafts share an id and version", async () => {
    const drafts = await loadIncoming();
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const { file, parsed } of drafts) {
      const p = parsed as { scenarioId?: string; version?: string };
      const key = `${p.scenarioId}@${p.version}`;
      if (seen.has(key)) duplicates.push(`${key}: ${seen.get(key)} and ${file}`);
      seen.set(key, file);
    }

    expect(duplicates).toEqual([]);
  });

  it("the template itself is a valid scenario, so an author starts from something that passes", async () => {
    // The template is prefixed with _ so intake skips it as a draft, but it
    // must still satisfy the schema - a template that does not validate teaches
    // the wrong shape.
    const templatePath = path.join(INCOMING_DIR, "_TEMPLATE.scenario.json");
    if (!existsSync(templatePath)) return;

    const parsed = JSON.parse(await readFile(templatePath, "utf-8"));
    const result = validateScenario(parsed);
    expect(result.success, result.success ? "" : `template does not validate:\n  ${result.errors?.join("\n  ")}`).toBe(
      true
    );
  });
});
