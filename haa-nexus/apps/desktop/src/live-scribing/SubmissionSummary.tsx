import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "@haa-nexus/ui-kit";
import { generateRecommendations, type EvaluationError, type Recommendation } from "@haa-nexus/nexus-core";
import { formatDuration } from "./formatDuration.js";
import { useSessionStore } from "../store/sessionStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository, lessonRepository } from "../content/scenarios.js";

const SECTION_LABELS: Record<string, string> = {
  chiefComplaint: "Chief Complaint",
  hpi: "History of Present Illness",
  ros: "Review of Systems",
  physicalExam: "Physical Examination",
  assessment: "Assessment",
  plan: "Plan",
  additionalNotes: "Additional Notes"
};

const CATEGORY_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  completeness: "Completeness",
  terminology: "Terminology",
  relevance: "Relevance",
  structure: "Structure",
  pertinentPosNeg: "Pertinent Pos/Neg",
  timeEfficiency: "Time Efficiency"
};

export function SubmissionSummary() {
  const scenario = useSessionStore((s) => s.scenario);
  const session = useSessionStore((s) => s.session);
  const draft = useSessionStore((s) => s.draft);
  const result = useSessionStore((s) => s.result);
  const reset = useSessionStore((s) => s.reset);
  const start = useSessionStore((s) => s.start);
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    void sessionRepository.list().then((history) => {
      if (cancelled) return;
      setRecommendations(generateRecommendations(history, scenario.scenarioId, Date.now()));
    });
    return () => {
      cancelled = true;
    };
    // Re-run whenever a new result lands (i.e. a fresh submission), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, result]);

  if (!scenario || !session || !result) return null;

  function handleRecommendation(rec: Recommendation) {
    if (rec.recommendedType === "lesson") {
      navigate("/training", { state: { lessonId: rec.recommendedId } });
      return;
    }
    const target = scenarioRepository.getLatest(rec.recommendedId);
    if (target) start(target, "simulation");
  }

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <Card title="Results">
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nexus-space-2)" }}>
          <span className="nexus-data-readout" style={{ fontSize: "var(--nexus-font-size-xl)" }}>
            {Math.round(result.overallScore)}
          </span>
          <span style={{ color: "var(--nexus-color-ink-secondary)", fontSize: "var(--nexus-font-size-sm)" }}>
            / 100 · {formatDuration(session.activeMs)} active time
            {session.flags.length > 0 ? ` · ${session.flags.length} flag(s)` : ""}
          </span>
        </div>

        <div style={{ display: "grid", gap: "var(--nexus-space-2)", marginTop: "var(--nexus-space-3)" }}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const score = result.categoryScores[key as keyof typeof result.categoryScores];
            return (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "140px 1fr 32px", alignItems: "center", gap: "var(--nexus-space-2)" }}>
                <span style={{ fontSize: "var(--nexus-font-size-sm)" }}>{label}</span>
                <div style={{ background: "var(--nexus-color-border)", borderRadius: "var(--nexus-radius)", height: 6 }}>
                  <div
                    style={{
                      width: `${score}%`,
                      background: "var(--nexus-color-accent)",
                      height: "100%",
                      borderRadius: "var(--nexus-radius)"
                    }}
                  />
                </div>
                <span className="nexus-data-readout" style={{ fontSize: "var(--nexus-font-size-sm)" }}>
                  {Math.round(score)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {result.errors.length > 0 && (
        <Card title={`Feedback (${result.errors.length})`}>
          <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
            {result.errors.map((error) => (
              <ErrorFeedback key={error.id} error={error} />
            ))}
          </div>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card title="Recommended for you">
          <div style={{ display: "grid", gap: "var(--nexus-space-2)" }}>
            {recommendations.map((rec) => (
              <div key={rec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--nexus-space-2)" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)", fontWeight: 600 }}>
                    {rec.recommendedType === "lesson"
                      ? lessonRepository.get(rec.recommendedId)?.title ?? rec.recommendedId
                      : `Retry: ${scenarioRepository.getLatest(rec.recommendedId)?.title ?? rec.recommendedId}`}
                  </p>
                  <p style={{ margin: 0, fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
                    {rec.reason}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => handleRecommendation(rec)}>
                  {rec.recommendedType === "lesson" ? "Open lesson" : "Retry now"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Your documentation">
        <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
          {Object.entries(SECTION_LABELS).map(([section, label]) => (
            <div key={section}>
              <div style={{ fontSize: "var(--nexus-font-size-sm)", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
                {draft[section as keyof typeof draft]?.trim() || <em>(blank)</em>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", gap: "var(--nexus-space-2)" }}>
        <Button variant="secondary" onClick={reset}>
          Back to library
        </Button>
        <Button onClick={() => start(scenario, session.mode)}>Retry this scenario</Button>
      </div>
    </div>
  );
}

function ErrorFeedback({ error }: { error: EvaluationError }) {
  return (
    <div style={{ borderLeft: "3px solid var(--nexus-color-border)", paddingLeft: "var(--nexus-space-2)" }}>
      <span className={`nexus-badge nexus-badge--${error.severity}`}>{error.severity}</span>{" "}
      <span style={{ fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
        {error.errorType.replace(/_/g, " ")}
      </span>
      <p style={{ margin: "4px 0 0 0", fontSize: "var(--nexus-font-size-sm)" }}>
        <strong>What:</strong> {error.what}
      </p>
      <p style={{ margin: "4px 0 0 0", fontSize: "var(--nexus-font-size-sm)" }}>
        <strong>Why:</strong> {error.why}
      </p>
      <p style={{ margin: "4px 0 0 0", fontSize: "var(--nexus-font-size-sm)" }}>
        <strong>How:</strong> {error.how}
      </p>
    </div>
  );
}
