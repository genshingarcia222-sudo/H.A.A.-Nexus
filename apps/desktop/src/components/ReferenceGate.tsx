import type { ReactNode } from "react";
import { Card } from "@haa-nexus/ui-kit";
import { mayAccessReferenceMaterial } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";

/**
 * The closed-book boundary for Assessment (decision D4, owner-selected
 * 2026-09-20): the Knowledge Base and Training are unavailable while an
 * assessment attempt is active.
 *
 * This guards the **route**, not the button. Hiding the nav links alone would
 * leave `#/knowledge-base` working for anyone who typed it, bookmarked it, or
 * reached it through a programmatic `navigate()` - so the nav rail hiding the
 * links (see `referenceRoutes.ts`) is a courtesy, and this is the protection.
 * Every way into these routes renders the route element, which is here.
 *
 * Whether access is allowed is decided in `nexus-core`
 * (`mayAccessReferenceMaterial`); this component only renders the answer.
 */
export function ReferenceGate({ children, what }: { children: ReactNode; what: string }) {
  const session = useSessionStore((s) => s.session);

  if (mayAccessReferenceMaterial(session)) return <>{children}</>;

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <Card title={`${what} is unavailable during an assessment`}>
        <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
          This assessment runs closed-book, so reference material stays closed until you submit.
          Your attempt is still in progress and nothing has been lost — return to Live Scribing to
          continue it.
        </p>
        <p
          style={{
            margin: "var(--nexus-space-2) 0 0 0",
            fontSize: "var(--nexus-font-size-xs)",
            color: "var(--nexus-color-ink-secondary)"
          }}
        >
          {what} is available again as soon as the assessment is submitted, and is always available
          in practice and simulation.
        </p>
      </Card>
    </div>
  );
}
