import { z } from "zod";
import {
  AssessmentConceptSchema,
  CaseContextSchema,
  CompetencyNodeSchema,
  KnowledgeRecordSchema,
  SourceRecordSchema
} from "./schema.js";
import type { AssessmentConcept, CaseContext, CompetencyNode, KnowledgeRecord, SourceRecord } from "./schema.js";
import { CONCEPT_ID_PATTERN, CONTEXT_ID_PATTERN, KNOWLEDGE_ID_PATTERN } from "./ids.js";

/**
 * Corpus-level validation: the checks that only make sense across records.
 *
 * Per-record structure is the schemas' job. This module answers the questions a
 * single record cannot: does every citation resolve, is every id unique across
 * families, does an exception point at a rule that exists, and does a
 * competency tree actually terminate. A dangling reference is an error, never a
 * warning — a record citing a source that is not there is unsourced content
 * wearing a citation, which is the exact failure the corpus exists to prevent.
 *
 * It validates structure and references. It says nothing about whether a
 * statement is medically, legally or clinically true; that is the human
 * verification gate, and no function here advances it.
 */

export const KnowledgeCorpusSchema = z
  .object({
    corpusId: z.string().min(1),
    version: z.string().min(1),
    sources: z.array(SourceRecordSchema).default([]),
    knowledge: z.array(KnowledgeRecordSchema).default([]),
    contexts: z.array(CaseContextSchema).default([]),
    concepts: z.array(AssessmentConceptSchema).default([]),
    competencies: z.array(CompetencyNodeSchema).default([])
  })
  .strict();

export type KnowledgeCorpus = z.infer<typeof KnowledgeCorpusSchema>;

export type KnowledgeCorpusValidationResult =
  | { success: true; data: KnowledgeCorpus }
  | { success: false; errors: string[] };

function formatIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/** Every record that walks the lifecycle, as `{ id, revision }` pairs. */
function lifecycleRecords(corpus: KnowledgeCorpus): { id: string; revision: number; where: string }[] {
  return [
    ...corpus.knowledge.map((record, index) => ({ id: record.id, revision: record.revision, where: `knowledge.${index}` })),
    ...corpus.contexts.map((record, index) => ({ id: record.id, revision: record.revision, where: `contexts.${index}` })),
    ...corpus.concepts.map((record, index) => ({ id: record.id, revision: record.revision, where: `concepts.${index}` }))
  ];
}

function checkIdShape(errors: string[], where: string, id: string, pattern: RegExp, shape: string): void {
  if (!pattern.test(id)) {
    errors.push(`${where}.id: "${id}" does not follow the ${shape} convention`);
  }
}

/**
 * Validates a whole corpus: structure first, then every cross-record rule.
 *
 * Structural failures short-circuit. Resolving references against records that
 * did not parse would report a second, misleading set of errors about data that
 * was never valid in the first place.
 */
export function validateKnowledgeCorpus(raw: unknown): KnowledgeCorpusValidationResult {
  const parsed = KnowledgeCorpusSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errors: formatIssues(parsed.error) };
  }

  const corpus = parsed.data;
  const errors: string[] = [];

  // --- Identity ---------------------------------------------------------
  // Ids are unique across *all* families, not per family: a delivery record or
  // a supersession chain names an id alone, and an id meaning two things in two
  // families makes that reference ambiguous.
  const seenIds = new Map<string, string>();
  for (const record of lifecycleRecords(corpus)) {
    const previous = seenIds.get(record.id);
    if (previous) {
      errors.push(`${record.where}.id: duplicate record id "${record.id}" (already used at ${previous})`);
    }
    seenIds.set(record.id, record.where);
  }

  const seenSourceIds = new Set<string>();
  for (const [index, source] of corpus.sources.entries()) {
    if (seenSourceIds.has(source.id)) {
      errors.push(`sources.${index}.id: duplicate source id "${source.id}"`);
    }
    seenSourceIds.add(source.id);
  }

  const seenCompetencyIds = new Set<string>();
  for (const [index, node] of corpus.competencies.entries()) {
    if (seenCompetencyIds.has(node.id)) {
      errors.push(`competencies.${index}.id: duplicate competency id "${node.id}"`);
    }
    seenCompetencyIds.add(node.id);
  }

  for (const [index, record] of corpus.knowledge.entries()) {
    checkIdShape(errors, `knowledge.${index}`, record.id, KNOWLEDGE_ID_PATTERN, "NEXUS-KR-<DOMAIN>-<nnnnnn>");
  }
  for (const [index, record] of corpus.contexts.entries()) {
    checkIdShape(errors, `contexts.${index}`, record.id, CONTEXT_ID_PATTERN, "NEXUS-CX-<DOMAIN>-<nnnnnn>");
  }
  for (const [index, record] of corpus.concepts.entries()) {
    checkIdShape(errors, `concepts.${index}`, record.id, CONCEPT_ID_PATTERN, "variantGroup");
  }

  // --- Evidence ---------------------------------------------------------
  const evidenceBearing: { where: string; evidence: { ref: string }[] }[] = [
    ...corpus.knowledge.map((record, index) => ({ where: `knowledge.${index}`, evidence: record.evidence })),
    ...corpus.contexts.map((record, index) => ({ where: `contexts.${index}`, evidence: record.evidence }))
  ];
  for (const bearer of evidenceBearing) {
    for (const [index, link] of bearer.evidence.entries()) {
      if (!seenSourceIds.has(link.ref)) {
        errors.push(`${bearer.where}.evidence.${index}.ref: "${link.ref}" is not a source in this corpus`);
      }
    }
  }

  // A machine verification entry names the source it retrieved; an entry about
  // a source the corpus does not describe cannot be checked by anyone later.
  const machineBearing = [
    ...corpus.knowledge.map((record, index) => ({ where: `knowledge.${index}`, entries: record.machineVerification })),
    ...corpus.contexts.map((record, index) => ({ where: `contexts.${index}`, entries: record.machineVerification })),
    ...corpus.concepts.map((record, index) => ({ where: `concepts.${index}`, entries: record.machineVerification }))
  ];
  for (const bearer of machineBearing) {
    for (const [index, entry] of bearer.entries.entries()) {
      if (!seenSourceIds.has(entry.sourceRef)) {
        errors.push(`${bearer.where}.machineVerification.${index}.sourceRef: "${entry.sourceRef}" is not a source in this corpus`);
      }
    }
  }

  for (const [index, source] of corpus.sources.entries()) {
    if (source.supersededBy && !seenSourceIds.has(source.supersededBy)) {
      errors.push(`sources.${index}.supersededBy: "${source.supersededBy}" is not a source in this corpus`);
    }
  }

  // --- Knowledge relationships -----------------------------------------
  const knowledgeById = new Map(corpus.knowledge.map((record) => [record.id, record]));
  for (const [index, record] of corpus.knowledge.entries()) {
    if (record.exceptionOf && !knowledgeById.has(record.exceptionOf)) {
      errors.push(`knowledge.${index}.exceptionOf: "${record.exceptionOf}" is not a knowledge record in this corpus`);
    }
  }

  for (const [index, concept] of corpus.concepts.entries()) {
    for (const [refIndex, ref] of concept.knowledgeRefs.entries()) {
      if (!knowledgeById.has(ref)) {
        errors.push(`concepts.${index}.knowledgeRefs.${refIndex}: "${ref}" is not a knowledge record in this corpus`);
      }
    }
  }

  // --- Competency tree --------------------------------------------------
  const competencyById = new Map(corpus.competencies.map((node) => [node.id, node]));
  for (const [index, node] of corpus.competencies.entries()) {
    if (node.parentId && !competencyById.has(node.parentId)) {
      errors.push(`competencies.${index}.parentId: "${node.parentId}" is not a competency in this corpus`);
    }
  }
  for (const [index, node] of corpus.competencies.entries()) {
    // A cycle would make "walk to the root" a hang rather than an error, so it
    // is caught here instead of at whatever surface first tries to walk it.
    const walked = new Set<string>([node.id]);
    let current = node.parentId;
    while (current) {
      if (walked.has(current)) {
        errors.push(`competencies.${index}.parentId: competency "${node.id}" is in a parent cycle`);
        break;
      }
      walked.add(current);
      current = competencyById.get(current)?.parentId;
    }
  }

  const activeCompetencies = new Set(
    corpus.competencies.filter((node) => node.status === "active").map((node) => node.id)
  );
  const competencyBearing: { where: string; refs: string[] }[] = [
    ...corpus.knowledge.map((record, index) => ({ where: `knowledge.${index}`, refs: record.competencyRefs })),
    ...corpus.contexts.map((record, index) => ({ where: `contexts.${index}`, refs: record.competencyRefs })),
    ...corpus.concepts.map((record, index) => ({ where: `concepts.${index}`, refs: record.competencyRefs }))
  ];
  for (const bearer of competencyBearing) {
    for (const [index, ref] of bearer.refs.entries()) {
      if (!competencyById.has(ref)) {
        errors.push(`${bearer.where}.competencyRefs.${index}: "${ref}" is not a competency in this corpus`);
      } else if (!activeCompetencies.has(ref)) {
        errors.push(`${bearer.where}.competencyRefs.${index}: competency "${ref}" is retired`);
      }
    }
  }

  // --- Supersession -----------------------------------------------------
  for (const record of lifecycleRecords(corpus)) {
    const source = findRecord(corpus, record.id);
    for (const [index, superseded] of (source?.supersedes ?? []).entries()) {
      if (superseded === record.id) {
        errors.push(`${record.where}.supersedes.${index}: a record cannot supersede itself`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }
  return { success: true, data: corpus };
}

function findRecord(
  corpus: KnowledgeCorpus,
  id: string
): KnowledgeRecord | CaseContext | AssessmentConcept | undefined {
  return (
    corpus.knowledge.find((record) => record.id === id) ??
    corpus.contexts.find((record) => record.id === id) ??
    corpus.concepts.find((record) => record.id === id)
  );
}

/** Convenience: the sources a corpus describes, by id. */
export function indexSources(corpus: KnowledgeCorpus): Map<string, SourceRecord> {
  return new Map(corpus.sources.map((source) => [source.id, source]));
}

/**
 * Which records cite a given source — the reverse index source-change
 * invalidation walks (D12-34). Built on demand rather than stored, so it can
 * never disagree with the corpus it describes.
 */
export function indexRecordsBySource(corpus: KnowledgeCorpus): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (ref: string, id: string) => {
    const existing = index.get(ref);
    if (existing) {
      if (!existing.includes(id)) existing.push(id);
      return;
    }
    index.set(ref, [id]);
  };

  for (const record of corpus.knowledge) {
    for (const link of record.evidence) add(link.ref, record.id);
  }
  for (const record of corpus.contexts) {
    for (const link of record.evidence) add(link.ref, record.id);
  }
  return index;
}

/** Competency ids from a node to the registry root, nearest first. */
export function competencyPath(corpus: KnowledgeCorpus, id: string): string[] {
  const byId = new Map(corpus.competencies.map((node) => [node.id, node]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current: CompetencyNode | undefined = byId.get(id);
  while (current && !seen.has(current.id)) {
    path.push(current.id);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
