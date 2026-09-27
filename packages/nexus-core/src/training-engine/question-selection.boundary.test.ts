import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * The selector's boundaries, enforced against the source rather than trusted.
 *
 * Selection sits between several concerns that must stay apart:
 *
 *   Question Bank  what valid questions exist
 *   Selector       which of them this run receives   <- this module
 *   Entitlement    who may access them
 *   Persistence    what this learner has already seen
 *   Scoring        how performance is evaluated
 *
 * Each of those would be easy to reach for while "just" making selection a
 * little smarter — filter by tier here, remember a seen id there — and each
 * would quietly relocate a product decision into a content-adjacent module.
 * This test makes that visible in review instead of years later, the same way
 * `liveFeedbackBoundary.invariant.test.ts` guards the Assessment boundary.
 */

const SELECTOR = fileURLToPath(new URL("./question-selection.ts", import.meta.url));

async function selectorSource(): Promise<string> {
  return readFile(SELECTOR, "utf-8");
}

/** Import lines only — prose in comments may legitimately name these concepts. */
async function selectorImports(): Promise<string> {
  const source = await selectorSource();
  return source
    .split("\n")
    .filter((line) => /^\s*(import|export)\s.*\sfrom\s/.test(line))
    .join("\n");
}

describe("the selector reaches into no neighbouring concern", () => {
  it("imports nothing from entitlement, persistence, scoring, competency or analytics", async () => {
    const imports = await selectorImports();
    for (const forbidden of [
      "entitlement-engine",
      "persistence",
      "evaluation-engine",
      "competency-engine",
      "analytics-engine",
      "simulation-engine",
      "module-registry"
    ]) {
      expect(imports, `question-selection.ts must not import from ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("imports only from the question bank", async () => {
    const imports = await selectorImports();
    const paths = [...imports.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path, `unexpected dependency: ${path}`).toMatch(/^\.\.\/question-bank\//);
    }
  });

  it("names no subscription tier", async () => {
    // Difficulty is content metadata. The moment a tier name appears here,
    // `difficultyLevel -> tier` has been decided by implementation.
    const source = await selectorSource();
    for (const tier of ["Fast-Track", "fastTrack", "canStart", "CAPABILITY_MATRIX", "Entitlements"]) {
      expect(source, `question-selection.ts must not reference ${tier}`).not.toContain(tier);
    }
  });

  it("re-uses the bank's eligibility gate instead of defining its own", async () => {
    const source = await selectorSource();
    // One definition of "may a learner see this", and it lives with the content.
    expect(source).toContain("getProductionEligible()");
    expect(source).not.toContain("isProductionEligible(");
    expect(source).not.toContain('contentStatus ===');
    expect(source).not.toContain('reviewStatus ===');
  });

  it("performs no I/O and keeps no state between calls", async () => {
    const source = await selectorSource();
    for (const forbidden of ["node:fs", "localStorage", "fetch(", "new Map(", "new Set<string>()\nlet "]) {
      expect(source, `question-selection.ts must not use ${forbidden}`).not.toContain(forbidden);
    }
    // No module-level mutable state: every `let` must sit inside a function.
    expect(source).not.toMatch(/^let\s/m);
    expect(source).not.toMatch(/^var\s/m);
  });
});
