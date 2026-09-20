import { useEffect, useState } from "react";
import { Card } from "@haa-nexus/ui-kit";
import {
  computeAnalytics,
  RESULT_POPULATIONS,
  type AnalyticsSummary,
  type ResultPopulation
} from "@haa-nexus/nexus-core";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

const TREND_LABEL: Record<AnalyticsSummary["trend"], string> = {
  up: "Improving",
  down: "Declining",
  flat: "Steady",
  "insufficient-data": "Not enough attempts yet"
};

/**
 * Decision D5: Practice and Assessment are separate populations, so this page
 * shows two summaries and never a combined one. The separation is computed in
 * the domain - `computeAnalytics` takes the population as a required argument
 * - so these sections cannot drift into a merged total by being rendered
 * differently.
 */
const POPULATION_LABEL: Record<ResultPopulation, string> = {
  practice: "Practice",
  assessment: "Assessment"
};

const POPULATION_CAPTION: Record<ResultPopulation, string> = {
  practice: "Training activity: practice and simulation attempts.",
  assessment: "Formal assessment attempts only, under exam conditions."
};

export function Analytics() {
  const [summaries, setSummaries] = useState<Record<ResultPopulation, AnalyticsSummary> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([sessionRepository.list(), competencyRepository.list()]).then(([sessions, competencies]) => {
      if (cancelled) return;
      const total = scenarioRepository.list().length;
      setSummaries({
        practice: computeAnalytics("practice", sessions, competencies, total),
        assessment: computeAnalytics("assessment", sessions, competencies, total)
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summaries) {
    return <p style={{ color: "var(--nexus-color-ink-secondary)" }}>Loading…</p>;
  }

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-5)", maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: "var(--nexus-font-size-xl)", margin: 0 }}>Analytics</h1>
        <p style={{ margin: "var(--nexus-space-1) 0 0 0", fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
          Practice and assessment results are tracked separately and are never combined into a single
          figure. Each section below counts only its own attempts.
        </p>
      </div>

      {RESULT_POPULATIONS.map((population) => (
        <PopulationSection key={population} population={population} summary={summaries[population]} />
      ))}
    </div>
  );
}

function PopulationSection({
  population,
  summary
}: {
  population: ResultPopulation;
  summary: AnalyticsSummary;
}) {
  return (
    <section
      aria-label={`${POPULATION_LABEL[population]} analytics`}
      style={{ display: "grid", gap: "var(--nexus-space-3)" }}
    >
      <div>
        <h2 style={{ fontSize: "var(--nexus-font-size-lg)", margin: 0 }}>{POPULATION_LABEL[population]}</h2>
        <p style={{ margin: "2px 0 0 0", fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
          {POPULATION_CAPTION[population]}
        </p>
      </div>

      <Card title={`${POPULATION_LABEL[population]} performance`}>
        {summary.averageScore === null ? (
          <p style={{ margin: 0, color: "var(--nexus-color-ink-secondary)" }}>
            {population === "assessment"
              ? "No assessment attempts scored yet — assessment results will appear here, separately from practice."
              : "No scored sessions yet — complete a scenario in Live Scribing to see performance here."}
          </p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nexus-space-2)" }}>
              <span className="nexus-data-readout" style={{ fontSize: "var(--nexus-font-size-xl)" }}>
                {Math.round(summary.averageScore)}
              </span>
              <span style={{ fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
                / 100 average across {summary.sessionsEvaluated} scored {POPULATION_LABEL[population].toLowerCase()}{" "}
                session{summary.sessionsEvaluated === 1 ? "" : "s"}
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
    </section>
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
