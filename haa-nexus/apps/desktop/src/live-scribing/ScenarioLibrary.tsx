import { Card, Button } from "@haa-nexus/ui-kit";
import { difficultyLabel, type Scenario, type SimulationMode } from "@haa-nexus/nexus-core";
import { scenarioRepository } from "../content/scenarios.js";
import { useSessionStore } from "../store/sessionStore.js";

export function ScenarioLibrary() {
  const start = useSessionStore((s) => s.start);
  const scenarios = scenarioRepository.list();

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <h1 style={{ fontSize: "var(--nexus-font-size-xl)", margin: 0 }}>Scenario Library</h1>
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.scenarioId} scenario={scenario} onStart={start} />
      ))}
    </div>
  );
}

function ScenarioCard({
  scenario,
  onStart
}: {
  scenario: Scenario;
  onStart: (scenario: Scenario, mode: SimulationMode) => void;
}) {
  return (
    <Card title={scenario.title}>
      <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
        {scenario.specialty} · {scenario.encounterType} · {difficultyLabel(scenario.difficulty)} · ~
        {Math.round(scenario.timeTargetSeconds / 60)} min target
      </p>
      <div style={{ display: "flex", gap: "var(--nexus-space-2)" }}>
        <Button variant="secondary" onClick={() => onStart(scenario, "practice")}>
          Practice
        </Button>
        <Button variant="primary" onClick={() => onStart(scenario, "simulation")}>
          Simulation
        </Button>
      </div>
    </Card>
  );
}
