import { useEffect, useState } from "react";
import { Card } from "@haa-nexus/ui-kit";
import { computeAnalytics, type AnalyticsSummary } from "@haa-nexus/nexus-core";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

const TREND_LABEL: Record<AnalyticsSummary["trend"], string> = {
  up: "Improving",
  down: "Declining",
  flat: "Steady",
  "insufficient-data": "Not enough attempts yet"
};

export function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([sessionRepository.list(), competencyRepository.list()]).then(([sessions, competencies]) => {
      if (cancelled) return;
      setSummary(computeAnalytics(sessions, competencies, scenarioRepository.list().length));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) {
    return <p style={{ color: "var(--nexus-color-ink-secondary)" }}>Loading…</p>;
  }

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-4)", maxWidth: 720 }}>
      <h1 style={{ fontSize: "var(--nexus-font-size-xl)", margin: 0 }}>Analytics</h1>

      <Card title="Overall performance">
        {summary.averageScore === null ? (
          <p style={{ margin: 0, color: "var(--nexus-color-ink-secondary)" }}>
            No scored sessions yet — complete a scenario in Live Scribing to see performance here.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nexus-space-2)" }}>
              <span className="nexus-data-readout" style={{ fontSize: "var(--nexus-font-size-xl)" }}>
                {Math.round(summary.averageScore)}
              </span>
              <span style={{ fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
                / 100 average across {summary.sessionsEvaluated} scored session{summary.sessionsEvaluated === 1 ? "" : "s"}
              </span>
            </div>
            <p style={{ margin: "var(--nexus-space-1) 0 0 0", fontSize: "var(--nexus-font-size-sm)" }}>
              {TREND_LABEL[summary.trend]}
            </p>
          </>
        )}
      </Card>

      <Card title="Scenario progress">
        <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
          Attempted {summary.scenarioProgress.attempted} of {summary.scenarioProgress.total} available scenarios.
        </p>
      </Card>

      {summary.strongestAreas.length > 0 && (
        <Card title="Strongest areas">
          <AreaList areas={summary.strongestAreas} />
        </Card>
      )}

      {summary.weakestAreas.length > 0 && (
        <Card title="Weakest areas">
          <AreaList areas={summary.weakestAreas} />
        </Card>
      )}

      {summary.errorTrends.length > 0 && (
        <Card title="Recurring errors">
          <div style={{ display: "grid", gap: "var(--nexus-space-1)" }}>
            {summary.errorTrends.map((entry) => (
              <div
                key={entry.errorType}
                style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--nexus-font-size-sm)" }}
              >
                <span>{entry.errorType.replace(/_/g, " ")}</span>
                <span className="nexus-data-readout">{entry.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function AreaList({ areas }: { areas: AnalyticsSummary["weakestAreas"] }) {
  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-1)" }}>
      {areas.map((area) => (
        <div key={area.domain} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--nexus-font-size-sm)" }}>
          <span>{area.domain}</span>
          <span style={{ color: "var(--nexus-color-ink-secondary)" }}>
            {area.level} · avg {Math.round(area.avgScore)}
          </span>
        </div>
      ))}
    </div>
  );
}
