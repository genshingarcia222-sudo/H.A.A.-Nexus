import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { CompetencyLevel, SessionStatus, SimulationMode } from "@haa-nexus/nexus-core";

/**
 * The domain's string unions against the SQLite CHECK constraints that have to
 * store them.
 *
 * These two definitions are written in different languages, in different
 * files, and nothing connects them. A value added to a union - a new session
 * status, a new mode - typechecks, tests green, and then fails at runtime the
 * first time a real learner's session is written, because SQLite rejects it.
 * `evaluation_failed`, `retried`, `interrupted`, `abandoned` and `not_started`
 * are exactly the values at risk: they are part of the union today but nothing
 * writes them yet, so no existing test would notice if the schema lost them.
 *
 * Each list below is compiler-checked with `satisfies Record<T, true>`, so it
 * cannot drift from the union, and is then compared to the constraint parsed
 * out of the migration that currently owns the table.
 */

const SESSION_STATUSES = {
  not_started: true,
  in_progress: true,
  paused: true,
  completed: true,
  interrupted: true,
  abandoned: true,
  evaluation_failed: true,
  retried: true
} satisfies Record<SessionStatus, true>;

const SIMULATION_MODES = {
  practice: true,
  simulation: true,
  assessment: true
} satisfies Record<SimulationMode, true>;

const COMPETENCY_LEVELS = {
  unassessed: true,
  introduced: true,
  developing: true,
  competent: true,
  advanced: true,
  mastered: true
} satisfies Record<CompetencyLevel, true>;

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src-tauri/migrations");

/** Migration files in application order, as the runner applies them. */
function migrations(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(migrationsDir, name), "utf8") }));
}

/**
 * The CHECK list for `column` as it stands after every migration has run: the
 * last migration that defines it wins, which is how a table rebuild (002)
 * supersedes the original definition (001).
 */
function effectiveCheckList(column: string): { values: string[]; source: string } {
  const pattern = new RegExp(`${column}\\s+TEXT NOT NULL CHECK \\(${column} IN\\s*\\(([^)]*)\\)`, "g");
  let found: { values: string[]; source: string } | null = null;
  for (const { name, sql } of migrations()) {
    for (const m of sql.matchAll(pattern)) {
      found = {
        values: m[1]!.split(",").map((v) => v.trim().replace(/^'|'$/g, "")).filter(Boolean),
        source: name
      };
    }
  }
  if (!found) throw new Error(`no CHECK constraint found for column ${column}`);
  return found;
}

const sorted = (xs: string[]) => [...xs].sort();

describe("schema contract - domain unions match the SQLite CHECK constraints", () => {
  it("session status", () => {
    const { values, source } = effectiveCheckList("status");
    expect(source).toBe("002_assessment_mode.sql");
    expect(sorted(values)).toEqual(sorted(Object.keys(SESSION_STATUSES)));
  });

  it("simulation mode, including assessment after the 002 rebuild", () => {
    const { values, source } = effectiveCheckList("mode");
    expect(source).toBe("002_assessment_mode.sql");
    expect(values).toContain("assessment");
    expect(sorted(values)).toEqual(sorted(Object.keys(SIMULATION_MODES)));
  });

  it("competency level", () => {
    const { values } = effectiveCheckList("level");
    expect(sorted(values)).toEqual(sorted(Object.keys(COMPETENCY_LEVELS)));
  });

  it("reads the migrations in application order", () => {
    const names = migrations().map((m) => m.name);
    expect(names[0]).toBe("001_initial.sql");
    expect(names).toEqual([...names].sort());
  });

  it("shows why the 002 rebuild was needed: 001 alone would reject assessment", () => {
    // Guards the reason the rebuild exists, so a future edit cannot quietly
    // reintroduce the original constraint and take assessment mode away.
    const initial = migrations()[0]!.sql;
    const mode = /mode\s+TEXT NOT NULL CHECK \(mode IN\s*\(([^)]*)\)/.exec(initial);
    expect(mode?.[1]).not.toContain("assessment");
  });
});
