import type { Scenario } from "./types.js";
import { keyForScenario, compareVersions } from "./versioning.js";

export interface ScenarioFilter {
  specialty?: string;
  encounterType?: string;
  difficulty?: Scenario["difficulty"];
  tags?: string[]; // matches if the scenario has any of these tags
}

/**
 * The repository interface itself — Phase 5 adds a SQLite-backed
 * implementation of this same interface (see Architecture Package Section
 * 20). UI and any future evaluation/session code should depend on this
 * interface, never on a concrete implementation, so swapping the backing
 * store later is a constructor change, not a rewrite.
 */
export interface ScenarioRepository {
  register(scenario: Scenario): void;
  get(scenarioId: string, version: string): Scenario | undefined;
  getLatest(scenarioId: string): Scenario | undefined;
  list(filter?: ScenarioFilter): Scenario[];
}

/** MVP implementation. Populated at startup from bundled content packages. */
export class InMemoryScenarioRepository implements ScenarioRepository {
  private readonly byKey = new Map<string, Scenario>();

  register(scenario: Scenario): void {
    const key = keyForScenario(scenario);
    if (this.byKey.has(key)) {
      throw new Error(`Scenario "${key}" is already registered.`);
    }
    this.byKey.set(key, scenario);
  }

  get(scenarioId: string, version: string): Scenario | undefined {
    return this.byKey.get(`${scenarioId}@${version}`);
  }

  getLatest(scenarioId: string): Scenario | undefined {
    let latest: Scenario | undefined;
    for (const scenario of this.byKey.values()) {
      if (scenario.scenarioId !== scenarioId) continue;
      if (!latest || compareVersions(scenario.version, latest.version) > 0) {
        latest = scenario;
      }
    }
    return latest;
  }

  list(filter?: ScenarioFilter): Scenario[] {
    let results = Array.from(this.byKey.values());
    if (!filter) return results;

    if (filter.specialty) {
      results = results.filter((s) => s.specialty === filter.specialty);
    }
    if (filter.encounterType) {
      results = results.filter((s) => s.encounterType === filter.encounterType);
    }
    if (filter.difficulty) {
      results = results.filter((s) => s.difficulty === filter.difficulty);
    }
    if (filter.tags && filter.tags.length > 0) {
      const wanted = new Set(filter.tags);
      results = results.filter((s) => s.tags.some((t) => wanted.has(t)));
    }
    return results;
  }
}
