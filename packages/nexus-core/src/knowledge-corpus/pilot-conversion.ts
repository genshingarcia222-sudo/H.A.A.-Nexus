import type { AuthorityClass } from "./schema.js";
import type { Modality } from "./item.js";

/**
 * Pilot Batch 001 revision 3 → candidate corpus records (D12-56).
 *
 * Conversion **reads** r3 and **writes new** records. The batch artifact and
 * both hash-pinned fixtures are never touched, and nothing gains a status: all
 * twelve items stay `candidate` / `pending` with `HUMAN-VERIFY-REQUIRED`, and
 * the human gate stays where it is.
 *
 * Two decisions are deliberately *inputs* rather than inferences. Modality is
 * assigned from an explicit table, because the D12 rule is that modality is
 * authored and never guessed from wording. Authority class likewise: which
 * class a publisher belongs to is a judgement about the source, not a string
 * match on its id.
 *
 * Where text moves, it moves **verbatim**. A situational stem is split at its
 * final question sentence, and `contextText + " " + task` reproduces the
 * original exactly — asserted by test, for all three situational items.
 */

export interface PilotChoice {
  id: string;
  text: string;
  why?: string;
}

export interface PilotItem {
  id: string;
  domain: string;
  skillArea: string;
  difficultyLevel: 1 | 2 | 3 | 4 | 5 | 6;
  questionType: string;
  learningObjective: string;
  question: string;
  choices: PilotChoice[];
  correctChoiceId: string;
  rationale: string;
  source: { ref?: string; locator: string } & Record<string, unknown>;
  codingReference?: Record<string, unknown>;
  variantGroup?: string;
  contentStatus: string;
  reviewStatus: string;
  validUntil?: string;
  flags?: string[];
  verification?: {
    locatorConfidence?: string;
    humanVerificationRequired: boolean;
    humanVerifiedBy: string | null;
    humanVerifiedOn: string | null;
  };
}

export interface PilotBatch {
  batchId: string;
  revision: number;
  createdOn?: string;
  sources: Record<string, Record<string, unknown>>;
  items: PilotItem[];
}

export interface ConversionPlan {
  /** Modality per item id. Every item must appear: nothing is inferred. */
  modalities: Record<string, Modality>;
  /** Authority class per source id. Every source must appear. */
  authorityClasses: Record<string, AuthorityClass>;
  /** Item ids whose stem carries a case, with the context id to mint. */
  contexts: Record<string, { contextId: string; role: string }>;
  /** The agent recorded as author of the converted records. */
  agent: string;
  /** The date the conversion runs, supplied rather than read from a clock. */
  convertedOn: string;
  /** When the machine retrieval recorded in r3 happened. */
  retrievedOn: string;
}

export interface ConversionResult {
  sources: Record<string, unknown>[];
  contexts: Record<string, unknown>[];
  concepts: Record<string, unknown>[];
  items: Record<string, unknown>[];
  /** Things a human must look at. Never silently resolved. */
  warnings: string[];
}

export interface SituationalSplit {
  contextText: string;
  task: string;
}

/**
 * Splits a stem into its case and its question, losslessly.
 *
 * The task is the final sentence ending in a question mark; everything before
 * it is the case. Rejoining with a single space reproduces the original, which
 * is the property the conversion test asserts — the point is that no word is
 * added, removed or reworded on the way into the corpus.
 */
export function splitSituationalStem(question: string): SituationalSplit | null {
  const trimmed = question.trim();
  if (!trimmed.endsWith("?")) return null;

  // Find the start of the last sentence. Sentence ends are ". ", "? " or "! "
  // followed by a capital; quoted material inside a sentence is left alone.
  const boundary = /[.?!]\s+(?=[A-Z])/g;
  let lastIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(trimmed)) !== null) {
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex <= 0) return null;

  const contextText = trimmed.slice(0, lastIndex).trim();
  const task = trimmed.slice(lastIndex).trim();
  if (!contextText || !task) return null;
  return { contextText, task };
}

/** The sentences of a case, for addressable context segments. */
export function sentencesOf(text: string): string[] {
  const parts = text.match(/[^.?!]+[.?!]+(?:\s|$)/g);
  if (!parts) return [text.trim()];
  return parts.map((part) => part.trim()).filter(Boolean);
}

function machineVerificationFrom(item: PilotItem, plan: ConversionPlan, sourceRef: string): Record<string, unknown>[] {
  const confidence = item.verification?.locatorConfidence;
  if (!confidence) return [];
  // r3 records machine retrieval as prose. It becomes a structured entry that
  // still says exactly what it said: a machine found the locator, on a date.
  return [
    {
      sourceRef,
      method: "RETRIEVED_AUTHORITY",
      retrievedOn: plan.retrievedOn,
      snapshotHash: null,
      locatorFound: true,
      verifier: plan.agent,
      note: confidence
    }
  ];
}

/**
 * Converts a batch. Pure: same batch and plan in, same records out.
 */
export function convertPilotBatch(batch: PilotBatch, plan: ConversionPlan): ConversionResult {
  const warnings: string[] = [];
  const originBatch = `${batch.batchId}@r${batch.revision}`;
  const provenance = {
    generationMethod: "MACHINE_DRAFTED" as const,
    authoredBy: plan.agent,
    authoredOn: plan.convertedOn,
    originBatch
  };

  const sources = Object.entries(batch.sources).map(([id, definition]) => {
    const authorityClass = plan.authorityClasses[id];
    if (!authorityClass) warnings.push(`source "${id}": no authority class in the conversion plan`);
    const dateOrVersion = typeof definition.dateOrVersion === "string" ? definition.dateOrVersion : undefined;
    return {
      id,
      authority: definition.authority,
      title: definition.title,
      ...(definition.url ? { url: definition.url } : {}),
      ...(dateOrVersion ? { dateOrVersion } : {}),
      jurisdiction: definition.jurisdiction ?? "US",
      authorityClass: authorityClass ?? "SECONDARY",
      status: "active" as const
    };
  });

  const contexts: Record<string, unknown>[] = [];
  const items: Record<string, unknown>[] = [];
  const conceptsById = new Map<string, Record<string, unknown>>();

  for (const item of batch.items) {
    const modality = plan.modalities[item.id];
    if (!modality) {
      warnings.push(`item "${item.id}": no modality in the conversion plan; not converted`);
      continue;
    }

    const flags = [...(item.flags ?? [])];
    if (!flags.includes("HUMAN-VERIFY-REQUIRED")) {
      // The pilot's own gate. A converted record that lost it would look
      // readier than it is.
      warnings.push(`item "${item.id}": HUMAN-VERIFY-REQUIRED missing in the batch; added`);
      flags.push("HUMAN-VERIFY-REQUIRED");
    }
    flags.push(`MODALITY-ASSIGNED-AT-CONVERSION: ${modality}; confirm in review`);

    let contextRef: string | undefined;
    let question = item.question;
    const plannedContext = plan.contexts[item.id];
    if (plannedContext) {
      const split = splitSituationalStem(item.question);
      if (!split) {
        warnings.push(`item "${item.id}": stem could not be split into case and task; left whole`);
      } else {
        question = split.task;
        contextRef = `${plannedContext.contextId}@1`;
        contexts.push({
          id: plannedContext.contextId,
          family: "CONTEXT",
          revision: 1,
          kind: "SCENARIO",
          synthetic: true,
          setting: "clinical documentation workflow",
          role: plannedContext.role,
          caseSummary: split.contextText,
          information: sentencesOf(split.contextText).map((text, index) => ({
            segmentId: `S${index + 1}`,
            text
          })),
          contentStatus: "candidate",
          reviewStatus: "pending",
          flags: ["HUMAN-VERIFY-REQUIRED", "CASE-SPLIT-FROM-STEM: text is verbatim from the batch"],
          provenance: { ...provenance, derivedFrom: [`${item.id}@r${batch.revision}`] },
          applicability: { jurisdictions: ["US"] }
        });
      }
    }

    const sourceRef = typeof item.source.ref === "string" ? item.source.ref : undefined;
    if (!sourceRef) warnings.push(`item "${item.id}": inline source; a production item must cite the registry`);

    if (item.variantGroup && !conceptsById.has(item.variantGroup)) {
      conceptsById.set(item.variantGroup, {
        id: item.variantGroup,
        family: "CONCEPT",
        revision: 1,
        // The learning objective, verbatim: the batch's own statement of what
        // the item tests. Rewriting it here would be authoring, not converting.
        statement: item.learningObjective,
        domain: item.domain,
        skillArea: item.skillArea,
        difficultyIntent: item.difficultyLevel,
        contentStatus: "candidate",
        reviewStatus: "pending",
        flags: ["HUMAN-VERIFY-REQUIRED"],
        provenance: { ...provenance, derivedFrom: [`${item.id}@r${batch.revision}`] }
      });
    }

    items.push({
      questionId: item.id,
      family: "ITEM",
      revision: 1,
      domain: item.domain,
      skillArea: item.skillArea,
      difficultyLevel: item.difficultyLevel,
      questionType: item.questionType,
      learningObjective: item.learningObjective,
      question,
      choices: item.choices,
      correctChoiceId: item.correctChoiceId,
      rationale: item.rationale,
      source: item.source,
      ...(item.codingReference ? { codingReference: item.codingReference } : {}),
      ...(item.variantGroup ? { variantGroup: item.variantGroup } : {}),
      ...(contextRef ? { contextRef } : {}),
      modality,
      responseFormat: "SINGLE_BEST_ANSWER",
      knowledgeRefs: [],
      contentStatus: item.contentStatus,
      reviewStatus: item.reviewStatus,
      ...(item.validUntil ? { validUntil: item.validUntil } : {}),
      flags,
      ...(item.verification ? { verification: item.verification } : {}),
      machineVerification: sourceRef ? machineVerificationFrom(item, plan, sourceRef) : [],
      applicability: {
        jurisdictions: ["US"],
        ...(item.codingReference?.effectiveFrom ? { effectiveFrom: item.codingReference.effectiveFrom } : {}),
        ...(item.validUntil ? { effectiveTo: item.validUntil } : {})
      },
      provenance: { ...provenance, derivedFrom: [`${item.id}@r${batch.revision}`] }
    });
  }

  // Converted items cite no knowledge yet. Drafting propositions from
  // rationales is authoring, and production requires them, so this is stated
  // rather than quietly left blank.
  warnings.push(
    `no KnowledgeRecords were drafted: ${items.length} items carry knowledgeRefs: [], which production eligibility requires`
  );

  return { sources, contexts, concepts: [...conceptsById.values()], items, warnings };
}
