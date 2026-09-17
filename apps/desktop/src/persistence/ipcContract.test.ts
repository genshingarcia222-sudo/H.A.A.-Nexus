import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type {
  CompetencyRecord,
  DocumentationDraft,
  EvaluationError,
  EvaluationResult,
  SessionFlag,
  SessionRecord,
  UserProfile
} from "@haa-nexus/nexus-core";
import sessionCompleted from "../../ipc-contract/session-record.completed.json";
import sessionInProgress from "../../ipc-contract/session-record.in-progress.json";
import competencyRecord from "../../ipc-contract/competency-record.json";
import userProfile from "../../ipc-contract/user-profile.json";

/**
 * TypeScript half of the IPC data contract (see apps/desktop/ipc-contract/).
 *
 * Each key list below is checked by the compiler with `satisfies Record<keyof
 * T, true>`: it fails to typecheck if it is missing a key of the nexus-core
 * type or names a key the type does not have. The tests then require each
 * shared fixture to have exactly those keys, so a field renamed or added on
 * the TypeScript side cannot drift away from what the Rust DTOs round-trip.
 */

const SESSION_RECORD_KEYS = {
  id: true,
  scenarioId: true,
  scenarioVersion: true,
  scenarioTitle: true,
  mode: true,
  status: true,
  startedAt: true,
  activeMs: true,
  pausedMs: true,
  completedAt: true,
  flags: true,
  draft: true,
  evaluation: true
} satisfies Record<keyof SessionRecord, true>;

const DRAFT_KEYS = {
  chiefComplaint: true,
  hpi: true,
  ros: true,
  physicalExam: true,
  assessment: true,
  plan: true,
  additionalNotes: true
} satisfies Record<keyof DocumentationDraft, true>;

const FLAG_KEYS = { beatId: true, flagType: true, timestamp: true } satisfies Record<keyof SessionFlag, true>;

const EVALUATION_KEYS = {
  overallScore: true,
  categoryScores: true,
  errors: true,
  scoringWeightsUsed: true,
  timeEfficiencyRatio: true,
  evaluatedAt: true
} satisfies Record<keyof EvaluationResult, true>;

/** Required keys of EvaluationError; `relatedRequirementId` is optional. */
const ERROR_REQUIRED_KEYS = {
  id: true,
  errorType: true,
  severity: true,
  section: true,
  what: true,
  why: true,
  how: true
} satisfies Record<Exclude<keyof EvaluationError, "relatedRequirementId">, true>;

const COMPETENCY_KEYS = {
  domain: true,
  level: true,
  avgScore: true,
  recentScore: true,
  trend: true,
  attemptCount: true,
  confidence: true,
  recentScores: true,
  updatedAt: true
} satisfies Record<keyof CompetencyRecord, true>;

const PROFILE_KEYS = { displayName: true, updatedAt: true } satisfies Record<keyof UserProfile, true>;

const keysOf = (o: object) => Object.keys(o).sort();

describe("IPC data contract - fixtures have exactly the nexus-core keys", () => {
  for (const [name, record] of [
    ["completed session", sessionCompleted],
    ["in-progress session", sessionInProgress]
  ] as const) {
    it(`${name} record`, () => {
      expect(keysOf(record)).toEqual(keysOf(SESSION_RECORD_KEYS));
      expect(keysOf(record.draft)).toEqual(keysOf(DRAFT_KEYS));
      for (const flag of record.flags) expect(keysOf(flag)).toEqual(keysOf(FLAG_KEYS));
    });
  }

  it("evaluation result and its errors", () => {
    const evaluation = sessionCompleted.evaluation;
    expect(keysOf(evaluation)).toEqual(keysOf(EVALUATION_KEYS));
    const allowed = new Set([...Object.keys(ERROR_REQUIRED_KEYS), "relatedRequirementId"]);
    for (const error of evaluation.errors) {
      for (const key of Object.keys(ERROR_REQUIRED_KEYS)) expect(error, key).toHaveProperty(key);
      for (const key of Object.keys(error)) expect(allowed.has(key), `unexpected error key ${key}`).toBe(true);
    }
  });

  it("competency record", () => {
    expect(keysOf(competencyRecord)).toEqual(keysOf(COMPETENCY_KEYS));
  });

  it("user profile", () => {
    expect(keysOf(userProfile)).toEqual(keysOf(PROFILE_KEYS));
  });

  it("covers both nullable shapes of a session record", () => {
    expect(sessionCompleted.evaluation).not.toBeNull();
    expect(sessionCompleted.completedAt).not.toBeNull();
    expect(sessionInProgress.evaluation).toBeNull();
    expect(sessionInProgress.completedAt).toBeNull();
  });
});

describe("IPC contract - command argument names", () => {
  it("every invoke call passes exactly the arguments its Rust command declares", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const commandsRs = readFileSync(path.join(here, "../../src-tauri/src/commands.rs"), "utf8");

    // Rust: #[tauri::command] pub fn name(state: State<DbState>, a: T, ...)
    const rustParams = new Map<string, string[]>();
    for (const m of commandsRs.matchAll(/#\[tauri::command\]\s*pub fn ([a-z_]+)\(([^)]*)\)/g)) {
      const params = m[2]!
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p && !p.includes("State<"))
        .map((p) => p.split(":")[0]!.trim());
      rustParams.set(m[1]!, params.sort());
    }

    // TypeScript: invoke<T>("name", { a, b: x }) - Tauri maps camelCase keys to snake_case params.
    const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const calls: { name: string; args: string[] }[] = [];
    for (const file of ["tauriSessionRepository.ts", "tauriProfileRepository.ts", "tauriCompetencyRepository.ts"]) {
      const source = readFileSync(path.join(here, file), "utf8");
      for (const m of source.matchAll(/invoke(?:<[^>]*>)?\(\s*"([a-z_]+)"\s*(?:,\s*\{([^}]*)\})?\s*\)/g)) {
        const args = (m[2] ?? "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
          .map((a) => toSnake(a.split(":")[0]!.trim()));
        calls.push({ name: m[1]!, args: args.sort() });
      }
    }

    expect(calls.length).toBeGreaterThanOrEqual(9);
    for (const { name, args } of calls) {
      expect(rustParams.has(name), `no #[tauri::command] named ${name}`).toBe(true);
      expect(args, `arguments of ${name}`).toEqual(rustParams.get(name));
    }
  });
});
