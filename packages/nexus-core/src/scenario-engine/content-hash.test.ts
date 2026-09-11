import { describe, expect, it } from "vitest";
import { computeContentHash } from "./content-hash.js";

describe("computeContentHash", () => {
  it("produces the same hash regardless of key order", async () => {
    const a = await computeContentHash({ scenarioId: "X", version: "1.0", tags: ["a", "b"] });
    const b = await computeContentHash({ version: "1.0", tags: ["a", "b"], scenarioId: "X" });
    expect(a).toBe(b);
  });

  it("produces a different hash when content actually changes", async () => {
    const a = await computeContentHash({ scenarioId: "X", version: "1.0" });
    const b = await computeContentHash({ scenarioId: "X", version: "1.1" });
    expect(a).not.toBe(b);
  });

  it("produces a 64-character hex string (SHA-256)", async () => {
    const hash = await computeContentHash({ anything: true });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
