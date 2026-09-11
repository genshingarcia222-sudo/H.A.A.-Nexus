import { describe, expect, it } from "vitest";
import { scenarioKey, parseScenarioKey, compareVersions, isNewerVersion } from "./versioning.js";

describe("scenario versioning", () => {
  it("builds a composite key from scenarioId and version", () => {
    expect(scenarioKey("SCRIBE-OBGYN-001", "1.2")).toBe("SCRIBE-OBGYN-001@1.2");
  });

  it("parses a composite key back into its parts", () => {
    expect(parseScenarioKey("SCRIBE-OBGYN-001@1.2")).toEqual({
      scenarioId: "SCRIBE-OBGYN-001",
      version: "1.2"
    });
  });

  it("returns null for a malformed key", () => {
    expect(parseScenarioKey("no-at-sign")).toBeNull();
    expect(parseScenarioKey("@1.2")).toBeNull();
    expect(parseScenarioKey("SCRIBE-001@")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by major first", () => {
    expect(compareVersions("2.0", "1.9")).toBe(1);
  });

  it("orders by minor when major is equal", () => {
    expect(compareVersions("1.2", "1.10")).toBe(-1);
  });

  it("treats a missing patch as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
  });

  it("returns 0 for identical versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("isNewerVersion", () => {
  it("is true when the candidate is greater", () => {
    expect(isNewerVersion("1.3", "1.2")).toBe(true);
  });

  it("is false when the candidate is equal or older", () => {
    expect(isNewerVersion("1.2", "1.2")).toBe(false);
    expect(isNewerVersion("1.1", "1.2")).toBe(false);
  });
});
