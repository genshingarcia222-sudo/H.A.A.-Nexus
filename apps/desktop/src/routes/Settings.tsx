import { useEffect, useState } from "react";
import { Card, Button } from "@haa-nexus/ui-kit";
import { EntitlementService, DEFAULT_ENTITLEMENTS } from "@haa-nexus/nexus-core";
import { useProfileStore } from "../store/profileStore.js";
import { readAppVersion, type AppVersion } from "../persistence/appVersion.js";

const entitlements = new EntitlementService(DEFAULT_ENTITLEMENTS);

export function Settings() {
  const displayName = useProfileStore((s) => s.displayName);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const [draft, setDraft] = useState(displayName);
  const [version, setVersion] = useState<AppVersion | null>(null);

  useEffect(() => {
    let live = true;
    void readAppVersion().then((v) => {
      if (live) setVersion(v);
    });
    return () => {
      live = false;
    };
  }, []);

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

      <Card title="About this build">
        <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
          Version <strong data-testid="app-version">{version ? version.version : "checking..."}</strong>
          {version?.source === "build" ? " (frontend build - no desktop shell is running)" : null}
        </p>
        <p
          style={{
            margin: "var(--nexus-space-2) 0 0 0",
            fontSize: "var(--nexus-font-size-xs)",
            color: "var(--nexus-color-ink-secondary)"
          }}
        >
          Quote this number in any support request. On the desktop it is read from the running
          executable itself, not from a configuration file, so it is the version actually
          installed.
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
