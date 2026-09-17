// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type DifficultyLevel,
  type Scenario,
  type SubscriptionState,
  type Tier
} from "@haa-nexus/nexus-core";
import { ScenarioLibrary } from "./ScenarioLibrary.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

/**
 * Rendered-component tests for Phase 8.2 ScenarioLibrary gating (first use
 * of jsdom + Testing Library in this repository; addresses Phase 7
 * condition C3 for this surface only).
 *
 * These prove what the learner *sees and can click*. They are not the
 * access-control proof - that lives in `store/entitlementGating.test.ts`,
 * which calls the enforcement boundary directly.
 */

const BASE = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

function scenarioAt(difficulty: DifficultyLevel): Scenario {
  return {
    ...BASE,
    scenarioId: `TEST-LIBRARY-D${difficulty}`,
    title: `Library fixture difficulty ${difficulty}`,
    difficulty
  };
}

const ALL_DIFFICULTIES = ([1, 2, 3, 4, 5, 6] as DifficultyLevel[]).map(scenarioAt);

function active(tier: Tier, fastTrackPurchased = false): SubscriptionState {
  return { tier, status: "active", currentPeriodEnd: null, fastTrackPurchased };
}

/** The card for a fixture - a `<section>` whose accessible name is its title. */
function card(difficulty: DifficultyLevel) {
  return screen.getByRole("region", { name: new RegExp(`^Library fixture difficulty ${difficulty}`) });
}

function isUnlocked(difficulty: DifficultyLevel): boolean {
  return within(card(difficulty)).queryAllByRole("button").length > 0;
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

afterEach(() => {
  cleanup();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

describe("ScenarioLibrary - tier boundaries as rendered", () => {
  const cases: {
    label: string;
    subscription: SubscriptionState;
    unlocked: DifficultyLevel[];
    locked: DifficultyLevel[];
  }[] = [
    { label: "Free", subscription: NO_SUBSCRIPTION, unlocked: [1, 2], locked: [3] },
    { label: "Practice", subscription: active("practice"), unlocked: [3], locked: [4] },
    { label: "Pro", subscription: active("pro"), unlocked: [4], locked: [5] },
    { label: "Fast-Track", subscription: active("pro", true), unlocked: [5, 6], locked: [] }
  ];

  for (const { label, subscription, unlocked, locked } of cases) {
    it(`${label}: unlocks ${unlocked.join(", ")}${locked.length ? ` and locks ${locked.join(", ")}` : ""}`, () => {
      useEntitlementStore.getState().setSubscription(subscription);
      render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);

      for (const d of unlocked) expect(isUnlocked(d), `${label} D${d} should be unlocked`).toBe(true);
      for (const d of locked) expect(isUnlocked(d), `${label} D${d} should be locked`).toBe(false);
    });
  }

  it("renders the full six-level matrix correctly for every tier", () => {
    const expected: [SubscriptionState, boolean[]][] = [
      [NO_SUBSCRIPTION, [true, true, false, false, false, false]],
      [active("practice"), [true, true, true, false, false, false]],
      [active("pro"), [true, true, true, true, false, false]],
      [active("pro", true), [true, true, true, true, true, true]]
    ];
    for (const [subscription, row] of expected) {
      useEntitlementStore.getState().setSubscription(subscription);
      render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
      expect(([1, 2, 3, 4, 5, 6] as DifficultyLevel[]).map(isUnlocked)).toEqual(row);
      cleanup();
    }
  });
});

describe("ScenarioLibrary - locked presentation", () => {
  it("keeps locked scenarios visible rather than hiding them", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    expect(screen.getAllByRole("region")).toHaveLength(6);
  });

  it("identifies a locked card by text and accessible name, not by colour alone", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    const locked = card(3);
    expect(locked.getAttribute("aria-label")).toBe("Library fixture difficulty 3 (locked)");
    expect(within(locked).getByText("Locked")).toBeTruthy();
  });

  it("names the access level that includes the scenario, derived from the matrix", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    expect(within(card(3)).getByText(/included with Practice Access/)).toBeTruthy();
    expect(within(card(4)).getByText(/included with Exam-Ready Pro/)).toBeTruthy();
    expect(within(card(5)).getByText(/included with Agency Fast-Track/)).toBeTruthy();
    expect(within(card(6)).getByText(/included with Agency Fast-Track/)).toBeTruthy();
  });

  it("offers no clickable control on a locked card, so nothing looks actionable", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    for (const d of [3, 4, 5, 6] as DifficultyLevel[]) {
      expect(within(card(d)).queryAllByRole("button")).toHaveLength(0);
    }
  });

  it("shows no price, countdown or scarcity claim on a locked card", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    const text = card(5).textContent ?? "";
    expect(text).not.toMatch(/\$|₱|price|per month|\/month|only \d|left|expires|hurry|limited/i);
  });

  it("starts nothing when a locked card is clicked", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    fireEvent.click(card(3));
    fireEvent.click(within(card(3)).getByText("Locked"));
    expect(useSessionStore.getState().session).toBeNull();
  });
});

describe("ScenarioLibrary - accessible scenarios still work", () => {
  it("starts a Practice session from an unlocked card", () => {
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    fireEvent.click(within(card(1)).getByRole("button", { name: "Practice" }));

    const { session, scenario } = useSessionStore.getState();
    expect(session?.mode).toBe("practice");
    expect(session?.status).toBe("in_progress");
    expect(scenario?.scenarioId).toBe("TEST-LIBRARY-D1");
  });

  it("starts a Simulation session from an unlocked card", () => {
    useEntitlementStore.getState().setSubscription(active("pro"));
    render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    fireEvent.click(within(card(4)).getByRole("button", { name: "Simulation" }));

    expect(useSessionStore.getState().session?.mode).toBe("simulation");
    expect(useSessionStore.getState().scenario?.scenarioId).toBe("TEST-LIBRARY-D4");
  });

  it("re-renders gating when the subscription changes", () => {
    const { rerender } = render(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    expect(isUnlocked(4)).toBe(false);

    useEntitlementStore.getState().setSubscription(active("pro"));
    rerender(<ScenarioLibrary scenarios={ALL_DIFFICULTIES} />);
    expect(isUnlocked(4)).toBe(true);
  });
});

describe("ScenarioLibrary - real shipped content", () => {
  it("under the default Free state, unlocks SCRIBE-FM-014 (D1) and locks SCRIBE-IM-032 (D3)", () => {
    render(<ScenarioLibrary />);
    const fm014 = screen.getByRole("region", { name: "Three-Day Cough, Family Medicine" });
    const im032 = screen.getByRole("region", { name: /Fatigue and Palpitations, Internal Medicine \(locked\)/ });

    expect(within(fm014).getAllByRole("button")).toHaveLength(2);
    expect(within(im032).queryAllByRole("button")).toHaveLength(0);
    expect(within(im032).getByText(/included with Practice Access/)).toBeTruthy();
  });
});
