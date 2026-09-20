// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  InMemoryQuestionBankRepository,
  createSeededRandom,
  validateTrainingQuestion,
  type TrainingQuestion
} from "@haa-nexus/nexus-core";
import { QuestionRun } from "./QuestionRun.js";
import { SYNTHETIC_FIXTURE_FLAG, syntheticPreviewQuestions } from "../preview/previewQuestionBank.js";

/**
 * The Training run as a learner meets it.
 *
 * Fixtures are synthetic and non-medical, matching the preview bank. The
 * component is given its repository and its random source, so every run here is
 * reproducible and nothing depends on ambient randomness or on what content
 * happens to be shipped.
 */

const VERIFIED = {
  humanVerificationRequired: false,
  humanVerifiedBy: "TEST FIXTURE (no person verified this; not medical content)",
  humanVerifiedOn: "2026-09-20"
};

function q(overrides: Record<string, unknown>): TrainingQuestion {
  const result = validateTrainingQuestion({
    questionId: "Q-1",
    domain: "Nexus Platform (synthetic)",
    skillArea: "Run mechanics",
    difficultyLevel: 1,
    questionType: "recognition",
    learningObjective: "Exercise the run.",
    question: "Does the run lock after submission?",
    choices: [
      { id: "a", text: "Alpha choice", why: "Alpha is not the one." },
      { id: "b", text: "Bravo choice", why: "Bravo is the one." },
      { id: "c", text: "Charlie choice" }
    ],
    correctChoiceId: "b",
    rationale: "Bravo is correct because the run locks on submission.",
    source: { authority: "H.A.A. Nexus engineering", title: "Test fixture", locator: "this file" },
    contentStatus: "production-eligible",
    reviewStatus: "approved",
    verification: VERIFIED,
    ...overrides
  });
  if (!result.success) throw new Error(`fixture invalid:\n  ${result.errors.join("\n  ")}`);
  return result.data;
}

function repoOf(questions: TrainingQuestion[]): InMemoryQuestionBankRepository {
  const repo = new InMemoryQuestionBankRepository();
  for (const question of questions) repo.register(question);
  return repo;
}

function renderRun(questions: TrainingQuestion[], count = questions.length) {
  return render(<QuestionRun repository={repoOf(questions)} random={createSeededRandom(1)} count={count} />);
}

afterEach(cleanup);

const choice = (id: string) => document.querySelector<HTMLButtonElement>(`[data-choice-id="${id}"]`)!;

describe("QuestionRun: answering one question", () => {
  it("shows the question and its choices, with nothing selected", async () => {
    renderRun([q({})]);
    expect(screen.getByText("Does the run lock after submission?")).toBeTruthy();
    expect(choice("a").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /submit answer/i }).hasAttribute("disabled")).toBe(true);
  });

  it("enables Submit only once a choice is selected", async () => {
    renderRun([q({})]);
    const submit = screen.getByRole("button", { name: /submit answer/i });
    expect(submit.hasAttribute("disabled")).toBe(true);

    fireEvent.click(choice("a"));
    expect(choice("a").getAttribute("aria-pressed")).toBe("true");
    expect(submit.hasAttribute("disabled")).toBe(false);
  });

  it("lets the learner change their mind before submitting", async () => {
    renderRun([q({})]);
    fireEvent.click(choice("a"));
    fireEvent.click(choice("c"));
    expect(choice("a").getAttribute("aria-pressed")).toBe("false");
    expect(choice("c").getAttribute("aria-pressed")).toBe("true");
  });

  it("marks a correct submission correct, in words as well as colour", async () => {
    renderRun([q({})]);
    fireEvent.click(choice("b"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(screen.getByRole("status").textContent).toContain("Correct");
    expect(choice("b").getAttribute("data-state")).toBe("correct");
    // Identifiable without seeing colour at all.
    expect(choice("b").getAttribute("aria-label")).toContain("Correct answer");
  });

  it("marks an incorrect submission incorrect and reveals the correct answer", async () => {
    renderRun([q({})]);
    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(choice("a").getAttribute("data-state")).toBe("incorrect");
    expect(choice("a").getAttribute("aria-label")).toContain("incorrect");
    // The reveal: the learner is never left to infer which one was right.
    expect(choice("b").getAttribute("data-state")).toBe("correct");
    expect(choice("b").getAttribute("aria-label")).toContain("Correct answer");
  });

  it("shows the rationale after submission, and not before", async () => {
    renderRun([q({})]);
    expect(screen.queryByText(/Bravo is correct because/)).toBeNull();

    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(screen.getByText(/Bravo is correct because the run locks on submission\./)).toBeTruthy();
  });

  it("shows per-choice explanations where they exist, and copes where they do not", async () => {
    renderRun([q({})]);
    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(screen.getByTestId("why-a").textContent).toContain("Alpha is not the one.");
    expect(screen.getByTestId("why-b").textContent).toContain("Bravo is the one.");
    // Choice c has no explanation; its absence breaks nothing.
    expect(screen.queryByTestId("why-c")).toBeNull();
    expect(choice("b").getAttribute("data-state")).toBe("correct");
  });

  it("evaluates and reveals a question with no per-choice explanations at all", async () => {
    renderRun([
      q({
        questionId: "Q-BARE",
        choices: [
          { id: "a", text: "Alpha choice" },
          { id: "b", text: "Bravo choice" }
        ]
      })
    ]);
    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(screen.getByRole("status").textContent).toContain("Incorrect");
    expect(choice("b").getAttribute("data-state")).toBe("correct");
    expect(screen.queryByTestId("why-a")).toBeNull();
  });
});

describe("QuestionRun: correctness is canonical, not positional", () => {
  it("grades the same id correctly when the choices are authored in a different order", async () => {
    renderRun([
      q({
        questionId: "Q-REORDER",
        choices: [
          { id: "c", text: "Charlie choice" },
          { id: "b", text: "Bravo choice" },
          { id: "a", text: "Alpha choice" }
        ]
      })
    ]);

    // "b" is now rendered second-from-first rather than in the middle; it is
    // still the answer.
    fireEvent.click(choice("b"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(screen.getByRole("status").textContent).toContain("Correct");
    expect(choice("b").getAttribute("data-state")).toBe("correct");
  });

  it("does not confuse choices whose text is identical", async () => {
    renderRun([
      q({
        questionId: "Q-TWIN",
        choices: [
          { id: "a", text: "Same text" },
          { id: "b", text: "Same text" }
        ]
      })
    ]);
    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(screen.getByRole("status").textContent).toContain("Incorrect");
    expect(choice("b").getAttribute("data-state")).toBe("correct");
  });
});

describe("QuestionRun: locking", () => {
  it("disables every choice after submission", async () => {
    renderRun([q({})]);
    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    for (const id of ["a", "b", "c"]) {
      expect(choice(id).hasAttribute("disabled"), `choice ${id} is still enabled`).toBe(true);
    }
  });

  it("cannot be unlocked by clicking, keyboard activation or a synthetic event", async () => {
    renderRun([q({})]);
    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    fireEvent.click(choice("b"));
    choice("b").focus();
    fireEvent.keyDown(choice("b"), { key: "Enter" });
    fireEvent.keyDown(choice("b"), { key: " " });
    // Bypasses the DOM entirely: the state machine still refuses.
    choice("b").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(choice("a").getAttribute("data-state")).toBe("incorrect");
    expect(screen.getByRole("status").textContent).toContain("Incorrect");
  });

  it("survives a burst of repeated submits without changing the outcome", async () => {
    renderRun([q({}), q({ questionId: "Q-2" })], 2);
    fireEvent.click(choice("a"));

    const submit = screen.getByRole("button", { name: /submit answer/i });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);
    submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Exactly one feedback block, one outcome, and still on question 1.
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain("Incorrect");
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
  });

  it("replaces Submit with Next once answered, so a question cannot be skipped", async () => {
    renderRun([q({}), q({ questionId: "Q-2" })], 2);
    expect(screen.queryByRole("button", { name: /next question/i })).toBeNull();

    fireEvent.click(choice("b"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(screen.getByRole("button", { name: /submit answer/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /next question/i })).toBeTruthy();
  });
});

describe("QuestionRun: progression leaves nothing behind", () => {
  const two = () => [
    q({ questionId: "Q-A", question: "First question?" }),
    q({
      questionId: "Q-B",
      question: "Second question?",
      choices: [
        { id: "x", text: "X-ray choice" },
        { id: "y", text: "Yankee choice" }
      ],
      correctChoiceId: "x",
      rationale: "X-ray is correct on the second question."
    })
  ];

  it("clears selection, feedback, rationale and lock on the next question", async () => {
    renderRun(two(), 2);

    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(screen.getByText(/Bravo is correct because/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByText("Second question?")).toBeTruthy();
    expect(screen.getByText("Question 2 of 2")).toBeTruthy();
    // No stale selection, feedback, rationale or lock.
    expect(choice("x").getAttribute("aria-pressed")).toBe("false");
    expect(choice("x").hasAttribute("disabled")).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/Bravo is correct because/)).toBeNull();
    expect(screen.queryByTestId("why-a")).toBeNull();
    expect(screen.getByRole("button", { name: /submit answer/i }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps consecutive questions independent", async () => {
    renderRun(two(), 2);

    fireEvent.click(choice("a"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(screen.getByRole("status").textContent).toContain("Incorrect");

    fireEvent.click(screen.getByRole("button", { name: /next question/i }));
    fireEvent.click(choice("x"));
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(screen.getByRole("status").textContent).toContain("Correct");
    expect(screen.getByText("X-ray is correct on the second question.")).toBeTruthy();
  });

  it("stays clean across a full ten-question run", async () => {
    const questions = Array.from({ length: 10 }, (_, i) =>
      q({ questionId: `Q-SEQ-${i}`, question: `Sequence question ${i}?`, variantGroup: `G-${i}` })
    );
    renderRun(questions, 10);

    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Question ${i} of 10`)).toBeTruthy();
      expect(screen.queryByRole("status"), `question ${i} opened with stale feedback`).toBeNull();
      expect(screen.getByRole("button", { name: /submit answer/i }).hasAttribute("disabled")).toBe(true);

      fireEvent.click(choice("b"));
      fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
      expect(screen.getByRole("status").textContent).toContain("Correct");
      fireEvent.click(screen.getByRole("button", { name: /next question/i }));
    }

    expect(screen.getByRole("status").textContent).toContain("Run complete");
    expect(screen.getByText(/Nothing was scored or saved/)).toBeTruthy();
  });
});

describe("QuestionRun: content safety at the runtime boundary", () => {
  it("shows an explicit shortfall rather than inventing questions", async () => {
    renderRun([q({}), q({ questionId: "Q-2" })], 10);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Not enough production-eligible questions");
    expect(status.textContent).toContain("2 available");
  });

  it("treats a bank of candidates as empty and serves nothing", async () => {
    // The Pilot 001 situation: content exists, none of it is cleared.
    const candidates = Array.from({ length: 12 }, (_, i) =>
      q({ questionId: `Q-CAND-${i}`, contentStatus: "candidate", reviewStatus: "pending", verification: undefined })
    );
    const repo = repoOf(candidates);
    expect(repo.getAll()).toHaveLength(12);

    render(<QuestionRun repository={repo} random={createSeededRandom(1)} />);
    expect(screen.getByRole("status").textContent).toContain("0 available");
    expect(document.querySelector("[data-choice-id]")).toBeNull();
  });

  it("serves an empty bank safely", async () => {
    render(<QuestionRun repository={new InMemoryQuestionBankRepository()} random={createSeededRandom(1)} />);
    expect(screen.getByRole("status").textContent).toContain("Not enough production-eligible questions");
  });

  it("rejects an invalid run size without crashing", async () => {
    renderRun([q({})], 0);
    expect(screen.getByRole("status").textContent).toContain("Could not start a run");
  });
});

describe("the synthetic preview bank", () => {
  it("validates, is production-eligible, and is flagged synthetic", () => {
    const questions = syntheticPreviewQuestions();
    expect(questions.length).toBeGreaterThanOrEqual(10);
    for (const question of questions) {
      expect(question.flags, `${question.questionId} is not flagged synthetic`).toContain(SYNTHETIC_FIXTURE_FLAG);
      expect(question.contentStatus).toBe("production-eligible");
      // Honest about itself: no person verified it, and it says so.
      expect(question.verification?.humanVerifiedBy).toMatch(/SYNTHETIC/i);
      expect(question.domain).toContain("synthetic");
    }
  });

  it("drives a real ten-question run end to end", async () => {
    const repo = repoOf(syntheticPreviewQuestions());
    render(<QuestionRun repository={repo} random={createSeededRandom(7)} />);

    expect(screen.getByText("Question 1 of 10")).toBeTruthy();
    const first = document.querySelector<HTMLButtonElement>("[data-choice-id]")!;
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(within(screen.getByRole("status")).getByText(/Correct|Incorrect/)).toBeTruthy();
  });
});
