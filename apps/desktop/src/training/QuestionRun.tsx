import { useMemo, useState } from "react";
import { Card, Button } from "@haa-nexus/ui-kit";
import {
  DEFAULT_TRAINING_RUN_SIZE,
  advanceToNextQuestion,
  answeredCount,
  currentQuestion,
  isRunComplete,
  isSubmitted,
  runProgress,
  selectChoice,
  selectTrainingQuestions,
  startTrainingRun,
  submitAnswer,
  type QuestionBankRepository,
  type RandomSource,
  type TrainingQuestion,
  type TrainingRunState
} from "@haa-nexus/nexus-core";
import { previewQuestionRepository } from "../preview/previewQuestionBank.js";

/**
 * The Training question run surface.
 *
 * It renders the run state machine in `nexus-core` and owns none of the rules:
 * no eligibility check, no difficulty filter, no diversity weighting, no
 * grading. Every transition goes through `selectChoice` / `submitAnswer` /
 * `advanceToNextQuestion`, so a rule cannot be enforced here and forgotten
 * there — or enforced twice, differently.
 *
 * Locking is a consequence of state, not of a `disabled` attribute. A choice
 * button is disabled *and* the transition is refused, so a keyboard activation,
 * an assistive-technology click or a synthetic event cannot change a submitted
 * answer.
 *
 * Feedback is never colour alone: correct and incorrect choices carry a text
 * marker and `aria-label` text as well as a border and fill, so the correct
 * answer can be identified without seeing colour at all.
 *
 * It scores nothing, stores nothing and remembers nothing between runs.
 */

export interface QuestionRunProps {
  /** Defaults to the synthetic preview bank; tests and future surfaces inject their own. */
  repository?: QuestionBankRepository;
  /** Injected so a run can be reproduced exactly. */
  random?: RandomSource;
  count?: number;
}

type RunStart =
  | { kind: "ready"; state: TrainingRunState }
  | { kind: "insufficient"; requested: number; available: number }
  | { kind: "invalid"; errors: string[] };

function beginRun(repository: QuestionBankRepository, count: number, random?: RandomSource): RunStart {
  const result = selectTrainingQuestions(repository, { count }, random);
  if (result.status === "success") return { kind: "ready", state: startTrainingRun(result.questions) };
  if (result.status === "insufficient-eligible-content") {
    return { kind: "insufficient", requested: result.requested, available: result.available };
  }
  return { kind: "invalid", errors: result.errors };
}

export function QuestionRun({ repository, random, count = DEFAULT_TRAINING_RUN_SIZE }: QuestionRunProps) {
  const bank = useMemo(() => repository ?? previewQuestionRepository(), [repository]);
  const [run, setRun] = useState<RunStart>(() => beginRun(bank, count, random));

  if (run.kind === "insufficient") {
    // The honest state, and the common one today: the real bank is empty
    // because no authored question has passed human source verification.
    // Nothing is fabricated and no filter is widened to fill the gap.
    return (
      <Card title="Training run">
        <p role="status" style={{ margin: 0 }}>
          Not enough production-eligible questions for a run of {run.requested}. {run.available} available.
        </p>
        <p style={{ margin: "var(--nexus-space-2) 0 0 0", fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
          Candidate and unverified questions are never served. A run is never padded by repeating a question, and its
          difficulty is never widened to find more.
        </p>
      </Card>
    );
  }

  if (run.kind === "invalid") {
    return (
      <Card title="Training run">
        <p role="status" style={{ margin: 0 }}>Could not start a run: {run.errors.join("; ")}</p>
      </Card>
    );
  }

  const state = run.state;

  if (isRunComplete(state)) {
    // The end of the run is a terminal state, not a wrap-around: no question is
    // rendered, so there is nothing to answer, and starting again is an
    // explicit act the learner has to take.
    return (
      <Card title="Training run">
        <p role="status" data-run-state="complete" data-answered={answeredCount(state)} style={{ margin: 0 }}>
          Run complete — {answeredCount(state)} of {state.questions.length} questions answered.
        </p>
        <p style={{ margin: "var(--nexus-space-2) 0 0 0", fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
          Nothing was scored or saved. Scoring, progress and history are separate, undecided capabilities.
        </p>
        <div style={{ marginTop: "var(--nexus-space-3)" }}>
          <Button variant="secondary" onClick={() => setRun(beginRun(bank, count, random))}>
            Start a new run
          </Button>
        </div>
      </Card>
    );
  }

  const question = currentQuestion(state);
  if (!question) return null;

  const submitted = isSubmitted(state);
  const progress = runProgress(state);

  // Every transition is the state machine's answer, never a local edit.
  const apply = (next: ReturnType<typeof selectChoice>) => setRun({ kind: "ready", state: next.state });

  return (
    <Card title={`Question ${progress.position} of ${progress.total}`}>
      {/* Runtime state, inspectable in the browser rather than inferred from
          appearance. `answered` is progress through the run, never a score. */}
      <div
        data-run-state={submitted ? "submitted" : "answering"}
        data-question-index={state.index}
        data-question-id={question.questionId}
        data-answered={answeredCount(state)}
        data-total={progress.total}
        hidden
      />
      <QuestionBody
        question={question}
        state={state}
        submitted={submitted}
        onSelect={(choiceId) => apply(selectChoice(state, choiceId))}
        onSubmit={() => apply(submitAnswer(state))}
        onNext={() => apply(advanceToNextQuestion(state))}
      />
    </Card>
  );
}

function QuestionBody({
  question,
  state,
  submitted,
  onSelect,
  onSubmit,
  onNext
}: {
  question: TrainingQuestion;
  state: TrainingRunState;
  submitted: boolean;
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const submission = state.submission;

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{question.question}</p>

      <div role="group" aria-label="Answer choices" style={{ display: "grid", gap: "var(--nexus-space-1)" }}>
        {question.choices.map((choice) => {
          const isSelected = state.selectedChoiceId === choice.id;
          const isTheAnswer = submission?.correctChoiceId === choice.id;
          const isWrongPick = submitted && isSelected && !isTheAnswer;

          // Status is spelled out, never signalled by colour alone.
          const marker = !submitted ? null : isTheAnswer ? "Correct answer" : isWrongPick ? "Your answer — incorrect" : null;

          return (
            <div key={choice.id}>
              <button
                type="button"
                onClick={() => onSelect(choice.id)}
                disabled={submitted}
                aria-pressed={isSelected}
                aria-label={marker ? `${choice.text} — ${marker}` : choice.text}
                data-choice-id={choice.id}
                data-state={isTheAnswer ? "correct" : isWrongPick ? "incorrect" : isSelected ? "selected" : "idle"}
                className="nexus-btn nexus-btn--secondary"
                style={{
                  textAlign: "left",
                  width: "100%",
                  cursor: submitted ? "default" : "pointer",
                  borderColor: isTheAnswer
                    ? "var(--nexus-color-accent)"
                    : isWrongPick
                      ? "var(--nexus-color-critical)"
                      : isSelected
                        ? "var(--nexus-color-ink-secondary)"
                        : undefined,
                  borderWidth: isSelected || isTheAnswer ? 2 : undefined,
                  background: isTheAnswer
                    ? "var(--nexus-color-accent-muted)"
                    : isWrongPick
                      ? "var(--nexus-color-critical-muted)"
                      : undefined
                }}
              >
                <span aria-hidden="true" style={{ marginRight: "var(--nexus-space-1)", fontWeight: 700 }}>
                  {submitted ? (isTheAnswer ? "✓" : isWrongPick ? "✗" : "　") : isSelected ? "●" : "○"}
                </span>
                {choice.text}
                {marker && (
                  <strong style={{ display: "block", marginTop: 4, fontSize: "var(--nexus-font-size-xs)" }}>{marker}</strong>
                )}
              </button>

              {/* Supplemental: absent per-choice explanations change nothing. */}
              {submitted && choice.why && (
                <p
                  data-testid={`why-${choice.id}`}
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "var(--nexus-font-size-xs)",
                    color: "var(--nexus-color-ink-secondary)"
                  }}
                >
                  {choice.why}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {submission && (
        <div role="status" style={{ display: "grid", gap: "var(--nexus-space-2)" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{submission.isCorrect ? "Correct" : "Incorrect"}</p>
          {/* The rationale is required by the bank schema, so a valid question
              always has one. Nothing is generated when content is thin. */}
          <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>{question.rationale}</p>
        </div>
      )}

      {/* Submit is never *replaced* by Next in the same position. React would
          reuse the DOM node, so the second half of a double-click would land on
          Next and advance the run — skipping the feedback the learner just
          earned. Submit stays put and goes inert; Next appears beside it. */}
      <div style={{ display: "flex", gap: "var(--nexus-space-2)" }}>
        <Button key="submit" onClick={onSubmit} disabled={submitted || state.selectedChoiceId === null}>
          Submit answer
        </Button>
        {submitted && (
          <Button key="next" variant="secondary" onClick={onNext}>
            Next question
          </Button>
        )}
      </div>
    </div>
  );
}
