import { Card, Button } from "@haa-nexus/ui-kit";
import {
  canAccessDifficulty,
  difficultyLabel,
  type Scenario,
  type SimulationMode
} from "@haa-nexus/nexus-core";
import { scenarioRepository } from "../content/scenarios.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlements } from "../store/entitlementStore.js";
import { lockedScenarioMessage } from "./lockedScenarioMessage.js";

export interface ScenarioLibraryProps {
  /**
   * Scenarios to list. Defaults to every bundled scenario; overridable so
   * tests can cover difficulty levels the shipped content does not yet
   * include, without inventing content files.
   */
  scenarios?: Scenario[];
}

/**
 * Lists every scenario, locked or not.
 *
 * Locked scenarios stay visible on purpose. Business Model Spec Section 5
 * asks the free set to be small enough to "naturally expos[e] the benefit
 * of additional scenarios", which hiding them would defeat.
 *
 * This component decides what to *show*; it does not decide what may
 * *start*. That authority lives in `sessionStore.start`, which refuses a
 * locked scenario regardless of how it is reached.
 */
export function ScenarioLibrary({ scenarios = scenarioRepository.list() }: ScenarioLibraryProps) {
  const start = useSessionStore((s) => s.start);
  // Resolved once for the whole list; each card is a cheap comparison.
  const entitlements = useEntitlements();

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <h1 style={{ fontSize: "var(--nexus-font-size-xl)", margin: 0 }}>Scenario Library</h1>
      {scenarios.map((scenario) => (
        <ScenarioCard
          key={`${scenario.scenarioId}@${scenario.version}`}
          scenario={scenario}
          locked={!canAccessDifficulty(entitlements, scenario.difficulty)}
          onStart={start}
        />
      ))}
    </div>
  );
}

function ScenarioCard({
  scenario,
  locked,
  onStart
}: {
  scenario: Scenario;
  locked: boolean;
  onStart: (scenario: Scenario, mode: SimulationMode) => boolean;
}) {
  return (
    <Card title={scenario.title} aria-label={locked ? `${scenario.title} (locked)` : scenario.title}>
      <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
        {scenario.specialty} · {scenario.encounterType} · {difficultyLabel(scenario.difficulty)} · ~
        {Math.round(scenario.timeTargetSeconds / 60)} min target
      </p>

      {locked ? (
        // No buttons at all for a locked scenario: nothing here looks
        // actionable, and the state is carried by text rather than colour.
        <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
          <span className="nexus-badge nexus-badge--minor">Locked</span> {lockedScenarioMessage(scenario)}
        </p>
      ) : (
        <div style={{ display: "flex", gap: "var(--nexus-space-2)" }}>
          <Button variant="secondary" onClick={() => onStart(scenario, "practice")}>
            Practice
          </Button>
          <Button variant="primary" onClick={() => onStart(scenario, "simulation")}>
            Simulation
          </Button>
        </div>
      )}
    </Card>
  );
}
