import { describe, expect, it } from "vitest";
import { scenarioRepository, terminologyRepository, lessonRepository } from "./scenarios.js";

describe("bundled scenario content loading", () => {
  it("loads and validates both built-in scenarios without throwing", () => {
    // If content/scenarios.ts's validateScenario() gate ever failed, this
    // import itself would have thrown before this test file even ran.
    const scenarios = scenarioRepository.list();
    expect(scenarios).toHaveLength(2);
  });

  it("registers SCRIBE-FM-014 and makes it retrievable by id + version", () => {
    const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0");
    expect(scenario?.title).toBe("Three-Day Cough, Family Medicine");
  });

  it("registers SCRIBE-IM-032 and makes it retrievable by id + version", () => {
    const scenario = scenarioRepository.get("SCRIBE-IM-032", "1.0");
    expect(scenario?.specialty).toBe("Internal Medicine");
  });
});

describe("bundled terminology content loading", () => {
  it("loads all shipped terminology entries", () => {
    expect(terminologyRepository.list().length).toBeGreaterThanOrEqual(4);
  });

  it("is searchable by lay term", () => {
    expect(terminologyRepository.search("heart racing")).toHaveLength(1);
  });
});

describe("bundled lesson content loading", () => {
  it("loads all three lessons referenced by the recommendation engine", () => {
    expect(lessonRepository.get("hpi-fundamentals")).toBeDefined();
    expect(lessonRepository.get("medical-terminology")).toBeDefined();
    expect(lessonRepository.get("accuracy-and-unsupported-inference")).toBeDefined();
  });
});
