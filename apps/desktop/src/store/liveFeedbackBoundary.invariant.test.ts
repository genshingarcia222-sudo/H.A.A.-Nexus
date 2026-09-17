import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createEmptyDraft,
  startSession,
  completeSession,
  pauseSession,
  type SimulationMode,
  type SimulationSession,
  type SessionStatus,
  type EvaluationResult
} from "@haa-nexus/nexus-core";
import { selectRevealableResult } from "./sessionStore.js";

/**
 * The Phase 8.3 live-feedback boundary (decision D2) as an enforced property
 * rather than a convention.
 *
 * Before this, every component that wanted to show a score had to remember to
 * call `mayRevealPerformance` first. A new surface that forgot would leak
 * performance information into an active assessment, and no test would notice,
 * because each existing test only covers the component it was written for.
 *
 * Two things are checked here: that the single guarded selector is correct for
 * every mode and status, and that no UI file reaches around it.
 */

const SCENARIO_DIFFICULTY = 1;

function sessionOf(mode: SimulationMode, status: SessionStatus): SimulationSession {
  const base = startSession(
    { id: `boundary-${mode}-${status}`, scenarioId: "SCRIBE-TEST-001", scenarioVersion: "1.0", mode },
    1000
  );
  if (status === "in_progress") return base;
  if (status === "completed") return completeSession(base, 3000);
  // An assessment cannot be paused at all - the machine throws
  // `PauseNotAllowedError`, which is the Phase 8.3 no-pause rule working. The
  // status is therefore set directly here, so the selector is still proven
  // against a state it must never reveal from, however it were reached.
  // `interrupted` and `abandoned` have no transition helper either.
  if (status === "paused" && mode !== "assessment") return pauseSession(base, 2000);
  return { ...base, status };
}

const RESULT = {
  overallScore: 88,
  categoryScores: { accuracy: 90, completeness: 88, terminology: 85, structure: 90, timeEfficiency: 87 },
  errors: [],
  scoringWeightsUsed: { accuracy: 0.3, completeness: 0.3, terminology: 0.2, structure: 0.1, timeEfficiency: 0.1 },
  timeEfficiencyRatio: 1,
  evaluatedAt: 3000
} as unknown as EvaluationResult;

const ALL_STATUSES: SessionStatus[] = ["in_progress", "paused", "completed", "interrupted", "abandoned"];

describe("live-feedback boundary - the guarded selector", () => {
  for (const status of ALL_STATUSES) {
    it(`reveals nothing for an assessment that is ${status}`, () => {
      const state = { session: sessionOf("assessment", status), result: RESULT } as never;
      const revealed = selectRevealableResult(state);
      if (status === "completed") expect(revealed).toBe(RESULT);
      else expect(revealed).toBeNull();
    });
  }

  for (const mode of ["practice", "simulation"] as const) {
    it(`leaves ${mode} unrestricted, because no restriction is authorized for it`, () => {
      for (const status of ALL_STATUSES) {
        const state = { session: sessionOf(mode, status), result: RESULT } as never;
        expect(selectRevealableResult(state)).toBe(RESULT);
      }
    });
  }

  it("returns null when there is no session or no result at all", () => {
    expect(selectRevealableResult({ session: null, result: RESULT } as never)).toBeNull();
    expect(
      selectRevealableResult({ session: sessionOf("practice", "completed"), result: null } as never)
    ).toBeNull();
    // Referenced so an unused-import change to this file cannot pass silently.
    expect(createEmptyDraft().hpi).toBe("");
    expect(SCENARIO_DIFFICULTY).toBe(1);
  });
});

describe("live-feedback boundary - no UI reads around the selector", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const srcRoot = path.join(here, "..");
  /** The store owns the raw field; everything else must go through the selector. */
  const OWNER = path.join(srcRoot, "store", "sessionStore.ts");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
      return [full];
    });
  }

  it("finds the application sources it is supposed to be scanning", () => {
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(path.join(srcRoot, "live-scribing", "SubmissionSummary.tsx"));
  });

  it("has no file other than the store reading the raw evaluation from session state", () => {
    // Matches `useSessionStore((s) => s.result)`, `getState().result` and any
    // other direct read of the unguarded field.
    const RAW_READ = /(?:=>\s*\w+\.result\b)|(?:getState\(\)\s*\.\s*result\b)|(?:\bstate\.result\b)/;
    const offenders = sourceFiles(srcRoot)
      .filter((file) => file !== OWNER)
      .filter((file) => RAW_READ.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file));
    expect(offenders, "must read through selectRevealableResult / useRevealableResult").toEqual([]);
  });

  it("keeps the summary - the one surface that shows a score - on the guarded selector", () => {
    const summary = readFileSync(path.join(srcRoot, "live-scribing", "SubmissionSummary.tsx"), "utf8");
    expect(summary).toContain("useRevealableResult()");
  });

  it("keeps the boundary itself in the domain, not in the desktop app", () => {
    const store = readFileSync(OWNER, "utf8");
    expect(store).toContain("mayRevealPerformance");
    // The rule is imported from nexus-core, never re-implemented here.
    expect(store).not.toMatch(/mode\s*===\s*"assessment"/);
  });
});
