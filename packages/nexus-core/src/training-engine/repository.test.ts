import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryTrainingLessonRepository } from "./repository.js";
import type { TrainingLesson } from "./schema.js";

const hpiLesson: TrainingLesson = {
  id: "hpi-fundamentals",
  title: "HPI Fundamentals",
  category: "Documentation Fundamentals",
  version: "1.0",
  explanation: "...",
  examples: [],
  knowledgeChecks: [],
  linkedScenarioIds: []
};

const terminologyLesson: TrainingLesson = {
  id: "medical-terminology",
  title: "Medical Terminology",
  category: "Terminology",
  version: "1.0",
  explanation: "...",
  examples: [],
  knowledgeChecks: [],
  linkedScenarioIds: []
};

describe("InMemoryTrainingLessonRepository", () => {
  let repo: InMemoryTrainingLessonRepository;
  beforeEach(() => {
    repo = new InMemoryTrainingLessonRepository();
    repo.register(hpiLesson);
    repo.register(terminologyLesson);
  });

  it("retrieves a lesson by id", () => {
    expect(repo.get("hpi-fundamentals")?.title).toBe("HPI Fundamentals");
  });

  it("lists every registered lesson", () => {
    expect(repo.list()).toHaveLength(2);
  });

  it("filters by category", () => {
    expect(repo.byCategory("Terminology")).toHaveLength(1);
  });

  it("refuses a duplicate id", () => {
    expect(() => repo.register(hpiLesson)).toThrow(/already registered/);
  });
});
