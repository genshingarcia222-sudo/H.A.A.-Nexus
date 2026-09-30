import { useState } from "react";
import { Button } from "@haa-nexus/ui-kit";
import { useSessionStore } from "../store/sessionStore.js";

/**
 * Surfaces a failed evaluation as a recoverable error (D9).
 *
 * Before D9 a throw from `evaluateAttempt` escaped `submit` and rejected the
 * promise the Submit handler awaited: the attempt stayed in progress, nothing
 * was written, and the learner saw no response at all to having pressed
 * Submit. Silence is the one thing a failure must not be - the same rule
 * Architecture Package §28 already applies to a failed save.
 *
 * Renders nothing while scoring is working.
 */
export function EvaluationErrorNotice() {
  const evaluationFailed = useSessionStore((s) => s.evaluationFailed);
  const retryEvaluation = useSessionStore((s) => s.retryEvaluation);
  const [retrying, setRetrying] = useState(false);

  if (!evaluationFailed) return null;

  async function retry() {
    setRetrying(true);
    try {
      await retryEvaluation();
    } finally {
      setRetrying(false);
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
      <strong style={{ color: "var(--nexus-color-critical)" }}>Not scored</strong>
      <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
        Your attempt was submitted and your documentation is saved, but scoring it failed. Nothing
        has been lost and nothing has been counted against you — this attempt has no result yet.
        Scoring again uses the time you actually took, so trying again costs you nothing.
      </p>
      <div>
        <Button onClick={() => void retry()} disabled={retrying}>
          {retrying ? "Scoring…" : "Try scoring again"}
        </Button>
      </div>
    </div>
  );
}
