import { describe, expect, it } from "vitest";
import { validateTrainingLesson } from "./schema.js";

const validLesson = {
  id: "hpi-fundamentals",
  title: "HPI Fundamentals",
  category: "Documentation Fundamentals",
  version: "1.0",
  explanation: "The HPI captures the story of the present illness in chronological, clinically relevant detail.",
  examples: ["Onset, duration, and character of the complaint.", "Associated symptoms and pertinent negatives."],
  knowledgeChecks: [
    { question: "Which belongs in the HPI?", options: ["Onset of symptoms", "Family's insurance provider"], correctOptionIndex: 0 }
  ],
  linkedScenarioIds: ["SCRIBE-FM-014"]
};

describe("validateTrainingLesson", () => {
  it("accepts a well-formed lesson", () => {
    expect(validateTrainingLesson(validLesson).success).toBe(true);
  });

  it("rejects a lesson missing an explanation", () => {
    const { explanation, ...rest } = validLesson;
    expect(validateTrainingLesson(rest).success).toBe(false);
  });

  it("rejects a knowledge check with fewer than 2 options", () => {
    const bad = { ...validLesson, knowledgeChecks: [{ question: "Q?", options: ["only one"], correctOptionIndex: 0 }] };
    expect(validateTrainingLesson(bad).success).toBe(false);
  });

  it("defaults examples/knowledgeChecks/linkedScenarioIds to empty arrays", () => {
    const { examples, knowledgeChecks, linkedScenarioIds, ...rest } = validLesson;
    const result = validateTrainingLesson(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.examples).toEqual([]);
      expect(result.data.linkedScenarioIds).toEqual([]);
    }
  });
});
