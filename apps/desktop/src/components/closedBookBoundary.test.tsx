// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  createEmptyDraft,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  type SessionRecord,
  type SimulationMode,
  type Tier
} from "@haa-nexus/nexus-core";
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

/**
 * Renders with a history stack already behind the learner, sitting at `index`.
 * Going "back" to a reference route is an entry point like any other, and a
 * router that served it from history rather than re-rendering the route element
 * would reopen the book without a single navigation event of its own.
 */
function renderWithHistory(entries: string[], index: number) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
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

describe("D4 cannot be escaped by where the learner already is", () => {
  it("closes the book under a learner who is already reading it when the assessment starts", () => {
    // The dangerous case is not navigating *to* a blocked route - that is
    // covered above - but already being on one. A gate that only decided at
    // mount would leave the terminology search sitting on screen, fully usable,
    // for as long as the learner did not navigate.
    renderAt("/knowledge-base");
    expect(isBlocked(), "before the attempt").toBe(false);

    act(() => {
      startIn("assessment");
    });

    expect(isBlocked(), "once the attempt starts, in place").toBe(true);
    expect(screen.queryByLabelText("Search terminology"), "the search must be gone, not merely covered").toBeNull();
  });

  it("reopens it in place when the attempt is submitted", async () => {
    startIn("assessment");
    renderAt("/knowledge-base");
    expect(isBlocked()).toBe(true);

    useSessionStore.getState().updateField("chiefComplaint", "Dry cough for three days");
    await act(async () => {
      await useSessionStore.getState().submit();
    });

    expect(isBlocked(), "after submitting, without navigating").toBe(false);
    expect(screen.getByLabelText("Search terminology")).toBeTruthy();
  });

  it("blocks a reference route reached by going back through history", () => {
    startIn("assessment");
    // The learner was on /knowledge-base, moved to the attempt, and goes back.
    renderWithHistory(["/knowledge-base", "/live-scribing"], 0);

    expect(isBlocked()).toBe(true);
  });

  for (const variant of ["/knowledge-base?from=nav", "/knowledge-base/", "/training?tab=lessons"]) {
    it(`blocks the deep link ${variant}, not just the bare path`, () => {
      // A query string or a trailing slash must not find an unguarded alias of
      // a gated route. This is the test that fails first if the route table is
      // ever refactored into two entries where one forgot the gate.
      startIn("assessment");
      renderAt(variant);

      expect(isBlocked()).toBe(true);
    });
  }
});

describe("D4 and a restart: what today's behaviour actually is", () => {
  /**
   * CHARACTERIZATION, not endorsement. The session store does not restore an
   * in-flight attempt at boot - only the profile store hydrates - so after a
   * restart there is no session in memory and `mayAccessReferenceMaterial`
   * answers about nothing rather than about the assessment still sitting in the
   * database as `in_progress`.
   *
   * Whether that is correct is a decision, not a bug to fix here: D6 already
   * permits retaking an interrupted Assessment as a new attempt, and nothing
   * forbids reading before a first attempt. The open question is narrower -
   * whether a learner who has *seen* a scenario may study and then retake that
   * same scenario - and answering it would change D4's scope or D6's retake
   * rule. It is recorded as a finding in `docs/DECISION_REGISTER.md` rather
   * than decided by a test.
   *
   * This test pins the behaviour so the answer, when it comes, has to be
   * deliberate: whoever changes it will see this test fail and read why.
   */
  function interruptedAssessmentRecord(): SessionRecord {
    return {
      id: "a-interrupted-restart",
      scenarioId: SCENARIO.scenarioId,
      scenarioVersion: SCENARIO.version,
      scenarioTitle: SCENARIO.title,
      mode: "assessment",
      status: "in_progress",
      startedAt: 1_700_000_000_000,
      activeMs: 30_000,
      pausedMs: 0,
      completedAt: null,
      flags: [],
      draft: { ...createEmptyDraft(), hpi: "written before the interruption" },
      evaluation: null
    };
  }

  it("leaves an interrupted assessment in persistence and no session in memory", async () => {
    await sessionRepository.save(interruptedAssessmentRecord());

    const stored = await sessionRepository.findInterrupted();
    expect(stored.map((s) => s.id), "the attempt is still recorded").toContain("a-interrupted-restart");
    expect(useSessionStore.getState().session, "nothing restores it into memory").toBeNull();
  });

  it("therefore opens the book after a restart - recorded, not endorsed", async () => {
    await sessionRepository.save(interruptedAssessmentRecord());

    renderAt("/knowledge-base");

    // If an owner decision later closes this window, this expectation is the
    // one that must change, and its comment above says what to change it to.
    expect(isBlocked()).toBe(false);
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
      ["content", "scenarios.ts"],
      // The Training question run (M23), which arrived on `main` with the D15
      // merge. It renders question-bank content, so it is a reference surface
      // in D4's sense - and it is reached only through `/training`, which the
      // router wraps in the gate. Its fixture bank is the content layer for it.
      ["training", "QuestionRun.tsx"],
      ["preview", "previewQuestionBank.ts"]
    ].map((parts) => path.join(srcRoot, ...parts))
  );

  it("finds the application sources it is supposed to be scanning", () => {
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(path.join(srcRoot, "App.tsx"));
  });

  /**
   * The symbols that mean "this file renders learner-facing reference content".
   *
   * The first two are the terminology and lesson repositories. The rest arrived
   * with the D15 merge and with the Knowledgebase work now in progress on
   * `feat/knowledgebase-expansion`: a component that reads the question bank or
   * the knowledge corpus is every bit as much a reference surface as one that
   * reads terminology, and a scan that only knew the original two names would
   * have called such a component clean.
   */
  const REFERENCE_SYMBOLS = [
    "terminologyRepository",
    "lessonRepository",
    "previewQuestionRepository",
    "syntheticPreviewQuestions",
    "getProductionEligible",
    "QuestionBankRepository",
    "buildKnowledgeCorpus",
    "knowledgeRecords"
  ];

  it("has no unexpected surface reading reference content directly", () => {
    // A new component rendering terminology, lessons, bank questions or corpus
    // records would sit outside the gated routes and quietly reopen the book.
    // It must be gated, and then listed in ALLOWED deliberately.
    const READS_REFERENCE = new RegExp(`\\b(${REFERENCE_SYMBOLS.join("|")})\\b`);
    const offenders = sourceFiles(srcRoot)
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => READS_REFERENCE.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file));

    expect(offenders, "must be reached through ReferenceGate").toEqual([]);
  });

  it("actually detects a reference surface, rather than passing because it matches nothing", () => {
    // A scan is only worth its runtime if it would fail. Every symbol in the
    // list must appear somewhere in the application, or it is dead weight that
    // makes the guard look stronger than it is.
    const sources = sourceFiles(srcRoot).map((file) => readFileSync(file, "utf8"));
    const unused = REFERENCE_SYMBOLS.filter((symbol) => !sources.some((s) => new RegExp(`\\b${symbol}\\b`).test(s)));

    // `buildKnowledgeCorpus` and `knowledgeRecords` are deliberately ahead of
    // the application: the corpus is in `nexus-core` but no surface renders it
    // yet, and the point of naming them now is that the first one to do so is
    // caught. Everything else must be real.
    expect(unused, "unused reference symbols").toEqual(["buildKnowledgeCorpus", "knowledgeRecords"]);
    expect(sources.filter((s) => /\bpreviewQuestionRepository\b/.test(s)).length, "the question bank is reachable").toBeGreaterThan(0);
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
