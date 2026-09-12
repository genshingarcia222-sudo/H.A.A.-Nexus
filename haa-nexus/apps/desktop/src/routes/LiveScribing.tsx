import { useSessionStore } from "../store/sessionStore.js";
import { ScenarioLibrary } from "../live-scribing/ScenarioLibrary.js";
import { SimulatorWorkspace } from "../live-scribing/SimulatorWorkspace.js";
import { SubmissionSummary } from "../live-scribing/SubmissionSummary.js";

export function LiveScribing() {
  const session = useSessionStore((s) => s.session);

  if (!session) return <ScenarioLibrary />;
  if (session.status === "completed") return <SubmissionSummary />;
  return <SimulatorWorkspace />;
}
