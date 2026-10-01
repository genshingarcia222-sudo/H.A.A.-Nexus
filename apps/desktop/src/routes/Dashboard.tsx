import { useEffect, useState, useCallback } from "react";
import { Card, Button } from "@haa-nexus/ui-kit";
import { mayContinueFromDraft, type SessionRecord } from "@haa-nexus/nexus-core";
import { useProfileStore } from "../store/profileStore.js";
import { useSessionStore } from "../store/sessionStore.js";
import { moduleRegistry } from "../modules.js";
import { scenarioRepository } from "../content/scenarios.js";
import { sessionRepository } from "../persistence/repositories.js";
import { lockedScenarioMessage } from "../live-scribing/lockedScenarioMessage.js";

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
  const liveSessionId = useSessionStore((s) => s.session?.id ?? null);
  const modules = moduleRegistry.list();

  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [interrupted, setInterrupted] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [all, stuck] = await Promise.all([sessionRepository.list(), sessionRepository.findInterrupted()]);
      setHistory(all);
      // The attempt the learner is in right now is not an interrupted one
      // (D8). `findInterrupted` returns every in_progress record, and the live
      // attempt autosaves into exactly that state - so without this the card
      // offers to "continue" the session already on screen, which would
      // abandon it and start a third. Found by walking the flow in a browser.
      setInterrupted(stuck.filter((r) => r.id !== liveSessionId));
    } catch (err) {
      console.error("Failed to load session history:", err);
    } finally {
      setLoaded(true);
    }
  }, [liveSessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * D8: what an interrupted practice or simulation attempt may become.
   *
   * Neither route resumes the attempt. Both start a *new* one and abandon the
   * interrupted record, so an attempt is never scored on a clock that was
   * reset mid-way or that counts the time the app was closed. The difference
   * is only what the new attempt starts from:
   *
   * - `continue` carries the learner's draft, and with it the time that was
   *   actually measured on that draft. Carrying the work without the time
   *   would let a learner write the whole note, restart, and submit in seconds
   *   on a fresh clock - and `timeEfficiency` feeds the score.
   * - `fresh` starts empty, on a zero clock.
   *
   * Transcript position is not restored either way: it is not persisted, and
   * D8 does not require it (see A6 in the decision register).
   */
  async function beginNewAttempt(record: SessionRecord, from: "continue" | "fresh") {
    const scenario = scenarioRepository.get(record.scenarioId, record.scenarioVersion);
    if (!scenario) {
      window.alert("That scenario is no longer available in this build.");
      return;
    }
    // The new attempt starts *before* the old record is abandoned. If the
    // learner's entitlements no longer unlock this scenario, `start` refuses
    // without side effects, and the interrupted record must survive that
    // refusal rather than being abandoned for a session that never began.
    // `start` is synchronous and writes nothing to the repository.
    const carried =
      from === "continue" ? { draft: record.draft, activeMs: record.activeMs } : undefined;
    if (!startSession(scenario, record.mode, carried)) {
      window.alert(`That scenario is locked. ${lockedScenarioMessage(scenario)}`);
      return;
    }
    await sessionRepository.save({ ...record, status: "abandoned" });
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
                {mayContinueFromDraft(record.mode)
                  ? " You can pick your draft up in a new attempt, or start again from an empty one. Either way this counts as a new attempt."
                  : " An interrupted Assessment is retaken from the beginning, so this one starts from an empty draft."}
              </p>
              <div style={{ display: "flex", gap: "var(--nexus-space-2)" }}>
                {mayContinueFromDraft(record.mode) && (
                  <Button onClick={() => void beginNewAttempt(record, "continue")}>
                    Continue from your draft
                  </Button>
                )}
                <Button
                  variant={mayContinueFromDraft(record.mode) ? "secondary" : "primary"}
                  onClick={() => void beginNewAttempt(record, "fresh")}
                >
                  Start a new attempt
                </Button>
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
