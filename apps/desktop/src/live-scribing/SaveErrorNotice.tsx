import { useState } from "react";
import { Button } from "@haa-nexus/ui-kit";
import { useSessionStore, type SaveError } from "../store/sessionStore.js";

const MESSAGES: Record<SaveError, string> = {
  autosave:
    "Your documentation could not be saved. It is still here on screen, but it has not been stored. " +
    "Saving is retried automatically while the session is running, or you can try again now.",
  submission:
    "This attempt could not be saved to your history. Your result is shown here, " +
    "but it will be lost if you leave this screen before it is saved."
};

/**
 * Surfaces a failed save as a recoverable error rather than silent data loss
 * (Architecture Package §28). Renders nothing while saves are succeeding.
 */
export function SaveErrorNotice() {
  const saveError = useSessionStore((s) => s.saveError);
  const persistDraft = useSessionStore((s) => s.persistDraft);
  const [saving, setSaving] = useState(false);

  if (!saveError) return null;

  async function retry() {
    setSaving(true);
    try {
      await persistDraft();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="alert"
      style={{
        border: "1px solid var(--nexus-color-critical)",
        background: "var(--nexus-color-critical-muted)",
        borderRadius: "var(--nexus-radius)",
        padding: "var(--nexus-space-3)",
        display: "grid",
        gap: "var(--nexus-space-2)"
      }}
    >
      <strong style={{ color: "var(--nexus-color-critical)" }}>Not saved</strong>
      <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>{MESSAGES[saveError]}</p>
      <div>
        <Button variant="secondary" onClick={() => void retry()} disabled={saving}>
          {saving ? "Saving…" : "Try saving again"}
        </Button>
      </div>
    </div>
  );
}
