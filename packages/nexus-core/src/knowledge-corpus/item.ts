import { z } from "zod";
import {
  TrainingQuestionObjectSchema,
  refineTrainingQuestion
} from "../question-bank/schema.js";
import {
  ApplicabilitySchema,
  CorpusVerificationSchema,
  EvidenceLinkSchema,
  MachineVerificationSchema,
  ProvenanceSchema
} from "./schema.js";
import { parsePinnedRef } from "./ids.js";

/**
 * The canonical assessment item — the D11 Training Question, extended (D12-05).
 *
 * Every inherited field keeps its name, type and meaning, and the inherited
 * cross-field rules are applied by calling `refineTrainingQuestion` rather than
 * by restating them. An existing bank file is still a valid bank file: this
 * schema is what *corpus-authored* items must satisfy, and it is strictly more
 * demanding, never differently demanding.
 *
 * What D12 adds is the structure a question needs to be selected and trusted at
 * scale: what kind of task it sets (`modality`), which case it is about
 * (`contextRef`), which propositions it rests on (`knowledgeRefs`), where and
 * when it applies (`applicability`), and where it came from (`provenance`).
 */

/**
 * The seven task structures. Closed, like `QUESTION_TYPES`: a free string would
 * let a typo create a category no renderer and no selector knows about.
 *
 * Modality is **orthogonal to `questionType`**. `questionType` describes the
 * cognitive process a learner uses (recall, interpretation); modality describes
 * the shape of the task. A situational item may be either.
 */
export const MODALITIES = [
  "DIRECT_KNOWLEDGE",
  "SITUATIONAL",
  "SOAP",
  "WORKFLOW",
  "ERROR_DETECTION",
  "COMPARATIVE_DECISION",
  "TRANSFORMATION"
] as const;

/**
 * v1 is single-best-answer throughout (D12-07).
 *
 * Constructed responses — writing a SOAP note rather than recognising one —
 * stay with the Live Scribing Simulator's documentation evaluator, which
 * already grades drafts. Adding a second grading path here would duplicate
 * that engine and change what the run state machine means by "answered".
 */
export const RESPONSE_FORMATS = ["SINGLE_BEST_ANSWER"] as const;

export const SOAP_TASKS = [
  "IDENTIFY_SECTION",
  "CATEGORISE",
  "DETECT_ERROR",
  "DETECT_OMISSION",
  "CONSISTENCY",
  "PLACE_UNPLACED"
] as const;

export const WORKFLOW_POSITIONS = ["NEXT", "FIRST", "LAST", "ORDER"] as const;

export const ERROR_DOMAINS = ["DOCUMENTATION", "CODING", "PRIVACY", "WORKFLOW", "REASONING"] as const;

export const TRANSFORMATION_FROM = ["NARRATIVE", "RAW_FINDINGS", "DOCUMENTATION", "SCENARIO", "RULE"] as const;
export const TRANSFORMATION_TO = ["STRUCTURED_NOTE", "SOAP", "CODING_CONCEPT", "WORKFLOW", "DECISION"] as const;

const WorkflowStepSchema = z.object({ stepId: z.string().min(1), text: z.string().min(1) }).strict();

/**
 * The extra structure a modality needs, all optional here and required by the
 * modality rules below. One object rather than a discriminated union, because
 * the discriminator is `modality`, which lives on the item.
 */
export const ModalityDetailSchema = z
  .object({
    soapTask: z.enum(SOAP_TASKS).optional(),
    steps: z.array(WorkflowStepSchema).optional(),
    /** The one place a workflow's true order is stored, so a variant cannot re-derive it. */
    canonicalOrder: z.array(z.string().min(1)).optional(),
    askedPosition: z.enum(WORKFLOW_POSITIONS).optional(),
    errorDomain: z.enum(ERROR_DOMAINS).optional(),
    criteria: z.array(z.string().min(1)).optional(),
    from: z.enum(TRANSFORMATION_FROM).optional(),
    to: z.enum(TRANSFORMATION_TO).optional()
  })
  .strict();

export const AssessmentItemObjectSchema = TrainingQuestionObjectSchema.extend({
  family: z.literal("ITEM"),
  revision: z.number().int().min(1),
  modality: z.enum(MODALITIES),
  responseFormat: z.enum(RESPONSE_FORMATS).default("SINGLE_BEST_ANSWER"),
  /** `<contextId>@<revision>`; pinned so a context edit cannot change a reviewed item. */
  contextRef: z.string().min(1).optional(),
  targetSegmentIds: z.array(z.string().min(1)).optional(),
  knowledgeRefs: z.array(z.string().min(1)).default([]),
  additionalEvidence: z.array(EvidenceLinkSchema).default([]),
  competencyRefs: z.array(z.string().min(1)).default([]),
  /** Editorial grouping. Tier envelopes reference collections; content never names a tier. */
  collections: z.array(z.string().min(1)).default([]),
  modalityDetail: ModalityDetailSchema.optional(),
  applicability: ApplicabilitySchema.optional(),
  provenance: ProvenanceSchema,
  machineVerification: z.array(MachineVerificationSchema).default([]),
  supersedes: z.array(z.string().min(1)).default([]),
  verification: CorpusVerificationSchema.optional()
}).strict();

/** Which modalities require a case context, and which forbid one (D12-12). */
const CONTEXT_REQUIRED: Record<string, boolean> = {
  DIRECT_KNOWLEDGE: false,
  SITUATIONAL: true,
  SOAP: true,
  WORKFLOW: false,
  ERROR_DETECTION: true,
  COMPARATIVE_DECISION: false,
  TRANSFORMATION: true
};

export const AssessmentItemSchema = AssessmentItemObjectSchema.superRefine((item, ctx) => {
  // The inherited rules, applied rather than copied.
  refineTrainingQuestion(item, ctx);

  // Three to five options. Two is a coin flip dressed as a question; more than
  // five is a reading test. The pilot's four sit inside this.
  if (item.choices.length < 3 || item.choices.length > 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["choices"],
      message: `an assessment item needs 3-5 choices, got ${item.choices.length}`
    });
  }

  // --- Context ---------------------------------------------------------
  if (CONTEXT_REQUIRED[item.modality] && !item.contextRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contextRef"],
      message: `modality ${item.modality} requires a contextRef`
    });
  }
  if (item.modality === "DIRECT_KNOWLEDGE" && item.contextRef) {
    // A stem with a case in it is not a direct-knowledge question; declaring it
    // as one would hide a situational item from every situational filter.
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contextRef"],
      message: "DIRECT_KNOWLEDGE items carry no case context"
    });
  }
  if (item.contextRef && !parsePinnedRef(item.contextRef)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contextRef"],
      message: `contextRef "${item.contextRef}" must be pinned as "<contextId>@<revision>"`
    });
  }
  if (item.targetSegmentIds?.length && !item.contextRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetSegmentIds"],
      message: "targetSegmentIds require a contextRef to resolve against"
    });
  }

  // --- Modality-specific structure -------------------------------------
  const detail = item.modalityDetail;
  const requireDetail = (present: boolean, field: string) => {
    if (!present) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modalityDetail"],
        message: `modality ${item.modality} requires modalityDetail.${field}`
      });
    }
  };

  if (item.modality === "SOAP") requireDetail(Boolean(detail?.soapTask), "soapTask");
  if (item.modality === "ERROR_DETECTION") requireDetail(Boolean(detail?.errorDomain), "errorDomain");
  if (item.modality === "COMPARATIVE_DECISION") requireDetail(Boolean(detail?.criteria?.length), "criteria");
  if (item.modality === "TRANSFORMATION") {
    requireDetail(Boolean(detail?.from), "from");
    requireDetail(Boolean(detail?.to), "to");
  }
  if (item.modality === "WORKFLOW") {
    const steps = detail?.steps ?? [];
    const order = detail?.canonicalOrder ?? [];
    requireDetail(steps.length >= 3, "steps (at least 3)");
    requireDetail(order.length > 0, "canonicalOrder");
    requireDetail(Boolean(detail?.askedPosition), "askedPosition");

    const stepIds = new Set(steps.map((step) => step.stepId));
    if (stepIds.size !== steps.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["modalityDetail", "steps"], message: "duplicate stepId" });
    }
    // The canonical order is the workflow's truth; an order that is not a
    // permutation of the steps means one of the two is wrong, and a selector
    // cannot tell which.
    if (order.length > 0 && steps.length > 0) {
      const ordered = new Set(order);
      if (ordered.size !== order.length || ordered.size !== stepIds.size || [...ordered].some((id) => !stepIds.has(id))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["modalityDetail", "canonicalOrder"],
          message: "canonicalOrder must be a permutation of the declared steps"
        });
      }
    }
  }

  // --- Temporal agreement ----------------------------------------------
  // Two fields that both mean "this stops being true on a date" must not
  // disagree, or a reader believes whichever one they happened to look at.
  const effectiveTo = item.applicability?.effectiveTo;
  if (item.validUntil && effectiveTo && item.validUntil !== effectiveTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validUntil"],
      message: `validUntil "${item.validUntil}" disagrees with applicability.effectiveTo "${effectiveTo}"`
    });
  }
  const coding = item.codingReference;
  if (coding && item.applicability) {
    const from = item.applicability.effectiveFrom;
    if (coding.effectiveFrom && from && coding.effectiveFrom !== from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codingReference", "effectiveFrom"],
        message: `codingReference.effectiveFrom "${coding.effectiveFrom}" disagrees with applicability.effectiveFrom "${from}"`
      });
    }
    if (coding.effectiveTo && effectiveTo && coding.effectiveTo !== effectiveTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codingReference", "effectiveTo"],
        message: `codingReference.effectiveTo "${coding.effectiveTo}" disagrees with applicability.effectiveTo "${effectiveTo}"`
      });
    }
  }
});

export type Modality = (typeof MODALITIES)[number];
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];
export type SoapTask = (typeof SOAP_TASKS)[number];
export type WorkflowPosition = (typeof WORKFLOW_POSITIONS)[number];
export type ErrorDomain = (typeof ERROR_DOMAINS)[number];
export type ModalityDetail = z.infer<typeof ModalityDetailSchema>;
export type AssessmentItem = z.infer<typeof AssessmentItemSchema>;

/** Whether a modality's items must carry a case context. */
export function requiresCaseContext(modality: Modality): boolean {
  return CONTEXT_REQUIRED[modality] === true;
}
