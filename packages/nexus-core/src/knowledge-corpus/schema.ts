import { z } from "zod";
import { CORPUS_DIFFICULTY_BANDS } from "./difficulty.js";
import {
  CONTENT_STATUSES,
  REVIEW_STATUSES,
  QuestionDifficultySchema,
  SourceDefinitionSchema,
  VerificationRecordSchema
} from "../question-bank/schema.js";

/**
 * The canonical Nexus Knowledge Corpus — record families.
 *
 * Owner decision D12, resolved by
 * `NEXUS_D12_KNOWLEDGE_BASE_ARCHITECTURE_AND_IMPLEMENTATION_HANDOFF` v1.0.0
 * (2026-09-21): reference knowledge gets its own record type (D12-01), the D11
 * Question Bank is **extended rather than replaced** (D12-05), and both cite a
 * shared source registry (D12-14). The terminology lookup is untouched and is
 * not a corpus family (D12-49).
 *
 * This module is the content contract for the non-question families. It holds
 * no selector, no delivery policy, no exposure history and no tier: a corpus
 * record may never reference a learner, a tier, a pool or a delivery (D12-48).
 * The one-way rule is what keeps canonical truth independent of who saw what.
 *
 * Lifecycle, review status and the human verification record are **imported
 * from `question-bank/schema.ts` rather than restated**, so there is exactly one
 * definition of what "production-eligible" and "a person verified this" mean
 * (D12-03, D12-17). Extending that ladder here would create a second trust
 * model, which is precisely the failure this corpus exists to prevent.
 *
 * Every object is `.strict()`, following the bank: an unrecognised key is a
 * named error, never a silently stripped field.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO date (YYYY-MM-DD)");

/** Record families that walk the lifecycle ladder (D12-02, D12-03). */
// TASK arrives with O9 (2026-10-15): a free-text task is not a question with
// its choices missing, so it gets its own family rather than a relaxed ITEM.
// ITEM_DRAFT arrives with the 318-record draft boundary (2026-10-17): a
// record missing a required ITEM field is not an unreviewed item, it is one
// that cannot be expressed as an item at all, so it gets its own family
// rather than a relaxed schema or a quieter status.
export const CORPUS_FAMILIES = ["KNOWLEDGE", "ITEM", "CONTEXT", "CONCEPT", "TASK", "ITEM_DRAFT"] as const;

/**
 * How authoritative a source is, and therefore what it may be used to support
 * (D12-15). A textbook may illustrate a regulatory rule; it may not be the only
 * thing standing behind one.
 */
export const AUTHORITY_CLASSES = [
  "PRIMARY_REGULATION",
  "OFFICIAL_GUIDANCE",
  "OFFICIAL_CODE_SET",
  "PROFESSIONAL_BODY",
  "SECONDARY"
] as const;

/** Authority classes that may alone support a regulatory or coding claim. */
export const SUFFICIENT_AUTHORITY_CLASSES = [
  "PRIMARY_REGULATION",
  "OFFICIAL_GUIDANCE",
  "OFFICIAL_CODE_SET",
  "PROFESSIONAL_BODY"
] as const;

export const SOURCE_STATUSES = ["active", "superseded", "withdrawn"] as const;

/** What a piece of evidence is being cited *for* (D12-16). */
export const EVIDENCE_ROLES = ["ANSWER", "DISTRACTOR", "EXCEPTION", "CONTEXT"] as const;

/** How the text came to exist. Honest about machine drafting (D12-27). */
export const GENERATION_METHODS = [
  "HUMAN_AUTHORED",
  "MACHINE_DRAFTED",
  "MACHINE_DRAFTED_HUMAN_EDITED"
] as const;

export const KNOWLEDGE_KINDS = [
  "DEFINITION",
  "RULE",
  "EXCEPTION",
  "PROCEDURE",
  "CLASSIFICATION",
  "VERSION_FACT"
] as const;

export const CONTEXT_KINDS = ["SCENARIO", "SOAP_NOTE"] as const;

export const SOAP_SECTIONS = ["subjective", "objective", "assessment", "plan"] as const;

/** Defect kinds a SOAP note may deliberately seed for error-detection items. */
export const SEEDED_DEFECTS = [
  "MISPLACED",
  "OMITTED",
  "CONTRADICTORY",
  "UNSUPPORTED",
  "TERMINOLOGY"
] as const;

/**
 * Where a record applies, and for how long (D12-23, D12-25).
 *
 * The window is inclusive on both ends and may be open on either. **Temporal
 * state is never stored** — `effectiveFrom`/`effectiveTo` are the facts, and
 * whether a record is future, current or expired is computed at a date by
 * `temporal.ts`. Storing the state would make a release go stale on a calendar
 * day rather than on a content change.
 *
 * `UNIVERSAL` is for genuinely jurisdiction-neutral material such as note
 * structure. It is not a way to avoid choosing.
 */
export const ApplicabilitySchema = z
  .object({
    jurisdictions: z.array(z.string().min(1)).min(1),
    effectiveFrom: isoDate.optional(),
    effectiveTo: isoDate.optional()
  })
  .strict()
  .superRefine((applicability, ctx) => {
    const { effectiveFrom, effectiveTo } = applicability;
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: `effectiveTo "${effectiveTo}" is before effectiveFrom "${effectiveFrom}"`
      });
    }
    if (applicability.jurisdictions.includes("UNIVERSAL") && applicability.jurisdictions.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jurisdictions"],
        message: "UNIVERSAL cannot be combined with a specific jurisdiction"
      });
    }
  });

/**
 * Where a record came from.
 *
 * `authoredBy` is a person's name **or** `machine:<agent-id>`. An agent never
 * writes a person's name here: the corpus has to be able to say which of its
 * content a model drafted, and Pilot Batch 001 is `MACHINE_DRAFTED` because its
 * own batch document says the first-pass extracts were model-generated.
 */
export const ProvenanceSchema = z
  .object({
    generationMethod: z.enum(GENERATION_METHODS),
    authoredBy: z.string().min(1),
    authoredOn: isoDate,
    originBatch: z.string().min(1).optional(),
    derivedFrom: z.array(z.string().min(1)).default([]),
    /**
     * How the generator that produced this record was configured.
     *
     * Added 2026-10-16 as a DELEGATED-ENGINEERING-DECISION while migrating the
     * authored corpus, which carries both on all 432 records. They are the same
     * category as the five facts above - how this record came to exist - and
     * `generatorSeed` is specifically what makes deterministic regeneration
     * *checkable*: without it, "regenerates byte-identically" cannot be
     * verified for a migrated record. The alternative was to drop two
     * provenance fields from every record silently, which the migration rules
     * forbid.
     *
     * These are **not** the class-(d) authoring metadata D18 §3(d) keeps out of
     * the contract. `batchId`, `packet` and `fingerprints` are pipeline
     * bookkeeping about a run; these describe the generation of the record
     * itself, which is what `provenance` exists to record. Both optional, so no
     * existing record or consumer changes.
     */
    generatorVersion: z.string().min(1).optional(),
    generatorSeed: z.union([z.string().min(1), z.number()]).optional()
  })
  .strict()
  .superRefine((provenance, ctx) => {
    const machineAuthored = provenance.authoredBy.startsWith("machine:");
    if (provenance.generationMethod === "MACHINE_DRAFTED" && !machineAuthored) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authoredBy"],
        message: 'MACHINE_DRAFTED content must record authoredBy as "machine:<agent-id>"'
      });
    }
    if (provenance.generationMethod === "HUMAN_AUTHORED" && machineAuthored) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["generationMethod"],
        message: 'authoredBy "machine:…" contradicts HUMAN_AUTHORED'
      });
    }
  });

/**
 * A tool retrieved a source and found the cited wording (D12-18).
 *
 * This is evidence for a reviewer and the baseline for source-change
 * invalidation. It is **not** verification: nothing here moves a record up the
 * ladder, and `verifier` must name a machine, so a machine entry can never be
 * mistaken for a person's sign-off.
 */
export const MachineVerificationSchema = z
  .object({
    sourceRef: z.string().min(1),
    method: z.enum(["RETRIEVED_AUTHORITY", "SNAPSHOT_COMPARE"]),
    retrievedOn: isoDate,
    snapshotHash: z.string().min(1).nullable().default(null),
    locatorFound: z.boolean(),
    verifier: z.string().min(1),
    note: z.string().min(1).optional()
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (!entry.verifier.startsWith("machine:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifier"],
        message: 'machine verification must record verifier as "machine:<agent-id>"'
      });
    }
  });

/**
 * A citation into the source registry, plus what it is cited for.
 *
 * `excerpt` is capped at 50 words on purpose: it is a convenience for the
 * reviewer, not a reproduction of the source, and the source remains the
 * authority.
 */
export const EvidenceLinkSchema = z
  .object({
    ref: z.string().min(1),
    locator: z.string().min(1),
    supports: z.enum(EVIDENCE_ROLES).default("ANSWER"),
    excerpt: z.string().min(1).optional()
  })
  .strict()
  .superRefine((link, ctx) => {
    if (link.excerpt && link.excerpt.trim().split(/\s+/).length > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excerpt"],
        message: "excerpt may not exceed 50 words; cite the locator instead"
      });
    }
  });

/**
 * The human verification record, inherited from the bank and extended with the
 * source snapshots the reviewer actually looked at (D12-19).
 *
 * The inherited rule still holds and is not restated here: only a person who
 * opened the cited document may fill `humanVerifiedBy`/`humanVerifiedOn`.
 */
export const CorpusVerificationSchema = VerificationRecordSchema.extend({
  reviewedSourceSnapshots: z.array(z.string().min(1)).optional()
}).strict();

/**
 * The fields every lifecycle-bearing record carries (D12-03).
 *
 * `revision` and the lifecycle together answer "how much of this exact text has
 * a person checked?". Any content change bumps the revision and resets human
 * verification (D12-21), because a reviewer verified specific words.
 */
export const recordHeaderShape = {
  id: z.string().min(1),
  revision: z.number().int().min(1),
  contentStatus: z.enum(CONTENT_STATUSES),
  reviewStatus: z.enum(REVIEW_STATUSES),
  verification: CorpusVerificationSchema.optional(),
  machineVerification: z.array(MachineVerificationSchema).default([]),
  applicability: ApplicabilitySchema.optional(),
  provenance: ProvenanceSchema,
  supersedes: z.array(z.string().min(1)).default([]),
  competencyRefs: z.array(z.string().min(1)).default([]),
  flags: z.array(z.string().min(1)).default([])
};

/**
 * An authoritative document at a known edition (D12-14).
 *
 * It extends the bank's `SourceDefinitionSchema` so a batch's existing
 * `sources` table is a valid input shape. `snapshotHash` is what
 * source-change invalidation compares: when it moves and no reviewer has seen
 * the new bytes, everything citing it stops being deliverable.
 */
export const SourceRecordSchema = SourceDefinitionSchema.extend({
  id: z.string().min(1),
  authorityClass: z.enum(AUTHORITY_CLASSES),
  edition: z.string().min(1).optional(),
  effectiveFrom: isoDate.optional(),
  effectiveTo: isoDate.optional(),
  retrievedOn: isoDate.optional(),
  snapshotHash: z.string().min(1).optional(),
  status: z.enum(SOURCE_STATUSES).default("active"),
  supersededBy: z.string().min(1).optional()
})
  .strict()
  .superRefine((source, ctx) => {
    if (source.effectiveFrom && source.effectiveTo && source.effectiveTo < source.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: `effectiveTo "${source.effectiveTo}" is before effectiveFrom "${source.effectiveFrom}"`
      });
    }
    if (source.status === "superseded" && !source.supersededBy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supersededBy"],
        message: "a superseded source must name what superseded it"
      });
    }
  });

/**
 * One sourced proposition (D12-01).
 *
 * **One proposition per record.** A statement that needs "and" to join two
 * rules is two records; that is what makes supersession and invalidation
 * surgical rather than sweeping. Exceptions are their own records, linked by
 * `exceptionOf`, so a question resting on a rule can also point at the
 * exception and never teach the absolute version of a rule that has one.
 */

/**
 * One acceptance criterion for a free-text or structured-output task.
 *
 * `credit` is a weight for grading an open response against a rubric, and it is
 * **not** related to O5's multi-select rule: multi-select is scored
 * all-or-nothing on a set of choices, while these weights grade a written
 * answer criterion by criterion. Shapes are taken from the authored corpus
 * rather than invented.
 */
export const AcceptanceCriterionSchema = z
  .object({
    id: z.string().min(1),
    requirement: z.string().min(1),
    credit: z.number().gt(0).max(1),
    evidenceRef: z.string().min(1).optional()
  })
  .strict();

/**
 * The policy, safety and applicability metadata the authoring contract enforces
 * and the runtime contract did not model — **O6**, decided 2026-10-14.
 *
 * Seventeen of the eighteen class-(c) fields are carried; `accessClasses` is the
 * single deliberate omission, on the D18 §6.2 reasoning. The decision's own
 * ground: these are the fields the authoring lane's `SAFETY-PRECEDENCE` rule
 * enforces today, and dropping one would delete a guarantee a reviewer can
 * currently rely on.
 *
 * **Every field is optional**, so this cannot break a consumer that ignores it
 * and cannot invalidate a record that omits it. Types are taken from the 432
 * authored records, measured rather than assumed.
 *
 * **What this does not do.** Carrying `escalationRequired` means the value
 * survives migration intact; it does **not** mean any surface acts on it.
 * Enforcement is separate work and is not claimed here. Taxonomy membership —
 * that an `errorTargets` entry is a real error id — stays with the authoring
 * lane's validator, which owns the registries; this layer owns the shape.
 */
export const CorpusPolicyShape = {
  /** Safety markers. Empty on 394 records, populated on 38. */
  safetyFlags: z.array(z.string().min(1)).optional(),
  /** Privacy markers. Empty on 371 records, populated on 61. */
  privacyFlags: z.array(z.string().min(1)).optional(),
  /** Whether the task requires escalation beyond the learner's role. */
  escalationRequired: z.boolean().optional(),
  /** Whether answering safely needs clinician judgement the role lacks. */
  clinicianJudgmentRequired: z.boolean().optional(),
  /** Conditions that fail a response outright, whatever else it gets right. */
  hardFailureConditions: z.array(z.string().min(1)).optional(),
  /** Where the content applies; `UNIVERSAL` where it is not jurisdictional. */
  jurisdictions: z.array(z.string().min(1)).min(1).optional(),
  /** Whether the content depends on a specific payer's rules. */
  payerSpecific: z.boolean().optional(),
  /** The encounter date a temporal question turns on, where there is one. */
  encounterDate: z.string().min(1).nullable().optional(),
  /** What a fully correct response does. */
  goldBehavior: z.string().min(1).optional(),
  /** The rubric for an open response. */
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).optional(),
  /** Error-taxonomy ids this item targets. */
  errorTargets: z.array(z.string().min(1)).optional(),
  /** Remediation ids a wrong answer should route to. */
  remediationTargets: z.array(z.string().min(1)).optional(),
  /** Trap-taxonomy ids the distractors implement. */
  trapTypes: z.array(z.string().min(1)).optional(),
  /** What the learner is expected to produce, for a free-text task. */
  expectedOutput: z.string().min(1).optional(),
  /** Ordered steps, for a multi-stage task. */
  steps: z.array(z.string().min(1)).optional(),
  /** Curriculum module ids. */
  moduleIds: z.array(z.string().min(1)).optional(),
  /** How self-contained the item is, e.g. `SELF_CONTAINED`. */
  evidenceBasis: z.string().min(1).optional()
} as const;

/** The seventeen carried field names, so a test can assert the set. */
export const CORPUS_POLICY_FIELDS = Object.keys(CorpusPolicyShape) as readonly (keyof typeof CorpusPolicyShape)[];

/**
 * The one field O6 deliberately does not carry.
 *
 * Named here rather than left implicit so that the omission is auditable in
 * code. **Measured 2026-10-14: all 432 records carry a non-empty value**
 * (299/106/27), so the drop is not a no-op — the earlier claim that it was "on
 * zero records" was false. What makes it safe is narrower and was verified: no
 * record carries `ASSESSMENT_CLOSED_BOOK`, so D4 continues to block surfaces
 * rather than records. 27 records carry `PREMIUM_REALISTIC`, which is
 * entitlement-relevant and adjacent to D1; a consumer that needs that
 * distinction must re-derive it rather than read it here.
 */
export const CORPUS_DROPPED_POLICY_FIELDS = ["accessClasses"] as const;

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;


/**
 * Source metadata the archive is authoritative for and contract B keeps
 * alongside its own derived values — **O4**, 2026-10-15.
 *
 * `difficultyBand` is the archive's own five-band model. It is **not** a
 * replacement for `difficultyLevel` and never becomes one: the band survives a
 * numeric assignment rather than being consumed by it, so a consumer that wants
 * the archive's model reads the band while one that needs the 1-6 scale reads
 * the level and must handle its absence. See `difficulty.ts` for why `EASY`
 * cannot currently be given a level.
 */
export const CorpusSourceMetadataShape = {
  difficultyBand: z.enum(CORPUS_DIFFICULTY_BANDS).optional()
} as const;

export const KnowledgeRecordSchema = z
  .object({
    ...recordHeaderShape,
    // O6: the seventeen carried policy and safety fields, all optional.
    ...CorpusPolicyShape,
    // O4: the archive's own difficulty band, preserved beside the level.
    ...CorpusSourceMetadataShape,
    family: z.literal("KNOWLEDGE"),
    kind: z.enum(KNOWLEDGE_KINDS),
    domain: z.string().min(1),
    topic: z.string().min(1),
    title: z.string().min(1).max(120),
    statement: z.string().min(1),
    elaboration: z.string().min(1).optional(),
    qualifiers: z.array(z.string().min(1)).default([]),
    evidence: z.array(EvidenceLinkSchema).min(1),
    exceptionOf: z.string().min(1).optional(),
    learningObjective: z.string().min(1).optional()
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.kind === "EXCEPTION" && !record.exceptionOf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exceptionOf"],
        message: "an EXCEPTION record must name the rule it excepts"
      });
    }
    if (record.exceptionOf === record.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exceptionOf"],
        message: "a record cannot be an exception to itself"
      });
    }
  });

/** An addressable line of case material. Items point at these by id. */
export const SegmentSchema = z
  .object({
    segmentId: z.string().min(1),
    label: z.string().min(1).optional(),
    text: z.string().min(1)
  })
  .strict();

export const SeededDefectSchema = z
  .object({
    segmentId: z.string().min(1),
    defect: z.enum(SEEDED_DEFECTS),
    correctSection: z.enum(SOAP_SECTIONS).optional(),
    note: z.string().min(1)
  })
  .strict();

const caseContextBase = {
  ...recordHeaderShape,
  family: z.literal("CONTEXT"),
  /**
   * Required literal `true`. Architecture §27: built-in case material is
   * synthetic only, and there is no code path that accepts real PHI. A context
   * that cannot say so does not load.
   */
  synthetic: z.literal(true),
  setting: z.string().min(1),
  evidence: z.array(EvidenceLinkSchema).default([])
};

/** A situational case: who the learner is, what they know, what constrains them. */
export const ScenarioContextSchema = z
  .object({
    ...caseContextBase,
    // O6: the seventeen carried policy and safety fields, all optional.
    ...CorpusPolicyShape,
    // O4: the archive's own difficulty band, preserved beside the level.
    ...CorpusSourceMetadataShape,
    kind: z.literal("SCENARIO"),
    role: z.string().min(1),
    actors: z.array(z.object({ role: z.string().min(1), description: z.string().min(1).optional() }).strict()).default([]),
    caseSummary: z.string().min(1),
    information: z.array(SegmentSchema).min(1),
    constraints: z.array(z.string().min(1)).default([])
  })
  .strict();

/**
 * A synthetic SOAP note, held as structured sections rather than prose (D12-09).
 *
 * It is a *context*, not knowledge: a note asserts nothing true about the
 * world. What belongs in each section is a `KnowledgeRecord`; this is the
 * material a question is asked about. `unplaced` holds lines a transformation
 * item asks the learner to file, and `seededDefects` records deliberate errors
 * for reviewers — never shown to learners.
 */
export const SoapContextSchema = z
  .object({
    ...caseContextBase,
    // O6: the seventeen carried policy and safety fields, all optional.
    ...CorpusPolicyShape,
    // O4: the archive's own difficulty band, preserved beside the level.
    ...CorpusSourceMetadataShape,
    kind: z.literal("SOAP_NOTE"),
    encounterType: z.string().min(1).optional(),
    sections: z
      .object({
        subjective: z.array(SegmentSchema).default([]),
        objective: z.array(SegmentSchema).default([]),
        assessment: z.array(SegmentSchema).default([]),
        plan: z.array(SegmentSchema).default([])
      })
      .strict(),
    unplaced: z.array(SegmentSchema).default([]),
    seededDefects: z.array(SeededDefectSchema).default([])
  })
  .strict();

export const CaseContextSchema = z
  .discriminatedUnion("kind", [ScenarioContextSchema, SoapContextSchema])
  .superRefine((context, ctx) => {
    const segments =
      context.kind === "SCENARIO"
        ? context.information
        : [
            ...context.sections.subjective,
            ...context.sections.objective,
            ...context.sections.assessment,
            ...context.sections.plan,
            ...context.unplaced
          ];

    const seen = new Set<string>();
    for (const segment of segments) {
      if (seen.has(segment.segmentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments"],
          message: `Duplicate segmentId "${segment.segmentId}"`
        });
      }
      seen.add(segment.segmentId);
    }

    if (context.kind === "SOAP_NOTE") {
      if (seen.size === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: "a SOAP context must carry at least one segment"
        });
      }
      for (const [index, defect] of context.seededDefects.entries()) {
        if (!seen.has(defect.segmentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["seededDefects", index, "segmentId"],
            message: `seeded defect points at unknown segment "${defect.segmentId}"`
          });
        }
      }
    }
  });

/**
 * What a family of variants tests (D12-45).
 *
 * The concept id **is** the bank's existing `variantGroup` value, so variants
 * do not gain a second grouping field that could disagree with the first. The
 * concept is where a variant family's shared truth lives: change the
 * proposition and it is a different concept, not a variant.
 */
export const AssessmentConceptSchema = z
  .object({
    ...recordHeaderShape,
    // O6: the seventeen carried policy and safety fields, all optional.
    ...CorpusPolicyShape,
    // O4: the archive's own difficulty band, preserved beside the level.
    ...CorpusSourceMetadataShape,
    family: z.literal("CONCEPT"),
    statement: z.string().min(1),
    domain: z.string().min(1),
    skillArea: z.string().min(1).optional(),
    knowledgeRefs: z.array(z.string().min(1)).default([]),
    difficultyIntent: QuestionDifficultySchema.optional()
  })
  .strict();

/**
 * A node in the Training competency registry (D12-13).
 *
 * `externalMappings` is deliberately **empty**: whether a competency maps to
 * the evaluator's seven category domains or the module registry's twelve
 * section domains is decision A2, which is open. The field exists so A2 can be
 * answered later as data, without a schema change.
 */
export const CompetencyNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    parentId: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    status: z.enum(["active", "retired"]).default("active"),
    externalMappings: z
      .array(z.object({ system: z.enum(["EVALUATOR_7", "REGISTRY_12"]), key: z.string().min(1) }).strict())
      .default([])
  })
  .strict()
  .superRefine((node, ctx) => {
    if (node.parentId === node.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentId"], message: "a competency cannot be its own parent" });
    }
  });

export type CorpusFamily = (typeof CORPUS_FAMILIES)[number];
export type AuthorityClass = (typeof AUTHORITY_CLASSES)[number];
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number];
export type GenerationMethod = (typeof GENERATION_METHODS)[number];
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];
export type ContextKind = (typeof CONTEXT_KINDS)[number];
export type SoapSection = (typeof SOAP_SECTIONS)[number];
export type Applicability = z.infer<typeof ApplicabilitySchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type MachineVerification = z.infer<typeof MachineVerificationSchema>;
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;
export type CorpusVerification = z.infer<typeof CorpusVerificationSchema>;
export type SourceRecord = z.infer<typeof SourceRecordSchema>;
export type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type SeededDefect = z.infer<typeof SeededDefectSchema>;
export type ScenarioContext = z.infer<typeof ScenarioContextSchema>;
export type SoapContext = z.infer<typeof SoapContextSchema>;
export type CaseContext = z.infer<typeof CaseContextSchema>;
export type AssessmentConcept = z.infer<typeof AssessmentConceptSchema>;
export type CompetencyNode = z.infer<typeof CompetencyNodeSchema>;

/**
 * Whether an authority class may stand alone behind a regulatory or coding
 * claim (D12-15). Read-only, like `isProductionEligible`: it reports, and
 * promotes nothing.
 */
export function isSufficientAuthority(authorityClass: AuthorityClass): boolean {
  return (SUFFICIENT_AUTHORITY_CLASSES as readonly string[]).includes(authorityClass);
}
