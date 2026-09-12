import { useEffect, useState } from "react";
import { Card, Button, TextArea } from "@haa-nexus/ui-kit";
import { computeLiveActiveMs, difficultyLabel, isDraftEmpty, type FlagType } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { formatDuration } from "./formatDuration.js";

const SECTION_LABELS: Record<string, string> = {
  chiefComplaint: "Chief Complaint",
  hpi: "History of Present Illness",
  ros: "Review of Systems",
  physicalExam: "Physical Examination",
  assessment: "Assessment",
  plan: "Plan",
  additionalNotes: "Additional Notes"
};

const FLAG_TYPES: { type: FlagType; label: string }[] = [
  { type: "important", label: "Important" },
  { type: "uncertain", label: "Uncertain" },
  { type: "review_later", label: "Review later" }
];

export function SimulatorWorkspace() {
  const { scenario, session, draft, beats, revealedCount } = useSessionStore((s) => ({
    scenario: s.scenario,
    session: s.session,
    draft: s.draft,
    beats: s.beats,
    revealedCount: s.revealedCount
  }));
  const { pause, resume, advanceTranscript, flagCurrentBeat, updateField, submit } = useSessionStore((s) => ({
    pause: s.pause,
    resume: s.resume,
    advanceTranscript: s.advanceTranscript,
    flagCurrentBeat: s.flagCurrentBeat,
    updateField: s.updateField,
    submit: s.submit
  }));
  const clearDraft = useSessionStore((s) => s.clearDraft);
  const persistDraft = useSessionStore((s) => s.persistDraft);

  // Forces a re-render every second so the live timer reflects real elapsed
  // time, without storing "now" in the store itself (which would cause
  // every consumer to re-render, not just the timer).
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (session?.status !== "in_progress") return;
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session?.status]);

  // Autosave every 15s while the encounter is live, so a crash never loses
  // more than a few seconds of documentation (Architecture Package Section
  // 10/29 - "interrupted sessions must not lose work").
  useEffect(() => {
    if (session?.status !== "in_progress") return;
    const interval = setInterval(() => void persistDraft(), 15_000);
    return () => clearInterval(interval);
  }, [session?.status, persistDraft]);

  if (!scenario || !session) return null;

  const elapsedMs = computeLiveActiveMs(session, Date.now());
  const isPaused = session.status === "paused";
  const allBeatsRevealed = revealedCount >= beats.length;
  const isSimulation = session.mode === "simulation";

  async function handleSubmit() {
    if (isDraftEmpty(draft) && !window.confirm("Submit with no documentation entered?")) {
      return;
    }
    await submit();
  }

  function handleClear() {
    if (isDraftEmpty(draft)) return;
    if (window.confirm("Clear all documentation entered so far? This cannot be undone.")) {
      clearDraft();
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nexus-space-4)", alignItems: "start" }}>
      <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
        <Card title={scenario.title}>
          <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
            {scenario.patient.age}yo {scenario.patient.sex} · {scenario.specialty} · {scenario.encounterType} ·{" "}
            {difficultyLabel(scenario.difficulty)} · {session.mode === "practice" ? "Practice" : "Simulation"}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--nexus-space-3)" }}>
            <span className="nexus-data-readout">{formatDuration(elapsedMs)}</span>
            <Button variant="secondary" onClick={isPaused ? resume : pause}>
              {isPaused ? "Resume" : "Pause"}
            </Button>
          </div>
        </Card>

        <Card title="Encounter">
          <div className="nexus-transcript">
            {beats.slice(0, revealedCount).map((beat, i) => (
              <div
                key={beat.id}
                className={`nexus-transcript__beat${i === revealedCount - 1 ? " nexus-transcript__beat--latest" : ""}`}
              >
                {beat.text}
              </div>
            ))}
          </div>

          {isSimulation && !isPaused && (
            <div style={{ display: "flex", gap: "var(--nexus-space-2)", marginTop: "var(--nexus-space-3)" }}>
              <Button variant="secondary" onClick={advanceTranscript} disabled={allBeatsRevealed}>
                {allBeatsRevealed ? "End of encounter" : "Continue"}
              </Button>
            </div>
          )}

          {!isPaused && revealedCount > 0 && (
            <div style={{ display: "flex", gap: "var(--nexus-space-2)", marginTop: "var(--nexus-space-2)" }}>
              {FLAG_TYPES.map(({ type, label }) => (
                <Button key={type} variant="secondary" onClick={() => flagCurrentBeat(type)}>
                  Flag: {label}
                </Button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
        <Card title="Documentation">
          <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
            {(Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((section) => (
              <TextArea
                key={section}
                id={section}
                label={SECTION_LABELS[section]!}
                value={draft[section as keyof typeof draft]}
                onChange={(e) => updateField(section as keyof typeof draft, e.target.value)}
                rows={section === "hpi" || section === "ros" ? 4 : 2}
              />
            ))}
          </div>
          <div style={{ marginTop: "var(--nexus-space-3)", display: "flex", gap: "var(--nexus-space-2)" }}>
            <Button onClick={handleSubmit}>Submit</Button>
            <Button variant="secondary" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
