import { QuestionBankSchema, TrainingQuestionSchema } from "./schema.js";
import type { QuestionBank, TrainingQuestion } from "./schema.js";

export type QuestionValidationResult =
  | { success: true; data: TrainingQuestion }
  | { success: false; errors: string[] };

export type QuestionBankValidationResult =
  | { success: true; data: QuestionBank }
  | { success: false; errors: string[] };

function formatIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/**
 * The only path by which raw JSON becomes a trusted `TrainingQuestion`.
 *
 * Nothing downstream — a future selector, a remediation surface, Assessment —
 * should accept question data that has not been through here. Failures are hard
 * failures, following `validateScenario`: a dangling correct-answer reference
 * or a status claiming more verification than exists is not a warning to be
 * ignored on a busy day.
 *
 * It validates *structure and provenance*. It does not, and cannot, check
 * whether a question is medically, legally or clinically correct — that is the
 * human source-verification gate, and this function never advances it.
 */
export function validateTrainingQuestion(raw: unknown): QuestionValidationResult {
  const parsed = TrainingQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errors: formatIssues(parsed.error) };
  }
  return { success: true, data: parsed.data };
}

/**
 * Validates a whole bank, including the checks that only make sense across
 * questions: id collisions, and source refs resolving against the bank's own
 * `sources` table.
 */
export function validateQuestionBank(raw: unknown): QuestionBankValidationResult {
  const parsed = QuestionBankSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errors: formatIssues(parsed.error) };
  }
  return { success: true, data: parsed.data };
}
