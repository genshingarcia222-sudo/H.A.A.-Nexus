import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryTerminologyRepository } from "./repository.js";
import type { TerminologyEntry } from "./schema.js";

const dryCough: TerminologyEntry = {
  id: "dry-cough-nonproductive",
  layTerm: "dry cough",
  clinicalTerm: "non-productive cough",
  acceptedAlternatives: ["non-productive cough", "cough without sputum"],
  category: "Respiratory",
  explanation: "A cough that does not produce sputum.",
  commonMistakes: []
};

const dyspnea: TerminologyEntry = {
  id: "shortness-of-breath-dyspnea",
  layTerm: "shortness of breath",
  clinicalTerm: "dyspnea",
  acceptedAlternatives: ["dyspnea on exertion"],
  category: "Respiratory",
  explanation: "Subjective difficulty breathing.",
  commonMistakes: []
};

describe("InMemoryTerminologyRepository", () => {
  let repo: InMemoryTerminologyRepository;
  beforeEach(() => {
    repo = new InMemoryTerminologyRepository();
    repo.register(dryCough);
    repo.register(dyspnea);
  });

  it("retrieves an entry by id", () => {
    expect(repo.get("dry-cough-nonproductive")?.clinicalTerm).toBe("non-productive cough");
  });

  it("refuses to register a duplicate id", () => {
    expect(() => repo.register(dryCough)).toThrow(/already registered/);
  });

  it("searches by lay term", () => {
    expect(repo.search("dry cough")).toHaveLength(1);
  });

  it("searches by clinical term case-insensitively", () => {
    expect(repo.search("DYSPNEA")).toHaveLength(1);
  });

  it("searches by accepted alternative", () => {
    expect(repo.search("cough without sputum")).toHaveLength(1);
  });

  it("returns everything for an empty query", () => {
    expect(repo.search("")).toHaveLength(2);
  });

  it("returns an empty array when nothing matches", () => {
    expect(repo.search("appendicitis")).toHaveLength(0);
  });
});
