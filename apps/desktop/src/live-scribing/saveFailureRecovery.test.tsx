// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InMemorySessionRepository, NO_SUBSCRIPTION } from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";
import { SimulatorWorkspace } from "./SimulatorWorkspace.js";
import { SubmissionSummary } from "./SubmissionSummary.js";

/**
 * Architecture Package §28 edge cases:
 * - "simulated DB write failure (assert user sees a recoverable error, not
 *   silent data loss)";
 * - "duplicate submission" - one attempt must never be evaluated, saved, or
 *   folded into competency twice.
 */

const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function failNextSave() {
  return vi.spyOn(sessionRepository, "save").mockRejectedValueOnce(new Error("disk full"));
}

describe("save failure - state", () => {
  it("records an autosave failure without losing the draft, and clears it on the next successful save", async () => {
    useSessionStore.getState().start(SCENARIO, "simulation");
    useSessionStore.getState().updateField("hpi", "work that must not vanish");
    failNextSave();

    expect(await useSessionStore.getState().persistDraft()).toBe(false);
    expect(useSessionStore.getState().saveError).toBe("autosave");
    expect(useSessionStore.getState().draft.hpi).toBe("work that must not vanish");
    expect(await sessionRepository.list()).toEqual([]);

    expect(await useSessionStore.getState().persistDraft()).toBe(true);
    expect(useSessionStore.getState().saveError).toBeNull();
    const [record] = await sessionRepository.list();
    expect(record?.draft.hpi).toBe("work that must not vanish");
  });

  it("records a failed submission save, keeps the result, and saves it on retry", async () => {
    useSessionStore.getState().start(SCENARIO, "practice");
    failNextSave();

    await useSessionStore.getState().submit();

    expect(useSessionStore.getState().saveError).toBe("submission");
    expect(useSessionStore.getState().result).not.toBeNull();
    expect(await sessionRepository.list()).toEqual([]);

    expect(await useSessionStore.getState().persistDraft()).toBe(true);
    expect(useSessionStore.getState().saveError).toBeNull();
    const [record] = await sessionRepository.list();
    expect(record?.status).toBe("completed");
    expect(record?.evaluation?.overallScore).toBe(useSessionStore.getState().result?.overallScore);
  });

  it("clears a pending save error when a new session starts or the store resets", async () => {
    useSessionStore.getState().start(SCENARIO, "simulation");
    failNextSave();
    await useSessionStore.getState().persistDraft();
    expect(useSessionStore.getState().saveError).toBe("autosave");

    useSessionStore.getState().reset();
    expect(useSessionStore.getState().saveError).toBeNull();
  });
});

describe("save failure - what the learner sees", () => {
  it("shows no notice while saves succeed", async () => {
    useSessionStore.getState().start(SCENARIO, "simulation");
    await useSessionStore.getState().persistDraft();
    render(<SimulatorWorkspace />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the workspace announces an unsaved draft and recovers when the learner retries", async () => {
    useSessionStore.getState().start(SCENARIO, "simulation");
    useSessionStore.getState().updateField("hpi", "unsaved hpi");
    failNextSave();
    await useSessionStore.getState().persistDraft();

    render(<SimulatorWorkspace />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/could not be saved/i);
    expect(alert.textContent).toMatch(/still here on screen/i);

    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    const [record] = await sessionRepository.list();
    expect(record?.draft.hpi).toBe("unsaved hpi");
  });

  it("the submission summary warns that the result is not in history and recovers on retry", async () => {
    useSessionStore.getState().start(SCENARIO, "practice");
    failNextSave();
    await useSessionStore.getState().submit();

    render(
      <MemoryRouter>
        <SubmissionSummary />
      </MemoryRouter>
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/could not be saved to your history/i);
    expect(alert.textContent).toMatch(/will be lost if you leave/i);

    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect((await sessionRepository.list())[0]?.status).toBe("completed");
  });

  it("keeps the notice if the retry fails too", async () => {
    useSessionStore.getState().start(SCENARIO, "simulation");
    vi.spyOn(sessionRepository, "save").mockRejectedValue(new Error("still failing"));
    await useSessionStore.getState().persistDraft();

    render(<SimulatorWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Try saving again" })).toBeTruthy());
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(useSessionStore.getState().saveError).toBe("autosave");
  });
});

describe("duplicate submission", () => {
  it("evaluates, saves, and folds an attempt into competency once, however many times submit is called", async () => {
    const before = (await competencyRepository.get("practice", "accuracy"))?.attemptCount ?? 0;
    useSessionStore.getState().start(SCENARIO, "practice");
    const store = useSessionStore.getState();

    await Promise.all([store.submit(), store.submit()]);
    await useSessionStore.getState().submit();

    expect(await sessionRepository.list()).toHaveLength(1);
    expect((await competencyRepository.get("practice", "accuracy"))?.attemptCount).toBe(before + 1);
  });

  it("does not throw when submit is called on an already completed session", async () => {
    useSessionStore.getState().start(SCENARIO, "practice");
    await useSessionStore.getState().submit();
    const result = useSessionStore.getState().result;

    await expect(useSessionStore.getState().submit()).resolves.toBeUndefined();
    expect(useSessionStore.getState().result).toBe(result);
  });
});
