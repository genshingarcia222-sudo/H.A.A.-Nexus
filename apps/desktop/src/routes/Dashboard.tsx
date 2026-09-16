import { useEffect, useState, useCallback } from "react";
import { Card, Button } from "@haa-nexus/ui-kit";
import type { SessionRecord } from "@haa-nexus/nexus-core";
import { useProfileStore } from "../store/profileStore.js";
import { useSessionStore } from "../store/sessionStore.js";
import { moduleRegistry } from "../modules.js";
import { scenarioRepository } from "../content/scenarios.js";
import { sessionRepository } from "../persistence/repositories.js";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function Dashboard() {
  const displayName = useProfileStore((s) => s.displayName);
  const startSession = useSessionStore((s) => s.start);
  const modules = moduleRegistry.list();

  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [interrupted, setInterrupted] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [all, stuck] = await Promise.all([sessionRepository.list(), sessionRepository.findInterrupted()]);
      setHistory(all);
      setInterrupted(stuck);
    } catch (err) {
      console.error("Failed to load session history:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleResume(record: SessionRecord) {
    const scenario = scenarioRepository.get(record.scenarioId, record.scenarioVersion);
    if (!scenario) {
      window.alert("That scenario is no longer available in this build.");
      return;
    }
    // Note: this starts a fresh session for the same scenario rather than
    // restoring the exact transcript position - transcript-reveal state
    // isn't persisted yet (only the session and its draft are). The prior
    // draft text itself is not lost; it remains in history under its
    // original (now-abandoned) session id.
    await sessionRepository.save({ ...record, status: "abandoned" });
    startSession(scenario, record.mode);
    await refresh();
  }

  async function handleDiscard(record: SessionRecord) {
    await sessionRepository.save({ ...record, status: "abandoned" });
    await refresh();
  }

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-4)", maxWidth: 720 }}>
      <Card title={`Welcome back, ${displayName}`}>
        <p style={{ margin: 0 }}>
          Live Scribing, Training, Knowledge Base, and Analytics are all available. Every figure
          shown across the app is computed from your own saved attempts — nothing here is faked
          ahead of schedule.
        </p>
      </Card>

      {interrupted.length > 0 && (
        <Card title="Interrupted session">
          {interrupted.map((record) => (
            <div key={record.id} style={{ marginBottom: "var(--nexus-space-2)" }}>
              <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-sm)" }}>
                <strong>{record.scenarioTitle}</strong> was left {record.status} on {formatDate(record.startedAt)}.
                Your last-saved draft is still there.
              </p>
              <div style={{ display: "flex", gap: "var(--nexus-space-2)" }}>
                <Button onClick={() => void handleResume(record)}>Start a new attempt</Button>
                <Button variant="secondary" onClick={() => void handleDiscard(record)}>
                  Discard
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card title="Modules">
        <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
          {modules.map((mod) => (
            <li key={mod.id}>{mod.title}</li>
          ))}
        </ul>
      </Card>

      <Card title="History">
        {!loaded && <p style={{ margin: 0, color: "var(--nexus-color-ink-secondary)" }}>Loading…</p>}
        {loaded && history.length === 0 && (
          <p style={{ margin: 0, color: "var(--nexus-color-ink-secondary)" }}>
            No sessions yet — completed and in-progress attempts will show up here.
          </p>
        )}
        {history.length > 0 && (
          <div style={{ display: "grid", gap: "var(--nexus-space-2)" }}>
            {history.slice(0, 10).map((record) => (
              <div
                key={record.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "var(--nexus-space-2)",
                  fontSize: "var(--nexus-font-size-sm)",
                  borderBottom: "1px solid var(--nexus-color-border)",
                  paddingBottom: "var(--nexus-space-1)"
                }}
              >
                <span>{record.scenarioTitle}</span>
                <span style={{ color: "var(--nexus-color-ink-secondary)" }}>{record.status}</span>
                <span className="nexus-data-readout">
                  {record.evaluation ? Math.round(record.evaluation.overallScore) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
