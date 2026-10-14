import { useEffect, type ReactNode } from "react";
import { Card } from "@haa-nexus/ui-kit";
import { selectReferenceBlock, useSessionStore } from "../store/sessionStore.js";

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
 * Whether access is allowed, and why not, is decided in `nexus-core`
 * (`mayAccessReferenceMaterial` and `referenceBlockReason`, reached through
 * `selectReferenceBlock`). This component only renders the answer: it contains
 * no mode or status comparison of its own, which
 * `closedBookBoundary.test.tsx` enforces.
 *
 * **D17, decided 2026-10-14: the window survives a restart.** The gate used to
 * read the live session alone, and the session store has no persist middleware
 * - so after a restart the session was `null`, the rule answered "open", and
 * both routes opened while an interrupted assessment still sat in SQLite. The
 * gate now reads persistence when it mounts. One read per navigation is the
 * whole staleness story: nothing else has to remember to invalidate a verdict.
 *
 * D4's own answer still needs no read, so a live assessment is blocked on the
 * first render exactly as before. The brief checking state can only appear on
 * the path D17 added.
 */
export function ReferenceGate({ children, what }: { children: ReactNode; what: string }) {
  const block = useSessionStore(selectReferenceBlock);
  const refresh = useSessionStore((s) => s.refreshStoredAttempts);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (block === null) return <>{children}</>;

  if (block === "checking") {
    return (
      <Notice title={`Opening ${what.toLowerCase()}`}>
        <Line>Checking for an assessment in progress.</Line>
      </Notice>
    );
  }

  if (block === "unavailable") {
    return (
      <Notice title={`${what} cannot be opened right now`}>
        <Line>
          We could not check whether you have an assessment in progress, so {what.toLowerCase()} is
          staying closed rather than risk opening it during one. Nothing has been lost. Try again,
          or reopen the app.
        </Line>
      </Notice>
    );
  }

  return (
    <Notice title={`${what} is unavailable during an assessment`}>
      {block === "live-attempt" ? (
        <Line>
          This assessment runs closed-book, so reference material stays closed until you submit.
          Your attempt is still in progress and nothing has been lost — return to Live Scribing to
          continue it.
        </Line>
      ) : (
        <Line>
          This assessment runs closed-book and you have an attempt that was never submitted, so
          reference material stays closed — closing the app does not end an assessment. Nothing has
          been lost. Go to the dashboard and either continue that attempt or discard it, and{" "}
          {what.toLowerCase()} opens again.
        </Line>
      )}
      <p
        style={{
          margin: "var(--nexus-space-2) 0 0 0",
          fontSize: "var(--nexus-font-size-xs)",
          color: "var(--nexus-color-ink-secondary)"
        }}
      >
        {what} is available again as soon as the assessment is submitted or discarded, and is always
        available in practice and simulation.
      </p>
    </Notice>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <Card title={title}>{children}</Card>
    </div>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>{children}</p>;
}
