import { useState } from "react";
import { Card, Button } from "@haa-nexus/ui-kit";
import { EntitlementService, DEFAULT_ENTITLEMENTS } from "@haa-nexus/nexus-core";
import { useProfileStore } from "../store/profileStore.js";

const entitlements = new EntitlementService(DEFAULT_ENTITLEMENTS);

export function Settings() {
  const displayName = useProfileStore((s) => s.displayName);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const [draft, setDraft] = useState(displayName);

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-4)", maxWidth: 480 }}>
      <Card title="Local profile">
        <label htmlFor="display-name" style={{ display: "block", fontSize: "var(--nexus-font-size-sm)", marginBottom: 4 }}>
          Display name
        </label>
        <input
          id="display-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: "100%",
            padding: "var(--nexus-space-2)",
            border: "1px solid var(--nexus-color-border)",
            borderRadius: "var(--nexus-radius)",
            marginBottom: "var(--nexus-space-3)",
            font: "inherit"
          }}
        />
        <Button onClick={() => setDisplayName(draft)} disabled={draft.trim().length === 0}>
          Save
        </Button>
        <p style={{ fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
          Saved via SQLite when running as the desktop app. In this browser preview, it's saved in memory
          only and resets on reload.
        </p>
      </Card>

      <Card title="Plan">
        <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
          Free (local). Simulation: {entitlements.can("canUseSimulation") ? "enabled" : "disabled"}.
          AI features and cloud sync are not part of this build.
        </p>
      </Card>
    </div>
  );
}
