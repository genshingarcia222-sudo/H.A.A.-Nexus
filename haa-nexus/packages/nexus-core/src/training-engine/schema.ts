import { z } from "zod";

export const KnowledgeCheckSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctOptionIndex: z.number().int().min(0)
});

export const TrainingLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  version: z.string().min(1),
  explanation: z.string().min(1),
  examples: z.array(z.string()).default([]),
  knowledgeChecks: z.array(KnowledgeCheckSchema).default([]),
  /** Scenario IDs this lesson prepares a learner for - used by the recommendation engine's reverse lookup. */
  linkedScenarioIds: z.array(z.string()).default([])
});

export type TrainingLesson = z.infer<typeof TrainingLessonSchema>;
export type KnowledgeCheck = z.infer<typeof KnowledgeCheckSchema>;

export interface LessonValidationSuccess {
  success: true;
  data: TrainingLesson;
}
export interface LessonValidationFailure {
  success: false;
  errors: string[];
}

export function validateTrainingLesson(input: unknown): LessonValidationSuccess | LessonValidationFailure {
  const result = TrainingLessonSchema.safeParse(input);
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  return { success: true, data: result.data };
}
