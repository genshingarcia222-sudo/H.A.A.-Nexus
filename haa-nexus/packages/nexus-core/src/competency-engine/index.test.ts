import { describe, expect, it } from "vitest";
import { createUnassessedRecord, updateCompetencyRecord } from "./index.js";

describe("createUnassessedRecord", () => {
  it("starts at unassessed with zero attempts", () => {
    const record = createUnassessedRecord("HPI", 1000);
    expect(record.level).toBe("unassessed");
    expect(record.attemptCount).toBe(0);
  });
});

describe("updateCompetencyRecord - level thresholds", () => {
  it("moves to introduced after a single attempt regardless of score", () => {
    const record = updateCompetencyRecord(undefined, "HPI", 20, 1000);
    expect(record.level).toBe("introduced");
    expect(record.attemptCount).toBe(1);
  });

  it("reaches developing at 3 attempts averaging >= 50", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (const score of [60, 60, 60]) {
      record = updateCompetencyRecord(record, "HPI", score, 1000);
    }
    expect(record!.level).toBe("developing");
  });

  it("does not reach developing with only 2 attempts even at a high score", () => {
    let record = updateCompetencyRecord(undefined, "HPI", 90, 1000);
    record = updateCompetencyRecord(record, "HPI", 90, 1000);
    expect(record.level).toBe("introduced");
  });

  it("reaches competent at 5 attempts averaging >= 75", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (let i = 0; i < 5; i++) record = updateCompetencyRecord(record, "HPI", 80, 1000);
    expect(record!.level).toBe("competent");
  });

  it("reaches advanced at 8 attempts averaging >= 88", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (let i = 0; i < 8; i++) record = updateCompetencyRecord(record, "HPI", 90, 1000);
    expect(record!.level).toBe("advanced");
  });

  it("reaches mastered at 10 attempts averaging >= 95 with a non-down trend", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (let i = 0; i < 10; i++) record = updateCompetencyRecord(record, "HPI", 97, 1000);
    expect(record!.level).toBe("mastered");
  });

  it("does not award mastered on a downward trend even if the average is high enough", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (let i = 0; i < 9; i++) record = updateCompetencyRecord(record, "HPI", 97, 1000);
    // final score drops sharply -> trend should be "down"
    record = updateCompetencyRecord(record, "HPI", 70, 1000);
    expect(record!.trend).toBe("down");
    expect(record!.level).not.toBe("mastered");
  });

  it("stays at competent (not advanced) when attempt count is high but average is only 80", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (let i = 0; i < 10; i++) record = updateCompetencyRecord(record, "HPI", 80, 1000);
    expect(record!.level).toBe("competent");
  });
});

describe("updateCompetencyRecord - rolling window", () => {
  it("caps recentScores at the last 10 entries", () => {
    let record: ReturnType<typeof updateCompetencyRecord> | undefined;
    for (let i = 0; i < 15; i++) record = updateCompetencyRecord(record, "HPI", 50, 1000);
    expect(record!.recentScores).toHaveLength(10);
    expect(record!.attemptCount).toBe(15); // attemptCount keeps counting beyond the window
  });
});

describe("updateCompetencyRecord - confidence", () => {
  it("scales toward 1.0 as attempts approach the 10-attempt window", () => {
    let record = updateCompetencyRecord(undefined, "HPI", 80, 1000);
    expect(record.confidence).toBeCloseTo(0.1);
    for (let i = 0; i < 9; i++) record = updateCompetencyRecord(record, "HPI", 80, 1000);
    expect(record.confidence).toBe(1);
  });
});
