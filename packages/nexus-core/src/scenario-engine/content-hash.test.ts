import { describe, expect, it } from "vitest";
import { computeContentHash, findContentHashViolations } from "./content-hash.js";

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

describe("findContentHashViolations (Architecture Package Section 29)", () => {
  const H1 = "a".repeat(64);
  const H2 = "b".repeat(64);
  const H3 = "c".repeat(64);

  it("reports nothing when every shipped version matches its recorded hash", () => {
    expect(findContentHashViolations({ "S@1.0": H1, "T@1.0": H2 }, { "S@1.0": H1, "T@1.0": H2 })).toEqual([]);
  });

  it("flags a released version whose content changed without a version bump", () => {
    expect(findContentHashViolations({ "S@1.0": H1 }, { "S@1.0": H2 })).toEqual([
      { kind: "changed-without-version-bump", key: "S@1.0", recorded: H1, actual: H2 }
    ]);
  });

  it("accepts the same change once it is published under a new, recorded version", () => {
    expect(findContentHashViolations({ "S@1.0": H1, "S@1.1": H2 }, { "S@1.0": H1, "S@1.1": H2 })).toEqual([]);
  });

  it("flags a new version that has not been recorded yet", () => {
    expect(findContentHashViolations({ "S@1.0": H1 }, { "S@1.0": H1, "S@1.1": H2 })).toEqual([
      { kind: "unrecorded", key: "S@1.1", actual: H2 }
    ]);
  });

  it("flags a recorded version that is no longer shipped", () => {
    expect(findContentHashViolations({ "S@1.0": H1, "S@0.9": H2 }, { "S@1.0": H1 })).toEqual([
      { kind: "recorded-but-missing", key: "S@0.9", recorded: H2 }
    ]);
  });

  it("reports every violation, in a stable order", () => {
    const recorded = { "B@1.0": H1, "A@1.0": H1, "Z@1.0": H3 };
    const actual = { "C@1.0": H2, "B@1.0": H2, "A@1.0": H1 };
    const once = findContentHashViolations(recorded, actual);
    expect(once.map((v) => `${v.key}:${v.kind}`)).toEqual([
      "B@1.0:changed-without-version-bump",
      "C@1.0:unrecorded",
      "Z@1.0:recorded-but-missing"
    ]);
    expect(findContentHashViolations(recorded, actual)).toEqual(once);
  });
});
