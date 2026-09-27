// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InMemorySessionRepository, NO_SUBSCRIPTION } from "@haa-nexus/nexus-core";
import { App } from "../App.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * The catch-all route.
 *
 * Found by walking the routes in a real browser: `#/does-not-exist` rendered an
 * entirely empty document. The router had no `path="*"`, so an unmatched path
 * matched no layout either, and the navigation rail went with it - leaving a
 * learner who mistyped a URL with no way back except the address bar.
 *
 * These tests own two things the fix has to keep true at once: that something is
 * rendered, and that what is rendered stays on the closed side of D4.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
const PRO = { tier: "pro", status: "active", currentPeriodEnd: null, fastTrackPurchased: false } as const;

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
});

describe("an unknown route", () => {
  it("explains itself instead of rendering an empty document", () => {
    renderAt("/does-not-exist");

    expect(screen.getByText("That page does not exist")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Return to the dashboard" })).toBeTruthy();
  });

  it("keeps the navigation rail, which is the way back", () => {
    renderAt("/does-not-exist");

    // The rail lives in the shell layout. The regression this guards against is
    // the catch-all being moved outside `<Route element={<AppShell />}>`, which
    // would render the message on a bare page with no navigation at all.
    for (const link of ["Dashboard", "Live Scribing", "Analytics", "Settings"]) {
      expect(screen.getByRole("link", { name: link }), link).toBeTruthy();
    }
  });

  it("catches nested and deep unknown paths too, not only single segments", () => {
    for (const path of ["/training/lesson/does-not-exist", "/knowledge-base/x/y", "/a/b/c/d"]) {
      cleanup();
      renderAt(path);
      expect(screen.getByText("That page does not exist"), path).toBeTruthy();
    }
  });

  it("does not become a way around the closed book during an assessment", () => {
    // A not-found page is ungated, so it must never render reference content -
    // and it must not hand the learner the reference links either, which the
    // shell already hides. If either changes, this fails.
    useEntitlementStore.getState().setSubscription(PRO);
    expect(useSessionStore.getState().start(SCENARIO, "assessment")).toBe(true);

    renderAt("/does-not-exist");

    expect(screen.getByText("That page does not exist")).toBeTruthy();
    expect(screen.queryByLabelText("Search terminology"), "no reference content").toBeNull();
    expect(screen.queryByRole("link", { name: "Knowledge Base" }), "no reference link").toBeNull();
    expect(screen.queryByRole("link", { name: "Training" }), "no reference link").toBeNull();
    // And the attempt is untouched by having visited it.
    expect(useSessionStore.getState().session?.status).toBe("in_progress");
  });

  it("leaves the real routes matching, so the catch-all is not swallowing them", () => {
    for (const [path, marker] of [
      ["/", "Modules"],
      ["/settings", "Local profile"],
      ["/analytics", "Analytics"]
    ] as const) {
      cleanup();
      renderAt(path);
      expect(screen.getAllByText(marker).length, path).toBeGreaterThan(0);
    }
  });
});
