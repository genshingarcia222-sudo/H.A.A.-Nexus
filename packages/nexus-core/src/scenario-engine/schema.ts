import { z } from "zod";

export const documentationSection = z.enum([
  "chiefComplaint",
  "hpi",
  "ros",
  "physicalExam",
  "assessment",
  "plan",
  "additionalNotes"
]);

const errorType = z.enum([
  "omission",
  "fabrication",
  "unsupported_inference",
  "incorrect_terminology",
  "incorrect_interpretation",
  "wrong_section",
  "incomplete_hpi",
  "incorrect_positive",
  "incorrect_negative",
  "irrelevant_information",
  "excessive_information",
  "formatting",
  "time_management",
  "critical_documentation_error"
]);

const errorSeverity = z.enum(["critical", "major", "minor"]);

const dimension1to5 = z.number().int().min(1).max(5);

const complexityDimensionsSchema = z.object({
  informationDensity: dimension1to5,
  complaintCount: z.number().int().min(1),
  sectionsRequired: z.array(documentationSection).min(1),
  terminologyComplexity: dimension1to5,
  relevanceComplexity: dimension1to5,
  timePressure: dimension1to5,
  distraction: dimension1to5,
  ambiguity: dimension1to5,
  specificity: dimension1to5,
  requiredInfoCount: z.number().int().min(0),
  errorRisk: dimension1to5
});

// sourceFact is required and non-empty: this is the traceability link that
// makes fabrication detection possible (Architecture Package Section 9/11).
// A requirement with no sourceFact would let the evaluator "confirm" a
// claim that was never actually in the encounter — reject it outright.
const requirementItemSchema = z.object({
  id: z.string().min(1),
  section: documentationSection,
  description: z.string().min(1),
  sourceFact: z.string().min(1, "sourceFact must trace to real encounter content, and cannot be empty"),
  acceptableVariants: z.array(z.string().min(1)).min(1, "at least one acceptable variant is required"),
  isPertinentNegative: z.boolean().optional()
});

const encounterDataSchema = z.object({
  chiefComplaintRaw: z.string().min(1),
  narrative: z.string().min(1),
  hpi: z.string(),
  ros: z.string(),
  history: z.string(),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  socialHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  physicalExam: z.string(),
  assessment: z.string(),
  plan: z.string(),
  pertinentPositives: z.array(z.string()),
  pertinentNegatives: z.array(z.string())
});

const commonScenarioErrorSchema = z.object({
  description: z.string().min(1),
  errorType,
  severity: errorSeverity
});

const scoringWeightsShape = {
  accuracy: z.number().min(0).max(1),
  completeness: z.number().min(0).max(1),
  terminology: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  structure: z.number().min(0).max(1),
  pertinentPosNeg: z.number().min(0).max(1),
  timeEfficiency: z.number().min(0).max(1)
};

const scoringWeightsSchema = z.object(scoringWeightsShape);
const partialScoringWeightsSchema = z.object(scoringWeightsShape).partial();

export const scenarioSchema = z
  .object({
    scenarioId: z.string().min(1),
    version: z.string().min(1),
    title: z.string().min(1),
    specialty: z.string().min(1),
    encounterType: z.string().min(1),
    difficulty: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6)
    ]),
    complexityDimensions: complexityDimensionsSchema,
    objectives: z.array(z.string().min(1)).min(1),
    patient: z.object({
      age: z.number().int().min(0).max(120),
      sex: z.string().min(1),
      demographicsNote: z.string().optional()
    }),
    encounter: encounterDataSchema,
    requiredDocumentation: z.array(requirementItemSchema).min(1, "a scenario with no required documentation cannot be scored"),
    optionalDocumentation: z.array(requirementItemSchema),
    terminologyMappings: z.array(z.string()),
    commonErrors: z.array(commonScenarioErrorSchema),
    scoringRules: partialScoringWeightsSchema.optional(),
    timeTargetSeconds: z.number().int().min(1),
    tags: z.array(z.string())
  })
  .superRefine((scenario, ctx) => {
    // Duplicate requirement ids would make error messages ambiguous
    // (Section 13's EvaluationError.relatedRequirementId must resolve to
    // exactly one item).
    const allIds = [...scenario.requiredDocumentation, ...scenario.optionalDocumentation].map((r) => r.id);
    const seen = new Set<string>();
    for (const id of allIds) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate requirement id "${id}" across requiredDocumentation/optionalDocumentation`
        });
      }
      seen.add(id);
    }

    // If scoringRules overrides are provided, the platform default merged
    // with the override must still sum to 1.0 (Architecture Package
    // Section 12) — this is checked at merge time (see weights.ts), but we
    // catch the simplest content-authoring mistake here too: a full
    // override object that doesn't itself sum to 1.
    if (scenario.scoringRules && Object.keys(scenario.scoringRules).length === Object.keys(scoringWeightsShape).length) {
      const sum = Object.values(scenario.scoringRules).reduce((acc: number, v) => acc + (v ?? 0), 0);
      if (Math.abs(sum - 1) > 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoringRules"],
          message: `Full scoringRules override must sum to 1.0, got ${sum}`
        });
      }
    }
  });

export type ScenarioSchemaType = z.infer<typeof scenarioSchema>;
export { scoringWeightsSchema };
