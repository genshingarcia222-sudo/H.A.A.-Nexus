// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@haa-nexus/nexus-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@haa-nexus/nexus-core")>();
  return { ...actual, evaluateAttempt: vi.fn(actual.evaluateAttempt) };
});

import {
  evaluateAttempt,
  InMemoryCompetencyRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION
} from "@haa-nexus/nexus-core";
import { LiveScribing } from "../routes/LiveScribing.js";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository, competencyRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "../content/scenarios.js";

const evaluateMock = vi.mocked(evaluateAttempt);

/** A completed attempt renders SubmissionSummary, which navigates. */
function renderLive() {
  return render(
    <MemoryRouter>
      <LiveScribing />
    </MemoryRouter>
  );
}
const SCENARIO = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;
const PRO = { tier: "pro", status: "active", currentPeriodEnd: null, fastTrackPurchased: false } as const;

/**
 * D9 — what happens when evaluation itself fails.
 *
 * Before this, a throw from `evaluateAttempt` escaped `submit` and rejected the
 * promise the Submit handler awaited. The attempt stayed `in_progress`, nothing
 * was written, and the learner saw **no response at all** to having pressed
 * Submit. Deterministic evaluation over validated content makes a throw
 * unlikely, which is why it was recorded rather than treated as a live defect -
 * but "unlikely" and "silent" together are how work gets lost.
 *
 * The decision: an evaluation failure is treated exactly as Architecture
 * Package §28 already treats a failed save. The work is never lost, the failure
 * is visible, the attempt is retryable, and it counts toward nothing until it
 * is actually scored.
 */

async function submitWith(mode: "practice" | "assessment", failures: number) {
  for (let i = 0; i < failures; i++) {
    evaluateMock.mockImplementationOnce(() => {
      throw new Error("evaluator blew up");
    });
  }
  expect(useSessionStore.getState().start(SCENARIO, mode)).toBe(true);
  useSessionStore.getState().updateField("hpi", "three days of cough");
  await useSessionStore.getState().submit();
}

beforeEach(() => {
  evaluateMock.mockClear();
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  (competencyRepository as InMemoryCompetencyRepository).clear();
  useEntitlementStore.getState().setSubscription(PRO);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("D9: a failed evaluation is visible, retryable, and costs nothing", () => {
  it("records the attempt as evaluation_failed instead of leaving it in progress", async () => {
    await submitWith("practice", 1);

    const session = useSessionStore.getState().session!;
    expect(session.status).toBe("evaluation_failed");
    expect(useSessionStore.getState().evaluationFailed).toBe(true);
    expect(useSessionStore.getState().result).toBeNull();
  });

  it("saves the learner's work rather than dropping it", async () => {
    await submitWith("practice", 1);

    const id = useSessionStore.getState().session!.id;
    const saved = await sessionRepository.get(id);
    expect(saved?.status).toBe("evaluation_failed");
    expect(saved?.draft.hpi).toBe("three days of cough");
    expect(saved?.evaluation).toBeNull();
  });

  it("counts toward no competency record, because there is nothing to count", async () => {
    await submitWith("practice", 1);

    expect(await competencyRepository.get("practice", "accuracy")).toBeUndefined();
  });

  it("tells the learner, instead of doing nothing visible", async () => {
    await submitWith("practice", 1);
    renderLive();

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Not scored")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try scoring again" })).toBeTruthy();
    // The documentation is still on screen, with the learner's text in it.
    expect((screen.getByLabelText("History of Present Illness") as HTMLTextAreaElement).value).toBe(
      "three days of cough"
    );
  });

  it("scores the retry on the time the attempt actually took", async () => {
    const start = 1_700_000_000_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    evaluateMock.mockImplementationOnce(() => {
      throw new Error("evaluator blew up");
    });
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);
    now.mockReturnValue(start + 4 * 60_000);
    await useSessionStore.getState().submit();

    // An hour of staring at the error message must not change the score.
    now.mockReturnValue(start + 64 * 60_000);
    await useSessionStore.getState().retryEvaluation();

    expect(evaluateMock).toHaveBeenLastCalledWith(expect.objectContaining({ activeMs: 4 * 60_000 }));
    expect(useSessionStore.getState().session!.activeMs).toBe(4 * 60_000);
    expect(useSessionStore.getState().session!.status).toBe("completed");
  });

  it("completes the attempt and folds competency exactly once when the retry works", async () => {
    await submitWith("practice", 1);
    renderLive();

    fireEvent.click(screen.getByRole("button", { name: "Try scoring again" }));

    await waitFor(() => expect(useSessionStore.getState().result).not.toBeNull());
    const state = useSessionStore.getState();
    expect(state.session!.status).toBe("completed");
    expect(state.evaluationFailed).toBe(false);

    const record = await competencyRepository.get("practice", "accuracy");
    expect(record?.attemptCount).toBe(1);

    const saved = await sessionRepository.get(state.session!.id);
    expect(saved?.status).toBe("completed");
    expect(saved?.evaluation).not.toBeNull();
  });

  it("stays failed, and stays retryable, when the retry fails too", async () => {
    await submitWith("practice", 1);
    evaluateMock.mockImplementationOnce(() => {
      throw new Error("still broken");
    });

    await useSessionStore.getState().retryEvaluation();

    expect(useSessionStore.getState().session!.status).toBe("evaluation_failed");
    expect(useSessionStore.getState().evaluationFailed).toBe(true);
    expect(await competencyRepository.get("practice", "accuracy")).toBeUndefined();
  });

  it("does nothing on a retry for an attempt that is not in that state", async () => {
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);
    await useSessionStore.getState().retryEvaluation();

    expect(useSessionStore.getState().session!.status).toBe("in_progress");
    expect(useSessionStore.getState().result).toBeNull();
  });

  it("disables Submit, since the attempt is already finished", async () => {
    await submitWith("practice", 1);
    renderLive();

    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows no notice at all when scoring works", async () => {
    expect(useSessionStore.getState().start(SCENARIO, "practice")).toBe(true);
    await useSessionStore.getState().submit();
    renderLive();

    expect(screen.queryByText("Not scored")).toBeNull();
    expect(useSessionStore.getState().evaluationFailed).toBe(false);
  });
});

describe("D9 does not weaken the Assessment boundaries", () => {
  it("reveals nothing and reopens nothing while an assessment has no result", async () => {
    await submitWith("assessment", 1);

    const session = useSessionStore.getState().session!;
    expect(session.status).toBe("evaluation_failed");
    // D2: no performance information. D4: the books do not reopen on a
    // submission that produced nothing, because an open reference surface plus
    // a retryable attempt is a way to look things up and score again.
    expect(useSessionStore.getState().result).toBeNull();
    const saved = await sessionRepository.get(session.id);
    expect(saved?.evaluation).toBeNull();
  });

  it("folds into the assessment population, not practice, once the retry succeeds", async () => {
    await submitWith("assessment", 1);
    await useSessionStore.getState().retryEvaluation();

    // D5: separate populations, and a recovered attempt is not an exception.
    expect(await competencyRepository.get("assessment", "accuracy")).toBeDefined();
    expect(await competencyRepository.get("practice", "accuracy")).toBeUndefined();
  });
});

describe("D9 leaves a start refusal alone", () => {
  it("does not mark an evaluation failure for a session that never began", async () => {
    useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
    const locked = scenarioRepository.get("SCRIBE-IM-032", "1.0")!;

    expect(useSessionStore.getState().start(locked, "practice")).toBe(false);
    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().evaluationFailed).toBe(false);
  });
});
