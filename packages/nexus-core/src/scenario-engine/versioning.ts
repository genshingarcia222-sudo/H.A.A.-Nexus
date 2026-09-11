import type { Scenario } from "./types.js";

/**
 * "Scenario ID + Version" (Architecture Package Section 27). Historical
 * attempts store this composite key so a later content update to the same
 * scenarioId can never change what an old attempt is scored against.
 */
export function scenarioKey(scenarioId: string, version: string): string {
  return `${scenarioId}@${version}`;
}

export function keyForScenario(scenario: Scenario): string {
  return scenarioKey(scenario.scenarioId, scenario.version);
}

export function parseScenarioKey(key: string): { scenarioId: string; version: string } | null {
  const separatorIndex = key.lastIndexOf("@");
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    return null;
  }
  return {
    scenarioId: key.slice(0, separatorIndex),
    version: key.slice(separatorIndex + 1)
  };
}

/** Parses a "major.minor" or "major.minor.patch" version string. */
function parseVersionParts(version: string): [number, number, number] {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Returns -1 if a<b, 0 if equal, 1 if a>b. Assumes schema-validated version strings. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) {
      return partsA[i]! < partsB[i]! ? -1 : 1;
    }
  }
  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}
