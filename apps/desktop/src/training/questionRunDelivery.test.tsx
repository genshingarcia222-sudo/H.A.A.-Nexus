// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  InMemoryQuestionBankRepository,
  createSeededRandom,
  resolveTrainingEnvelope,
  selectDelivery,
  validateTrainingQuestion,
  type TrainingQuestion
} from "@haa-nexus/nexus-core";
import { QuestionRun } from "./QuestionRun.js";

/**
 * D12 work package 9 — Training runs on the delivery layer.
 *
 * What these pin: the run really goes through `selectDelivery` (not a second
 * selection path), the bank's eligibility gate still decides what may be in the
 * pool, and the screen behaves exactly as it did before, because with no
 * exposure history delivery reduces to the previous selection.
 */

const ASOF = "2026-09-25";

// Each render is its own document: without this the second test in a file
// queries a page that still contains the first one's run.
afterEach(cleanup);

function question(index: number, overrides: Partial<TrainingQuestion> = {}): TrainingQuestion {
  const parsed = validateTrainingQuestion({
    questionId: `WP9-${String(index).padStart(3, "0")}`,
    domain: "Nexus Training Runtime",
    skillArea: "Run lifecycle",
    difficultyLevel: ((index % 6) + 1) as TrainingQuestion["difficultyLevel"],
    questionType: "recognition",
    learningObjective: `Objective ${index}`,
    question: `Runtime question ${index}?`,
    choices: [
      { id: "a", text: `Right answer ${index}`, why: "Correct." },
      { id: "b", text: `Wrong answer ${index}`, why: "Incorrect." },
      { id: "c", text: `Other answer ${index}`, why: "Incorrect." }
    ],
    correctChoiceId: "a",
    rationale: "Synthetic runtime fixture, not medical content.",
    source: { authority: "This test file", title: "questionRunDelivery.test.tsx", locator: "fixture" },
    variantGroup: `WP9-CONCEPT-${index}`,
    contentStatus: "production-eligible",
    reviewStatus: "approved",
    flags: ["SYNTHETIC-DEV-FIXTURE"],
    verification: {
      humanVerificationRequired: true,
      humanVerifiedBy: "synthetic fixture: no person verified this",
      humanVerifiedOn: "2026-09-25"
    },
    ...overrides
  });
  if (!parsed.success) throw new Error(parsed.errors.join("\n"));
  return parsed.data;
}

const bankOf = (questions: TrainingQuestion[]) => {
  const repository = new InMemoryQuestionBankRepository();
  for (const question of questions) repository.register(question);
  return repository;
};

const eligible = Array.from({ length: 12 }, (_, index) => question(index + 1));

describe("Training selects through the delivery engine", () => {
  it("renders the run the delivery engine would produce, question for question", () => {
    // The same seed through selectDelivery directly must match what the screen
    // shows: if the component grew its own selection path, this diverges.
    const repository = bankOf(eligible);
    const expected = selectDelivery({
      pool: repository.getProductionEligible(),
      request: { count: 3, asOf: ASOF },
      envelope: resolveTrainingEnvelope("free"),
      random: createSeededRandom(99)
    });
    expect(expected.status).toBe("success");
    if (expected.status !== "success") return;

    render(
      <QuestionRun repository={repository} count={3} tier="free" asOf={ASOF} random={createSeededRandom(99)} />
    );
    expect(screen.getByText(expected.questions[0]!.question)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /question 1 of 3/i })).toBeTruthy();
  });

  it("is reproducible for a seed", () => {
    const repository = bankOf(eligible);
    const first = render(
      <QuestionRun repository={repository} count={3} tier="free" asOf={ASOF} random={createSeededRandom(7)} />
    );
    const firstStem = first.container.querySelector("[data-question-id]")?.getAttribute("data-question-id");
    first.unmount();

    const second = render(
      <QuestionRun repository={repository} count={3} tier="free" asOf={ASOF} random={createSeededRandom(7)} />
    );
    const secondStem = second.container.querySelector("[data-question-id]")?.getAttribute("data-question-id");
    expect(secondStem).toBe(firstStem);
  });
});

describe("eligibility still decides the pool", () => {
  it("never serves a candidate question, even when nothing else is available", () => {
    const candidates = Array.from({ length: 12 }, (_, index) =>
      question(index + 1, {
        contentStatus: "candidate",
        reviewStatus: "pending",
        verification: { humanVerificationRequired: true, humanVerifiedBy: null, humanVerifiedOn: null }
      })
    );
    render(<QuestionRun repository={bankOf(candidates)} count={3} tier="free" asOf={ASOF} />);
    expect(screen.getByRole("status").textContent).toMatch(/Not enough production-eligible questions/i);
    expect(screen.queryByText(/Runtime question/)).toBeNull();
  });

  it("reports an insufficient pool rather than padding it", () => {
    render(<QuestionRun repository={bankOf(eligible.slice(0, 2))} count={10} tier="free" asOf={ASOF} />);
    expect(screen.getByRole("status").textContent).toMatch(/run of 10\. 2 available/i);
  });
});

describe("the envelope constrains the run", () => {
  it("refuses a session larger than the tier allows, without rendering a question", () => {
    render(<QuestionRun repository={bankOf(eligible)} count={25} tier="free" asOf={ASOF} />);
    expect(screen.getByRole("status").textContent).toMatch(/Could not start a run/i);
    expect(screen.queryByText(/Runtime question/)).toBeNull();
  });
});

describe("nothing internal leaks to the learner", () => {
  it("shows no trace, stratum, policy or exposure wording on screen", () => {
    const { container } = render(
      <QuestionRun repository={bankOf(eligible)} count={3} tier="free" asOf={ASOF} random={createSeededRandom(5)} />
    );
    const text = container.textContent ?? "";
    for (const internal of ["stratum", "novelty", "policyVersion", "envelopeId", "UNSEEN", "diversityCost"]) {
      expect(text).not.toContain(internal);
    }
  });
});
