import { z } from "zod";

export const TerminologyEntrySchema = z.object({
  id: z.string().min(1),
  layTerm: z.string().min(1),
  clinicalTerm: z.string().min(1),
  acceptedAlternatives: z.array(z.string().min(1)).default([]),
  category: z.string().min(1),
  context: z.string().optional(),
  explanation: z.string().min(1),
  commonMistakes: z.array(z.string()).default([])
});

export type TerminologyEntry = z.infer<typeof TerminologyEntrySchema>;

export interface TerminologyValidationSuccess {
  success: true;
  data: TerminologyEntry;
}
export interface TerminologyValidationFailure {
  success: false;
  errors: string[];
}

export function validateTerminologyEntry(
  input: unknown
): TerminologyValidationSuccess | TerminologyValidationFailure {
  const result = TerminologyEntrySchema.safeParse(input);
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  return { success: true, data: result.data };
}
