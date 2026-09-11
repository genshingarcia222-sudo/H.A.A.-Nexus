import { describe, expect, it } from "vitest";
import { evaluateAttempt, createEmptyDraft } from "@haa-nexus/nexus-core";
import { scenarioRepository } from "./scenarios.js";

describe("evaluateAttempt against real shipped content (SCRIBE-FM-014)", () => {
  const scenario = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

  it("is actually registered (sanity check before the real test)", () => {
    expect(scenario).toBeDefined();
  });

  it("scores a fully correct note highly with no errors", () => {
    const result = evaluateAttempt({
      scenario,
      draft: {
        ...createEmptyDraft(),
        chiefComplaint: "Cough x3 days.",
        hpi: "Non-productive cough x3 days.",
        ros: "No fever. Denies dyspnea."
      },
      activeMs: 120_000 // well within the 240s target
    });

    expect(result.errors).toHaveLength(0);
    expect(result.categoryScores.completeness).toBe(100);
    expect(result.categoryScores.accuracy).toBe(100);
    expect(result.overallScore).toBeGreaterThan(95);
  });

  it("flags the exact fabricated-temperature case from this scenario's own commonErrors", () => {
    const result = evaluateAttempt({
      scenario,
      draft: {
        ...createEmptyDraft(),
        chiefComplaint: "Cough x3 days.",
        hpi: "Non-productive cough x3 days.",
        ros: "No fever. Temperature 37.0°C. Denies dyspnea."
      },
      activeMs: 120_000
    });

    const fabrications = result.errors.filter((e) => e.errorType === "fabrication");
    expect(fabrications).toHaveLength(1);
    expect(fabrications[0]!.severity).toBe("critical");
  });

  it("scores an empty submission as fully incomplete but not inaccurate", () => {
    const result = evaluateAttempt({ scenario, draft: createEmptyDraft(), activeMs: 30_000 });
    expect(result.categoryScores.completeness).toBe(0);
    expect(result.categoryScores.accuracy).toBe(100);
    expect(result.errors.filter((e) => e.errorType === "omission")).toHaveLength(4);
  });
});
