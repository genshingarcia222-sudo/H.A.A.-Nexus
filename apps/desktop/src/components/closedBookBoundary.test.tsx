// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InMemorySessionRepository, NO_SUBSCRIPTION, type SimulationMode, type Tier } from "@haa-nexus/nexus-core";
import { App } from "../App.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Decision D4 — Assessment runs closed-book.
 *
 * Owner-selected 2026-09-20: Knowledge Base OFF, Training OFF, direct route
 * access BLOCKED, and no tier exception.
 *
 * These render the real `App` router at a real URL rather than the route
 * components directly, because "blocked" has to mean *the route* is blocked.
 * Hiding a nav link is not the boundary - a typed URL, a bookmark and a
 * programmatic `navigate()` all bypass a hidden link, and all three land on
 * the route element these tests exercise.
 *
 * Whether access is allowed is decided in `nexus-core`; the domain tests own
 * that. These own the wiring: that every entry point goes through it.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

const REFERENCE_ROUTES = ["/knowledge-base", "/training"];

function subscriptionFor(tier: Tier) {
  return {
    tier,
    status: "active",
    currentPeriodEnd: null,
    fastTrackPurchased: tier === "fast_track"
  } as const;
}

/** Starts a real session, granting only the entitlement the mode requires (D1). */
function startIn(mode: SimulationMode, tier: Tier = "pro") {
  useEntitlementStore.getState().setSubscription(subscriptionFor(tier));
  expect(useSessionStore.getState().start(SCENARIO, mode)).toBe(true);
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

/** The closed-book notice, identified by what only it renders. */
function isBlocked(): boolean {
  return screen.queryByText(/runs closed-book/) !== null;
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
});

describe("D4: reference routes during an active assessment", () => {
  for (const route of REFERENCE_ROUTES) {
    it(`blocks ${route} when navigated to directly`, () => {
      startIn("assessment");
      renderAt(route);

      expect(isBlocked()).toBe(true);
      // The real content is not merely hidden behind the notice - it is not
      // rendered at all.
      expect(screen.queryByLabelText("Search terminology")).toBeNull();
      expect(screen.queryByRole("button", { name: "Open lesson" })).toBeNull();
    });
  }

  it("removes both links from the navigation as well", () => {
    startIn("assessment");
    renderAt("/live-scribing");

    expect(screen.queryByRole("link", { name: "Knowledge Base" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Training" })).toBeNull();
    // The rest of the app is untouched.
    expect(screen.getByRole("link", { name: "Live Scribing" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
  });

  it("does not end or damage the attempt when a blocked route is reached", () => {
    startIn("assessment");
    const before = useSessionStore.getState().session;
    renderAt("/knowledge-base");

    const after = useSessionStore.getState().session;
    expect(after).toBe(before);
    expect(after?.status).toBe("in_progress");
    expect(after?.mode).toBe("assessment");
  });
});

describe("D4 is not tier-differentiated", () => {
  for (const tier of ["pro", "fast_track"] as const) {
    it(`blocks reference material for a ${tier} assessment`, () => {
      // Both tiers may start an assessment (D1). Neither gets an open book.
      startIn("assessment", tier);
      renderAt("/knowledge-base");

      expect(isBlocked()).toBe(true);
    });
  }
});

describe("D4 leaves everything outside an active assessment alone", () => {
  it("allows reference material when no session is running", () => {
    renderAt("/knowledge-base");

    expect(isBlocked()).toBe(false);
    expect(screen.getByLabelText("Search terminology")).toBeTruthy();
  });

  for (const mode of ["practice", "simulation"] as const) {
    it(`allows reference material during an active ${mode} session`, () => {
      startIn(mode, "pro");
      renderAt("/knowledge-base");

      expect(isBlocked()).toBe(false);
      expect(screen.getByLabelText("Search terminology")).toBeTruthy();
      cleanup();

      renderAt("/training");
      expect(isBlocked()).toBe(false);
      expect(screen.getAllByRole("button", { name: "Open lesson" }).length).toBeGreaterThan(0);
    });

    it(`keeps both links in the navigation during a ${mode} session`, () => {
      startIn(mode, "pro");
      renderAt("/live-scribing");

      expect(screen.getByRole("link", { name: "Knowledge Base" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Training" })).toBeTruthy();
    });
  }
});

describe("D4 across the assessment lifecycle", () => {
  it("allows before, blocks during, and allows again after submission", async () => {
    // Before.
    renderAt("/knowledge-base");
    expect(isBlocked(), "before the attempt").toBe(false);
    cleanup();

    // During.
    startIn("assessment");
    renderAt("/knowledge-base");
    expect(isBlocked(), "during the attempt").toBe(true);
    cleanup();

    // After submitting. This is the D3 boundary: the books reopen exactly when
    // the attempt is over, not a moment before.
    useSessionStore.getState().updateField("chiefComplaint", "Dry cough for three days");
    await useSessionStore.getState().submit();
    expect(useSessionStore.getState().session?.status).toBe("completed");

    renderAt("/knowledge-base");
    expect(isBlocked(), "after submitting").toBe(false);
    expect(screen.getByLabelText("Search terminology")).toBeTruthy();
  });

  it("does not break the D3 post-submission surface", async () => {
    startIn("assessment");
    useSessionStore.getState().updateField("chiefComplaint", "Dry cough for three days");
    await useSessionStore.getState().submit();

    renderAt("/live-scribing");
    expect(screen.getByText("Results")).toBeTruthy();
    expect(screen.getByText("Note comparison")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry this scenario" })).toBeTruthy();
    // And the nav is whole again.
    expect(screen.getByRole("link", { name: "Knowledge Base" })).toBeTruthy();
  });
});

describe("D4 has one enforcement boundary, not one per route", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const srcRoot = path.join(here, "..");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
      return [full];
    });
  }

  /**
   * Files allowed to read learner-facing reference content directly.
   *
   * The two route components are the content itself, and the router wraps them
   * in the gate. `SubmissionSummary` reads a lesson *title* for a
   * recommendation, which only renders once the attempt is completed - D3
   * territory, on the permitted side of the same boundary.
   */
  const ALLOWED = new Set(
    [
      ["routes", "KnowledgeBase.tsx"],
      ["routes", "Training.tsx"],
      ["live-scribing", "SubmissionSummary.tsx"],
      // The content layer that *defines* these repositories from the bundled
      // archive. It renders nothing and knows nothing about sessions. D4
      // governs the runtime learner surface, never the content archive that
      // feeds it and the authoring tooling alike - restricting this file would
      // be restricting the archive, which the decision explicitly does not do.
      ["content", "scenarios.ts"]
    ].map((parts) => path.join(srcRoot, ...parts))
  );

  it("finds the application sources it is supposed to be scanning", () => {
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(path.join(srcRoot, "App.tsx"));
  });

  it("has no unexpected surface reading reference content directly", () => {
    // A new component rendering terminology or lessons would sit outside the
    // gated routes and quietly reopen the book. It must be gated, and then
    // listed here deliberately.
    const READS_REFERENCE = /\b(terminologyRepository|lessonRepository)\b/;
    const offenders = sourceFiles(srcRoot)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => READS_REFERENCE.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file));

    expect(offenders, "must be reached through ReferenceGate").toEqual([]);
  });

  it("keeps the rule in the domain rather than re-implementing it in the app", () => {
    for (const file of ["components/ReferenceGate.tsx", "components/AppShell.tsx"]) {
      const source = readFileSync(path.join(srcRoot, file), "utf8");
      expect(source, file).toContain("mayAccessReferenceMaterial");
      expect(source, file).not.toMatch(/mode\s*===\s*"assessment"/);
    }
  });

  it("guards every reference route the nav rail knows about", () => {
    // The router and the nav rail read the same list, so a third reference
    // surface cannot be added to one and forgotten in the other.
    const app = readFileSync(path.join(srcRoot, "App.tsx"), "utf8");
    for (const route of REFERENCE_ROUTES) {
      const guarded = new RegExp(`path="${route}"[\\s\\S]{0,200}?ReferenceGate`);
      expect(app, route).toMatch(guarded);
    }
  });
});
