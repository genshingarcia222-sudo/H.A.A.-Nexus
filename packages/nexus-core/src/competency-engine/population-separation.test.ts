import { describe, expect, it } from "vitest";
import { createUnassessedRecord, updateCompetencyRecord, type CompetencyRecord } from "./index.js";
import { InMemoryCompetencyRepository } from "../persistence/competency-repository.js";
import { RESULT_POPULATIONS, resultPopulationFor } from "../types/result-population.js";

/**
 * Decision D5 — Practice and Assessment are separate competency populations.
 *
 * Owner-selected 2026-09-20. These prove the *separation*, not the presence of
 * a field: a record with a `population` property that still overwrites the
 * other population would satisfy a naive test and violate the decision.
 *
 * D5 changed the population boundary, not the competency formula. Within one
 * population the rolling average, trend, level and confidence behave exactly
 * as they did before, which is asserted here so a future change cannot quietly
 * alter scoring under cover of the separation.
 */

describe("resultPopulationFor", () => {
  it("routes assessment to its own population", () => {
    expect(resultPopulationFor("assessment")).toBe("assessment");
  });

  it("keeps practice and simulation together, where simulation already counted", () => {
    // D5 separated Assessment from Practice and said nothing about simulation.
    // Moving it would be deciding something nobody decided.
    expect(resultPopulationFor("practice")).toBe("practice");
    expect(resultPopulationFor("simulation")).toBe("practice");
  });

  it("has exactly the two populations the decision names", () => {
    expect([...RESULT_POPULATIONS]).toEqual(["practice", "assessment"]);
  });
});

describe("D5: competency records carry their population", () => {
  it("stamps the population on a folded record", () => {
    const practice = updateCompetencyRecord(undefined, "practice", "accuracy", 80, 1000);
    const assessment = updateCompetencyRecord(undefined, "assessment", "accuracy", 40, 1000);

    expect(practice.population).toBe("practice");
    expect(assessment.population).toBe("assessment");
  });

  it("stamps it on an unassessed record too", () => {
    expect(createUnassessedRecord("assessment", "accuracy", 1000).population).toBe("assessment");
  });

  it("refuses to fold a score into another population's record", () => {
    // The structural defence: merging two signals is an error, not an average.
    const practice = updateCompetencyRecord(undefined, "practice", "accuracy", 80, 1000);
    expect(() => updateCompetencyRecord(practice, "assessment", "accuracy", 40, 2000)).toThrow(
      /assessment score into a practice/
    );
  });
});

describe("D5: the two populations coexist without touching each other", () => {
  const repo = () => new InMemoryCompetencyRepository();

  it("keeps separate records for the same domain", async () => {
    const r = repo();
    await r.upsert(updateCompetencyRecord(undefined, "practice", "accuracy", 90, 1000));
    await r.upsert(updateCompetencyRecord(undefined, "assessment", "accuracy", 30, 1000));

    expect((await r.get("practice", "accuracy"))?.avgScore).toBe(90);
    expect((await r.get("assessment", "accuracy"))?.avgScore).toBe(30);
    expect(await r.list()).toHaveLength(2);
  });

  it("an assessment fold cannot overwrite practice competency", async () => {
    const r = repo();
    await r.upsert(updateCompetencyRecord(undefined, "practice", "accuracy", 90, 1000));

    const existing = await r.get("assessment", "accuracy");
    expect(existing, "assessment must not see the practice record").toBeUndefined();
    await r.upsertMany([updateCompetencyRecord(existing, "assessment", "accuracy", 30, 2000)]);

    const practice = await r.get("practice", "accuracy");
    expect(practice?.avgScore).toBe(90);
    expect(practice?.attemptCount).toBe(1);
  });

  it("a practice fold cannot overwrite assessment competency", async () => {
    const r = repo();
    await r.upsert(updateCompetencyRecord(undefined, "assessment", "accuracy", 30, 1000));

    const existing = await r.get("practice", "accuracy");
    expect(existing).toBeUndefined();
    await r.upsertMany([updateCompetencyRecord(existing, "practice", "accuracy", 90, 2000)]);

    const assessment = await r.get("assessment", "accuracy");
    expect(assessment?.avgScore).toBe(30);
    expect(assessment?.attemptCount).toBe(1);
  });

  it("a read of one population never returns the other", async () => {
    const r = repo();
    await r.upsert(updateCompetencyRecord(undefined, "practice", "terminology", 100, 1000));

    expect(await r.get("assessment", "terminology")).toBeUndefined();
    const all = await r.list();
    expect(all.filter((c) => c.population === "assessment")).toEqual([]);
  });

  it("re-folding replaces only its own population's record", async () => {
    const r = repo();
    await r.upsertMany([
      updateCompetencyRecord(undefined, "practice", "accuracy", 90, 1000),
      updateCompetencyRecord(undefined, "assessment", "accuracy", 30, 1000)
    ]);

    const before = await r.get("assessment", "accuracy");
    await r.upsertMany([updateCompetencyRecord(before, "assessment", "accuracy", 50, 2000)]);

    expect((await r.get("assessment", "accuracy"))?.attemptCount).toBe(2);
    expect((await r.get("practice", "accuracy"))?.attemptCount).toBe(1);
    expect(await r.list()).toHaveLength(2);
  });
});

describe("D5 changed the population boundary, not the competency formula", () => {
  it("aggregates repeated attempts within a population exactly as before", () => {
    // The existing semantics: a rolling average over recent scores, an
    // incrementing attempt count. No best-score, latest-score or replacement
    // rule was introduced, because none was decided.
    let record: CompetencyRecord | undefined;
    for (const score of [60, 80, 100]) {
      record = updateCompetencyRecord(record, "assessment", "accuracy", score, 1000);
    }

    expect(record!.attemptCount).toBe(3);
    expect(record!.avgScore).toBe(80);
    expect(record!.recentScore).toBe(100);
    expect(record!.recentScores).toEqual([60, 80, 100]);
  });

  it("produces identical figures for the same scores in either population", () => {
    const practice = [70, 90].reduce<CompetencyRecord | undefined>(
      (acc, s) => updateCompetencyRecord(acc, "practice", "accuracy", s, 1000),
      undefined
    )!;
    const assessment = [70, 90].reduce<CompetencyRecord | undefined>(
      (acc, s) => updateCompetencyRecord(acc, "assessment", "accuracy", s, 1000),
      undefined
    )!;

    const { population: _p, ...practiceRest } = practice;
    const { population: _a, ...assessmentRest } = assessment;
    expect(assessmentRest).toEqual(practiceRest);
  });
});
