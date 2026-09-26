import {
  InMemoryQuestionBankRepository,
  validateTrainingQuestion,
  type TrainingQuestion
} from "@haa-nexus/nexus-core";

/**
 * SYNTHETIC PREVIEW QUESTION BANK — development only, and **not medical content**.
 *
 * The Training runtime needs production-eligible questions to be seen working.
 * The real bank (`content/question-bank/`) is empty: no authored question has
 * passed human source verification, and Pilot Batch 001 is candidate-only. That
 * is the correct state, and this module does not change it.
 *
 * So the preview supplies its own questions, and they are deliberately **about
 * the Nexus Training runtime itself** — not about medicine, coding or privacy.
 * Nothing here can be mistaken for clinical guidance, mis-cited to a patient
 * encounter, or quietly promoted into the content archive:
 *
 * - it lives in `src/preview/`, not under `content/`, so no loader, content-QA
 *   suite or preflight scan ever discovers it;
 * - every question carries the `SYNTHETIC-DEV-FIXTURE` flag;
 * - its `source` cites this file, not an authority;
 * - `humanVerifiedBy` says plainly that no person verified it.
 *
 * Real medical content authoring belongs to the Nexus content archive under its
 * authoritative-source rules, and reaches the bank through human verification —
 * never through a fixture like this one.
 *
 * It does go through the real `validateTrainingQuestion` and the real
 * `getProductionEligible()` gate, because the point of a preview is to exercise
 * the production path rather than a parallel one.
 */

export const SYNTHETIC_FIXTURE_FLAG = "SYNTHETIC-DEV-FIXTURE";

const FIXTURE_VERIFICATION = {
  locatorConfidence: "SYNTHETIC — no external source",
  humanVerificationRequired: false,
  humanVerifiedBy: "SYNTHETIC DEV FIXTURE (no person verified this; not medical content)",
  humanVerifiedOn: "2026-09-20"
};

const FIXTURE_SOURCE = {
  authority: "H.A.A. Nexus engineering",
  title: "Synthetic Training runtime preview fixture (apps/desktop/src/preview/previewQuestionBank.ts)",
  locator: "This file. Not an external or medical authority."
};

interface FixtureSpec {
  id: string;
  skillArea: string;
  difficultyLevel: 1 | 2 | 3;
  questionType: "recognition" | "recall" | "interpretation" | "scenario" | "workflow-sequencing";
  objective: string;
  question: string;
  choices: { id: string; text: string; why?: string }[];
  correct: string;
  rationale: string;
}

const FIXTURES: FixtureSpec[] = [
  {
    id: "DEV-RUNTIME-001",
    skillArea: "Run mechanics",
    difficultyLevel: 1,
    questionType: "recognition",
    objective: "Identify what locks after an answer is submitted.",
    question: "In a Nexus Training run, what happens to the answer choices once an answer is submitted?",
    choices: [
      { id: "a", text: "They stay editable until the next question", why: "Submitting is what locks the question." },
      { id: "b", text: "They lock, and the answer cannot be changed", why: "Correct: submission is final for that question." },
      { id: "c", text: "Only the incorrect ones lock", why: "The whole question locks, not part of it." }
    ],
    correct: "b",
    rationale: "Submission is a one-way transition: the run records the answer and refuses any further selection for that question."
  },
  {
    id: "DEV-RUNTIME-002",
    skillArea: "Run mechanics",
    difficultyLevel: 1,
    questionType: "recall",
    objective: "State the default Training run length.",
    question: "How many questions does a default Nexus Training run contain?",
    choices: [
      { id: "a", text: "5" },
      { id: "b", text: "10", why: "Correct: DEFAULT_TRAINING_RUN_SIZE is 10." },
      { id: "c", text: "20" },
      { id: "d", text: "However many exist" }
    ],
    correct: "b",
    rationale: "The default run length is ten questions; a run returns exactly the requested count or reports insufficient content."
  },
  {
    id: "DEV-RUNTIME-003",
    skillArea: "Answer identity",
    difficultyLevel: 2,
    questionType: "interpretation",
    objective: "Explain why answer order does not affect correctness.",
    question: "A Training question's choices are displayed in a different order than they were authored. What happens to correctness?",
    choices: [
      { id: "a", text: "Nothing: correctness is resolved by choice id", why: "Correct: identity, not position." },
      { id: "b", text: "The first choice becomes correct", why: "Position never determines the answer." },
      { id: "c", text: "The question must be re-authored", why: "Reordering is a display concern only." }
    ],
    correct: "a",
    rationale: "Each choice carries a stable id and the question names its correct choice by that id, so display order cannot change which answer is right."
  },
  {
    id: "DEV-RUNTIME-004",
    skillArea: "Content lifecycle",
    difficultyLevel: 2,
    questionType: "recognition",
    objective: "Identify which questions may reach a learner.",
    question: "Which questions can a Training run serve to a learner?",
    choices: [
      { id: "a", text: "Any question in the bank" },
      { id: "b", text: "Only production-eligible questions", why: "Correct: candidates are never served." },
      { id: "c", text: "Any question marked candidate or above" }
    ],
    correct: "b",
    rationale: "Selection draws only from getProductionEligible(), which requires content status, review outcome and a recorded human verification to agree."
  },
  {
    id: "DEV-RUNTIME-005",
    skillArea: "Content lifecycle",
    difficultyLevel: 2,
    questionType: "scenario",
    objective: "Predict behaviour when too few questions are eligible.",
    question: "A run asks for ten questions but only seven are eligible. What does the selector do?",
    choices: [
      { id: "a", text: "Repeats three questions to reach ten", why: "A run never repeats a question to fill itself." },
      { id: "b", text: "Lowers the difficulty to find three more", why: "Filters are never silently widened." },
      { id: "c", text: "Reports insufficient eligible content", why: "Correct." },
      { id: "d", text: "Includes three candidate questions", why: "Candidates never reach a learner." }
    ],
    correct: "c",
    rationale: "A short pool is reported as insufficient-eligible-content with the requested and available counts. Padding or widening would misrepresent what was practised."
  },
  {
    id: "DEV-RUNTIME-006",
    skillArea: "Run mechanics",
    difficultyLevel: 1,
    questionType: "recall",
    objective: "State what is cleared between questions.",
    question: "What carries over from one question to the next in a Training run?",
    choices: [
      { id: "a", text: "The previous selection and feedback" },
      { id: "b", text: "Nothing: the next question starts clean", why: "Correct." },
      { id: "c", text: "Only the rationale" }
    ],
    correct: "b",
    rationale: "Advancing replaces selection and submission with their initial values, so no selection, correctness, rationale or lock state survives the transition."
  },
  {
    id: "DEV-RUNTIME-007",
    skillArea: "Answer identity",
    difficultyLevel: 3,
    questionType: "interpretation",
    objective: "Predict handling of an answer that cannot be graded.",
    question: "A submitted answer id does not match any choice on the current question. How is it treated?",
    choices: [
      { id: "a", text: "As correct, to avoid penalising the learner", why: "An ungradable answer is never treated as correct." },
      { id: "b", text: "As incorrect" },
      { id: "c", text: "It is refused, and nothing is recorded", why: "Correct: the run is left exactly as it was." }
    ],
    correct: "c",
    rationale: "An answer that cannot be graded produces a refusal rather than a grade, and no submission is recorded, so a malformed input can never read as a correct answer."
  },
  {
    id: "DEV-RUNTIME-008",
    skillArea: "Determinism",
    difficultyLevel: 2,
    questionType: "recognition",
    objective: "Identify why randomness is injected.",
    question: "Why does the Training selector take its randomness as an argument?",
    choices: [
      { id: "a", text: "So a run can be reproduced exactly", why: "Correct: same request, same pool, same source, same run." },
      { id: "b", text: "To make selection faster" },
      { id: "c", text: "To let each learner have a different seed" }
    ],
    correct: "a",
    rationale: "An injected random source makes a run reproducible, so the question of why a learner received a particular set can actually be answered."
  },
  {
    id: "DEV-RUNTIME-009",
    skillArea: "Run mechanics",
    difficultyLevel: 3,
    questionType: "workflow-sequencing",
    objective: "Order the steps of answering one question.",
    question: "What is the order of a single question in a Training run?",
    choices: [
      { id: "a", text: "Submit, select, reveal, advance" },
      { id: "b", text: "Select, submit, feedback and reveal, advance", why: "Correct." },
      { id: "c", text: "Select, advance, submit, feedback" }
    ],
    correct: "b",
    rationale: "A choice is selected, the answer is submitted and graded, feedback and the correct answer are revealed, and only then may the run advance."
  },
  {
    id: "DEV-RUNTIME-010",
    skillArea: "Content lifecycle",
    difficultyLevel: 1,
    questionType: "recognition",
    objective: "Identify what a rationale is for.",
    question: "What is a question's rationale for?",
    choices: [
      { id: "a", text: "Explaining why the correct answer is correct", why: "Correct." },
      { id: "b", text: "Recording who wrote the question" },
      { id: "c", text: "Storing the question's difficulty" }
    ],
    correct: "a",
    rationale: "The rationale explains the answer. It is required on every bank question, because a question that cannot explain itself teaches nothing once the learner has guessed."
  },
  {
    id: "DEV-RUNTIME-011",
    skillArea: "Determinism",
    difficultyLevel: 3,
    questionType: "scenario",
    objective: "Predict the effect of submitting twice.",
    question: "A learner double-clicks Submit. What happens?",
    choices: [
      { id: "a", text: "The answer is graded twice" },
      { id: "b", text: "The second submit is refused; one result stands", why: "Correct." },
      { id: "c", text: "The run advances a question" }
    ],
    correct: "b",
    rationale: "A second submit is refused rather than re-evaluated, so repeated activation produces exactly one transition and one set of feedback."
  },
  {
    id: "DEV-RUNTIME-012",
    skillArea: "Content lifecycle",
    difficultyLevel: 2,
    questionType: "recall",
    objective: "State where Assessment gets its content.",
    question: "What does Nexus Assessment mode currently work from?",
    choices: [
      { id: "a", text: "Question Bank questions" },
      { id: "b", text: "A scenario and a documentation draft", why: "Correct: Assessment is scenario-based today." },
      { id: "c", text: "A mix of both" }
    ],
    correct: "b",
    rationale: "Assessment is a session mode over scenarios: its input is a scenario and the learner's documentation draft. It has no question model, and a question-based Learning Assessment remains a separate, undecided capability."
  }
];

function toQuestion(spec: FixtureSpec): TrainingQuestion {
  const result = validateTrainingQuestion({
    questionId: spec.id,
    domain: "Nexus Platform (synthetic)",
    skillArea: spec.skillArea,
    difficultyLevel: spec.difficultyLevel,
    questionType: spec.questionType,
    learningObjective: spec.objective,
    question: spec.question,
    choices: spec.choices,
    correctChoiceId: spec.correct,
    rationale: spec.rationale,
    source: FIXTURE_SOURCE,
    variantGroup: spec.skillArea,
    contentStatus: "production-eligible",
    reviewStatus: "approved",
    flags: [SYNTHETIC_FIXTURE_FLAG],
    verification: FIXTURE_VERIFICATION
  });

  if (!result.success) {
    // A malformed fixture is a build-time bug, exactly as a bad bundled lesson is.
    throw new Error(`Synthetic preview question ${spec.id} failed validation:\n${result.errors.join("\n")}`);
  }
  return result.data;
}

/** The synthetic questions, validated through the real canonical validator. */
export function syntheticPreviewQuestions(): TrainingQuestion[] {
  return FIXTURES.map(toQuestion);
}

/**
 * A repository holding the synthetic preview questions.
 *
 * Built fresh per call and never shared as module state, so nothing accumulates
 * between runs and no learner history can form by accident.
 */
export function previewQuestionRepository(): InMemoryQuestionBankRepository {
  const repository = new InMemoryQuestionBankRepository();
  for (const question of syntheticPreviewQuestions()) repository.register(question);
  return repository;
}
