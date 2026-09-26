// H.A.A. Nexus Knowledgebase QA: one command that answers "is this corpus
// structurally sound, and what is it missing?"
//
// Read-only. It never edits a record, never promotes one, and never marks
// anything verified — nothing here opens a source, so nothing here can.
//
//   node tools/knowledge-corpus/kb-validate.mjs                 human report
//   node tools/knowledge-corpus/kb-validate.mjs --json          machine report
//   node tools/knowledge-corpus/kb-validate.mjs --batch KB-001  one batch only
//   node tools/knowledge-corpus/kb-validate.mjs --out <path>     write JSON report
//
// Exit code 1 when any ERROR finding exists. Warnings never fail the run:
// HEURISTIC findings are author advice, and treating advice as a gate would
// push authors to satisfy a heuristic rather than a reader.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CORPUS_ROOT = path.join(REPO_ROOT, "knowledge-corpus");

const SEVERITY = { STRUCTURAL: "ERROR", POLICY: "ERROR", HEURISTIC: "WARNING" };

function readJson(relative) {
  return JSON.parse(readFileSync(path.join(CORPUS_ROOT, relative), "utf8"));
}

// --- registries ------------------------------------------------------------

export function loadRegistries() {
  const modules = readJson("registries/modules.json");
  const competencies = readJson("registries/competencies.json");
  const difficulty = readJson("registries/difficulty.json");
  const taskTypes = readJson("registries/task-types.json");
  const errors = readJson("registries/error-taxonomy.json");
  const remediations = readJson("registries/remediations.json");
  const recordTypes = readJson("registries/record-types.json");
  const lifecycle = readJson("registries/lifecycle.json");
  const access = readJson("registries/access-classes.json");
  const coding = readJson("registries/coding-versions.json");
  const mutations = readJson("registries/mutation-dimensions.json");
  const sources = readJson("sources/source-registry.json");

  return {
    moduleIds: new Set(modules.modules.map((m) => m.id)),
    modulesById: new Map(modules.modules.map((m) => [m.id, m])),
    competencyIds: new Set(competencies.competencies.map((c) => c.id)),
    competencyBySource: new Map(competencies.competencies.map((c) => [c.sourceCompetencyId, c.id])),
    difficultyIds: new Set(difficulty.bands.map((b) => b.id)),
    taskTypeIds: new Set(taskTypes.taskTypes.map((t) => t.id)),
    taskTypesById: new Map(taskTypes.taskTypes.map((t) => [t.id, t])),
    errorIds: new Set(errors.errors.map((e) => e.id)),
    remediationIds: new Set(remediations.remediations.map((r) => r.id)),
    recordTypeIds: new Set(recordTypes.recordTypes.map((r) => r.id)),
    recordTypeTokens: new Map(recordTypes.recordTypes.map((r) => [r.id, r.token])),
    lifecycleById: new Map(lifecycle.states.map((s) => [s.id, s])),
    accessIds: new Set(access.classes.map((c) => c.id)),
    codingEditions: new Map(coding.editions.map((e) => [e.id, e])),
    mutationIds: new Set(mutations.dimensions.map((d) => d.id)),
    trapIds: new Set(mutations.trapTypes.map((t) => t.id)),
    sourceRefs: new Set(sources.sources.map((s) => s.ref)),
    sourcesByRef: new Map(sources.sources.map((s) => [s.ref, s]))
  };
}

// --- text helpers ----------------------------------------------------------

export function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shortHash(text) {
  return createHash("sha256").update(String(text)).digest("hex").slice(0, 16);
}

export function trigrams(text) {
  const normalized = normalizeText(text);
  const set = new Set();
  for (let i = 0; i + 3 <= normalized.length; i += 1) set.add(normalized.slice(i, i + 3));
  return set;
}

/** Jaccard overlap on character trigrams. Cheap, language-agnostic, and enough
 *  to catch a reworded stem; it is not a semantic check and does not claim to be. */
export function trigramOverlap(a, b) {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return shared / (left.size + right.size - shared);
}

// --- declarative schema pass ----------------------------------------------

function typeMatches(value, declared) {
  const types = Array.isArray(declared) ? declared : [declared];
  return types.some((type) => {
    if (type === "null") return value === null;
    if (type === "string") return typeof value === "string";
    if (type === "boolean") return typeof value === "boolean";
    if (type === "number") return typeof value === "number";
    if (type === "integer") return Number.isInteger(value);
    if (type === "array") return Array.isArray(value);
    if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    return true;
  });
}

/**
 * Walks a record against the published JSON Schema so the schema file is the
 * single statement of structure rather than a document that drifts from the
 * checker. Supports the subset the contract uses: type, required, enum, const,
 * pattern, minLength, minimum/maximum, minItems/maxItems, properties, items and
 * additionalProperties:false.
 */
export function checkAgainstSchema(node, schema, where, findings, recordId) {
  const fail = (message, rule = "SCHEMA") =>
    findings.push({ tier: "STRUCTURAL", rule, recordId, path: where, message });

  if (schema.const !== undefined && node !== schema.const) {
    fail(`expected the literal ${JSON.stringify(schema.const)}, got ${JSON.stringify(node)}`);
    return;
  }
  if (schema.type && !typeMatches(node, schema.type)) {
    fail(`expected type ${JSON.stringify(schema.type)}, got ${node === null ? "null" : Array.isArray(node) ? "array" : typeof node}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(node)) {
    fail(`${JSON.stringify(node)} is not one of ${schema.enum.join(", ")}`, "ENUM");
    return;
  }
  if (typeof node === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(node)) fail(`"${node}" does not match ${schema.pattern}`, "PATTERN");
    if (schema.minLength !== undefined && node.length < schema.minLength) fail(`shorter than minLength ${schema.minLength}`);
  }
  if (typeof node === "number") {
    if (schema.minimum !== undefined && node < schema.minimum) fail(`below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && node > schema.maximum) fail(`above maximum ${schema.maximum}`);
  }
  if (Array.isArray(node)) {
    if (schema.minItems !== undefined && node.length < schema.minItems) fail(`needs at least ${schema.minItems} item(s), has ${node.length}`);
    if (schema.maxItems !== undefined && node.length > schema.maxItems) fail(`allows at most ${schema.maxItems} item(s), has ${node.length}`);
    if (schema.items) node.forEach((entry, index) => checkAgainstSchema(entry, schema.items, `${where}[${index}]`, findings, recordId));
  }
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    for (const key of schema.required ?? []) {
      if (!(key in node)) fail(`missing required property "${key}"`, "REQUIRED");
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(node)) {
        if (!(key in schema.properties)) fail(`unrecognised property "${key}" (objects are closed)`, "CLOSED_OBJECT");
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in node) checkAgainstSchema(node[key], child, where ? `${where}.${key}` : key, findings, recordId);
    }
  }
}

// --- policy pass -----------------------------------------------------------

const BANNED_CHOICE_TEXT = [/^all of the above/i, /^none of the above/i, /^both a and b/i];

function inWindow(date, edition) {
  if (!date || !edition) return true;
  if (edition.effectiveFrom && date < edition.effectiveFrom) return false;
  if (edition.effectiveTo && date > edition.effectiveTo) return false;
  return true;
}

export function checkPolicy(record, registries, findings) {
  const id = record.id ?? "<no id>";
  const add = (tier, rule, message, where = "") => findings.push({ tier, rule, recordId: id, path: where, message });
  const error = (rule, message, where) => add("POLICY", rule, message, where);
  const warn = (rule, message, where) => add("HEURISTIC", rule, message, where);

  // -- reference integrity -------------------------------------------------
  for (const moduleId of record.moduleIds ?? []) {
    if (!registries.moduleIds.has(moduleId)) error("REF-INTEGRITY", `module "${moduleId}" is not in the module registry`, "moduleIds");
  }
  for (const competencyId of record.competencyIds ?? []) {
    if (!registries.competencyIds.has(competencyId)) error("REF-INTEGRITY", `competency "${competencyId}" is not in the competency registry`, "competencyIds");
  }
  for (const accessClass of record.accessClasses ?? []) {
    if (!registries.accessIds.has(accessClass)) error("REF-INTEGRITY", `access class "${accessClass}" is not registered`, "accessClasses");
  }
  if (record.recordType && !registries.recordTypeIds.has(record.recordType)) error("REF-INTEGRITY", `record type "${record.recordType}" is not registered`, "recordType");
  if (record.taskType && !registries.taskTypeIds.has(record.taskType)) error("REF-INTEGRITY", `task type "${record.taskType}" is not registered`, "taskType");
  if (record.difficulty && !registries.difficultyIds.has(record.difficulty)) error("REF-INTEGRITY", `difficulty "${record.difficulty}" is not registered`, "difficulty");
  const lifecycleState = registries.lifecycleById.get(record.contentStatus);
  if (record.contentStatus && !lifecycleState) error("REF-INTEGRITY", `contentStatus "${record.contentStatus}" is not a registered lifecycle state`, "contentStatus");
  for (const mutation of record.mutationTypes ?? []) {
    if (!registries.mutationIds.has(mutation)) error("REF-INTEGRITY", `mutation dimension "${mutation}" is not registered`, "mutationTypes");
  }
  for (const target of record.errorTargets ?? []) {
    if (!registries.errorIds.has(target)) error("REF-INTEGRITY", `error target "${target}" is not in the error taxonomy`, "errorTargets");
  }
  for (const target of record.remediationTargets ?? []) {
    if (!registries.remediationIds.has(target)) error("REF-INTEGRITY", `remediation target "${target}" is not registered`, "remediationTargets");
  }
  for (const trap of record.trapTypes ?? []) {
    if (!registries.trapIds.has(trap)) error("REF-INTEGRITY", `trap type "${trap}" is not registered`, "trapTypes");
  }
  if (record.id && record.recordType) {
    const expected = registries.recordTypeTokens.get(record.recordType);
    if (expected && !record.id.startsWith(`KB-${expected}-`)) {
      warn("ID-TOKEN", `id token does not match record type ${record.recordType} (expected KB-${expected}-…); ids are opaque, so this is advice only`, "id");
    }
  }

  // -- competency pairing --------------------------------------------------
  const competencyIds = record.competencyIds ?? [];
  const sourceIds = record.sourceCompetencyIds ?? [];
  if (competencyIds.length !== sourceIds.length) {
    error("COMPETENCY-PAIRING", `competencyIds (${competencyIds.length}) and sourceCompetencyIds (${sourceIds.length}) must correspond entry by entry`, "sourceCompetencyIds");
  } else {
    competencyIds.forEach((competencyId, index) => {
      if (registries.competencyBySource.get(sourceIds[index]) !== competencyId) {
        error("COMPETENCY-PAIRING", `sourceCompetencyIds[${index}]="${sourceIds[index]}" does not map to ${competencyId}`, "sourceCompetencyIds");
      }
    });
  }

  // -- evidence basis, provenance and the machine ceiling ------------------
  const machineAuthored = String(record.provenance?.authoredBy ?? "").startsWith("machine:");
  if (record.provenance?.generationMethod === "MACHINE_DRAFTED" && !machineAuthored) {
    error("MACHINE-PROVENANCE", 'MACHINE_DRAFTED content must record authoredBy as "machine:<agent-id>"', "provenance.authoredBy");
  }
  if (record.provenance?.generationMethod === "HUMAN_AUTHORED" && machineAuthored) {
    error("MACHINE-PROVENANCE", 'authoredBy "machine:…" contradicts HUMAN_AUTHORED', "provenance.generationMethod");
  }
  if (machineAuthored) {
    if (lifecycleState && lifecycleState.machineReachable === false) {
      error("MACHINE-CEILING", `machine-authored content may not carry contentStatus "${record.contentStatus}"`, "contentStatus");
    }
    if (record.verification?.humanVerifiedBy) {
      error("MACHINE-CEILING", "machine-authored content may not fill verification.humanVerifiedBy", "verification.humanVerifiedBy");
    }
    if (record.reviewStatus === "approved") {
      error("MACHINE-CEILING", 'machine-authored content may not carry reviewStatus "approved"', "reviewStatus");
    }
  }
  if (record.provenance?.originBatch && record.batchId && record.provenance.originBatch !== record.batchId) {
    error("PROVENANCE", `originBatch "${record.provenance.originBatch}" disagrees with batchId "${record.batchId}"`, "provenance.originBatch");
  }

  const humanVerified = Boolean(record.verification?.humanVerifiedBy && record.verification?.humanVerifiedOn);
  if (record.evidenceBasis === "EXTERNAL_AUTHORITY") {
    const evidence = record.evidence ?? [];
    if (evidence.length === 0) {
      error("EB-EVIDENCE", "an EXTERNAL_AUTHORITY record must cite at least one source", "evidence");
    }
    for (const [index, link] of evidence.entries()) {
      if (!registries.sourceRefs.has(link.ref)) {
        error("EB-EVIDENCE", `evidence ref "${link.ref}" does not resolve in the source registry`, `evidence[${index}].ref`);
      }
      if (link.excerpt && link.excerpt.trim().split(/\s+/).length > 50) {
        error("EB-EVIDENCE", "excerpt may not exceed 50 words; cite the locator instead", `evidence[${index}].excerpt`);
      }
    }
    if (!humanVerified && record.contentStatus !== "candidate_needs_source_verification" && record.contentStatus !== "draft" && record.contentStatus !== "rejected") {
      error("EB-STATUS", `an EXTERNAL_AUTHORITY record with no human-verified source may not carry contentStatus "${record.contentStatus}"`, "contentStatus");
    }
  }
  if (record.evidenceBasis === "SELF_CONTAINED") {
    const lines = record.packet?.lines ?? [];
    if (!record.packet) {
      error("EB-PACKET", "a SELF_CONTAINED record must carry the packet its gold behaviour is derived from", "packet");
    } else {
      if (!lines.some((line) => line.decisive)) {
        error("EB-PACKET", "a SELF_CONTAINED packet must mark at least one decisive line", "packet.lines");
      }
      const refs = new Set(lines.map((line) => line.ref));
      if (refs.size !== lines.length) error("EB-PACKET", "packet line refs must be unique", "packet.lines");
      const grounded = (record.acceptanceCriteria ?? []).some((criterion) => criterion.evidenceRef && refs.has(criterion.evidenceRef));
      if (!grounded) {
        error("EB-PACKET", "at least one acceptance criterion must name a packet line, so the gold behaviour is checkable without reading a source", "acceptanceCriteria");
      }
      for (const [index, criterion] of (record.acceptanceCriteria ?? []).entries()) {
        if (criterion.evidenceRef && !refs.has(criterion.evidenceRef)) {
          error("EB-PACKET", `acceptance criterion evidenceRef "${criterion.evidenceRef}" names no packet line`, `acceptanceCriteria[${index}].evidenceRef`);
        }
      }
    }
  }

  if ((record.flags ?? []).includes("HUMAN-VERIFY-REQUIRED")) {
    if (humanVerified) error("VERIFY-FLAG", "a record still flagged HUMAN-VERIFY-REQUIRED cannot also claim verification", "verification");
    const ordinal = lifecycleState?.ordinal ?? 0;
    if (ordinal > 1) error("VERIFY-FLAG", `a record still flagged HUMAN-VERIFY-REQUIRED cannot carry contentStatus "${record.contentStatus}"`, "contentStatus");
  }
  if (record.verification?.humanVerificationRequired === false && !humanVerified) {
    warn("VERIFY-FLAG", "humanVerificationRequired is false but no verifier is recorded", "verification");
  }

  // -- coding version ------------------------------------------------------
  const isCoding = record.taskType === "CODING_SUPPORT" || (record.moduleIds ?? []).includes("M08");
  if (isCoding) {
    if (!record.codingVersion) error("CODING-VERSION", "coding content must declare codingVersion", "codingVersion");
    if (!record.encounterDate) error("CODING-VERSION", "coding content must declare encounterDate, which anchors the edition", "encounterDate");
    const edition = registries.codingEditions.get(record.codingVersion);
    if (record.codingVersion && !edition) {
      error("CODING-VERSION", `codingVersion "${record.codingVersion}" is not a registered edition`, "codingVersion");
    } else if (edition && record.encounterDate && !inWindow(record.encounterDate, edition)) {
      error("CODING-VERSION", `encounterDate ${record.encounterDate} falls outside ${edition.id} (${edition.effectiveFrom ?? "open"} .. ${edition.effectiveTo ?? "open"})`, "encounterDate");
    }
  } else if (record.codingVersion) {
    warn("CODING-VERSION", "codingVersion is set on a record that is not coding content", "codingVersion");
  }

  // -- jurisdiction and payer ---------------------------------------------
  const jurisdictions = record.jurisdictions ?? [];
  if (jurisdictions.includes("UNIVERSAL") && jurisdictions.length > 1) {
    error("JURISDICTION-EARNED", "UNIVERSAL cannot be combined with a specific jurisdiction", "jurisdictions");
  }
  if (record.payerSpecific && jurisdictions.includes("UNIVERSAL")) {
    error("PAYER-SPECIFIC", "payer-specific content cannot claim UNIVERSAL jurisdiction", "jurisdictions");
  }
  if (record.evidenceBasis === "EXTERNAL_AUTHORITY" && jurisdictions.includes("UNIVERSAL")) {
    const speaks = (record.evidence ?? []).some((link) => {
      const source = registries.sourcesByRef.get(link.ref);
      return source && ["PRIMARY_REGULATION", "OFFICIAL_GUIDANCE", "OFFICIAL_CODE_SET"].includes(source.authorityClass);
    });
    if (!speaks) warn("JURISDICTION-EARNED", "UNIVERSAL is claimed but no cited source is a regulation, official guidance or an official code set", "jurisdictions");
  }

  // -- safety and scope ----------------------------------------------------
  const safetyFlagged = (record.safetyFlags ?? []).length > 0;
  if (safetyFlagged && record.escalationRequired !== true) {
    error("SAFETY-PRECEDENCE", "a record carrying a safety flag must set escalationRequired true", "escalationRequired");
  }
  if (safetyFlagged && (record.hardFailureConditions ?? []).length === 0) {
    error("SAFETY-PRECEDENCE", "a safety-flagged record must state at least one hard-failure condition", "hardFailureConditions");
  }
  if ((record.privacyFlags ?? []).length > 0 && (record.hardFailureConditions ?? []).length === 0) {
    error("SAFETY-PRECEDENCE", "a privacy-flagged record must state at least one hard-failure condition", "hardFailureConditions");
  }
  if (record.escalationRequired === true && !record.nextActionOwner) {
    error("OWNERSHIP", "a record that requires escalation must name nextActionOwner", "nextActionOwner");
  }

  // -- choices -------------------------------------------------------------
  const taskType = registries.taskTypesById.get(record.taskType);
  const choices = record.choices ?? [];
  if (choices.length > 0) {
    if (taskType?.minChoices && choices.length < taskType.minChoices) {
      error("CHOICE-COUNT", `${record.taskType} needs at least ${taskType.minChoices} choices, has ${choices.length}`, "choices");
    }
    if (taskType?.maxChoices && choices.length > taskType.maxChoices) {
      error("CHOICE-COUNT", `${record.taskType} allows at most ${taskType.maxChoices} choices, has ${choices.length}`, "choices");
    }
    const expectedIds = choices.map((_, index) => String.fromCharCode(97 + index));
    if (choices.map((choice) => choice.id).join("") !== expectedIds.join("")) {
      error("CHOICE-COUNT", `choice ids must ascend from "a" without gaps (expected ${expectedIds.join(",")})`, "choices");
    }
    const correct = record.correctChoiceIds ?? [];
    if (correct.length === 0) error("CHOICE-COUNT", "a choice-bearing record must name at least one correct choice", "correctChoiceIds");
    for (const choiceId of correct) {
      if (!choices.some((choice) => choice.id === choiceId)) {
        error("CHOICE-COUNT", `correctChoiceIds names "${choiceId}", which is not a choice`, "correctChoiceIds");
      }
    }
    if (record.taskType === "MCQ" && correct.length !== 1) {
      error("CHOICE-COUNT", `MCQ is single best answer; ${correct.length} correct choices were named`, "correctChoiceIds");
    }
    const texts = choices.map((choice) => normalizeText(choice.text));
    if (new Set(texts).size !== texts.length) error("CHOICE-COUNT", "two choices carry the same text", "choices");
    // A distractor that restates the answer marks a correct action wrong. Exact
    // duplicate text is the easy case; the one that actually reaches a learner is
    // the near-restatement, which reads as a second right answer.
    const correctChoices = choices.filter((choice) => correct.includes(choice.id));
    for (const right of correctChoices) {
      for (const choice of choices) {
        if (correct.includes(choice.id)) continue;
        const overlap = trigramOverlap(right.text, choice.text);
        if (overlap > 0.4) {
          error("CHOICE-COLLISION", `choice "${choice.id}" is marked wrong but restates correct choice "${right.id}" (trigram overlap ${overlap.toFixed(3)}); a learner cannot distinguish them`, `choices[${choices.indexOf(choice)}].text`);
        }
      }
    }
    for (const [index, choice] of choices.entries()) {
      if (BANNED_CHOICE_TEXT.some((pattern) => pattern.test(choice.text.trim()))) {
        error("NO-ALL-OF-THE-ABOVE", `"${choice.text}" is not a choice; it is a way of avoiding one`, `choices[${index}].text`);
      }
    }
    const lengths = choices.map((choice) => choice.text.length);
    const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const longest = Math.max(...lengths);
    const longestIndex = lengths.indexOf(longest);
    if (longest > mean * 1.6 && correct.includes(choices[longestIndex].id)) {
      warn("ANSWER-LEAKAGE", `the correct choice is ${(longest / mean).toFixed(2)}x the mean choice length; length cues the answer`, "choices");
    }
    const shortest = Math.min(...lengths);
    if (shortest * 2 < mean) {
      warn("ANSWER-LEAKAGE", "one choice is less than half the mean length and reads as filler", "choices");
    }
    const stem = normalizeText(record.prompt);
    if (/\ban\s*$/.test(stem) || /\ba\s*$/.test(stem)) {
      warn("ANSWER-LEAKAGE", "the stem ends in an article, which cues choices by agreement", "prompt");
    }
  }

  // -- sequencing ----------------------------------------------------------
  if (record.steps || record.canonicalOrder) {
    const steps = record.steps ?? [];
    const order = record.canonicalOrder ?? [];
    const expected = steps.map((_, index) => index).sort((a, b) => a - b).join(",");
    if ([...order].sort((a, b) => a - b).join(",") !== expected) {
      error("WORKFLOW-ORDER", "canonicalOrder must be a permutation of the indices of steps", "canonicalOrder");
    }
  }

  // -- ownership and evaluation -------------------------------------------
  if ((record.acceptanceCriteria ?? []).length > 0) {
    const total = record.acceptanceCriteria.reduce((sum, criterion) => sum + criterion.credit, 0);
    if (Math.abs(total - 1) > 0.001) {
      error("EVALUATION", `acceptance criteria credit sums to ${total.toFixed(3)}, not 1`, "acceptanceCriteria");
    }
    const ids = record.acceptanceCriteria.map((criterion) => criterion.id);
    if (new Set(ids).size !== ids.length) error("EVALUATION", "acceptance criterion ids must be unique", "acceptanceCriteria");
  }
  if ((record.errorTargets ?? []).length > 0 && (record.remediationTargets ?? []).length === 0) {
    error("REMEDIATION", "a record that targets an error must name at least one remediation", "remediationTargets");
  }

  // -- difficulty honesty --------------------------------------------------
  const evidenceLineCount = (record.packet?.lines ?? []).length;
  if (record.difficulty === "EASY" && evidenceLineCount > 6) {
    warn("DIFFICULTY", `EASY with ${evidenceLineCount} packet lines; low dependency count is part of the band`, "difficulty");
  }
  if ((record.difficulty === "HARD" || record.difficulty === "VERY_HARD") && evidenceLineCount > 0 && evidenceLineCount < 4) {
    warn("DIFFICULTY", `${record.difficulty} with only ${evidenceLineCount} packet lines; the band expects three or more dependencies`, "difficulty");
  }
  if (record.difficulty === "REALISTIC_PREMIUM" && !(record.accessClasses ?? []).includes("PREMIUM_REALISTIC")) {
    warn("DIFFICULTY", "REALISTIC_PREMIUM content that does not carry the PREMIUM_REALISTIC access class", "accessClasses");
  }

  // -- fingerprints are what they claim -----------------------------------
  if (record.fingerprints?.promptHash && record.prompt) {
    const expected = shortHash(normalizeText(record.prompt));
    if (record.fingerprints.promptHash !== expected) {
      error("FINGERPRINT", "promptHash is not the hash of the normalized prompt", "fingerprints.promptHash");
    }
  }
  if (record.createdAt && record.updatedAt && record.updatedAt < record.createdAt) {
    error("DATES", "updatedAt precedes createdAt", "updatedAt");
  }
  if (record.effectiveFrom && record.effectiveTo && record.effectiveTo < record.effectiveFrom) {
    error("DATES", "effectiveTo precedes effectiveFrom", "effectiveTo");
  }
}

// --- corpus-wide pass ------------------------------------------------------

export function checkCorpus(records, findings) {
  const byId = new Map();
  for (const record of records) {
    if (byId.has(record.id)) {
      findings.push({ tier: "STRUCTURAL", rule: "DUP-ID", recordId: record.id, path: "id", message: `id "${record.id}" appears more than once` });
    } else {
      byId.set(record.id, record);
    }
  }

  const byPromptHash = new Map();
  for (const record of records) {
    const hash = record.fingerprints?.promptHash;
    if (!hash) continue;
    if (byPromptHash.has(hash)) {
      findings.push({ tier: "POLICY", rule: "DUP-EXACT", recordId: record.id, path: "prompt", message: `normalized prompt is identical to ${byPromptHash.get(hash)}` });
    } else {
      byPromptHash.set(hash, record.id);
    }
  }

  // lineage
  for (const record of records) {
    for (const [field, value] of [["parentId", record.parentId], ["variantOf", record.variantOf]]) {
      if (value && !byId.has(value)) {
        findings.push({ tier: "POLICY", rule: "LINEAGE", recordId: record.id, path: field, message: `${field} "${value}" does not resolve in the corpus` });
      }
    }
    let cursor = record.variantOf;
    const seen = new Set([record.id]);
    while (cursor) {
      if (seen.has(cursor)) {
        findings.push({ tier: "POLICY", rule: "LINEAGE", recordId: record.id, path: "variantOf", message: "variant lineage is cyclic" });
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.variantOf;
    }
  }

  // superficial variants
  for (const record of records) {
    const parent = record.variantOf ? byId.get(record.variantOf) : null;
    if (!parent || !record.prompt || !parent.prompt) continue;
    const overlap = trigramOverlap(record.prompt, parent.prompt);
    const layoutChanged = record.fingerprints?.evidenceLayoutFingerprint !== parent.fingerprints?.evidenceLayoutFingerprint;
    if (overlap > 0.82 && !layoutChanged) {
      findings.push({
        tier: "POLICY",
        rule: "NOV-SUPERFICIAL",
        recordId: record.id,
        path: "prompt",
        message: `trigram overlap with ${parent.id} is ${overlap.toFixed(3)} and the evidence layout is unchanged; this is a paraphrase, not a variant`
      });
    }
  }

  // near duplicates among unrelated records
  const prompts = records.filter((record) => record.prompt);
  for (let i = 0; i < prompts.length; i += 1) {
    for (let j = i + 1; j < prompts.length; j += 1) {
      const a = prompts[i];
      const b = prompts[j];
      if (a.variantOf === b.id || b.variantOf === a.id) continue;
      const overlap = trigramOverlap(a.prompt, b.prompt);
      if (overlap > 0.9) {
        findings.push({ tier: "HEURISTIC", rule: "NEAR-DUP", recordId: b.id, path: "prompt", message: `trigram overlap ${overlap.toFixed(3)} with ${a.id}, which is not its parent` });
      }
    }
  }

  // answer-position cap, per the pilot validator's own formula
  const positions = new Map();
  let choiceBearing = 0;
  for (const record of records) {
    const correct = record.correctChoiceIds ?? [];
    if ((record.choices ?? []).length === 0 || correct.length !== 1) continue;
    choiceBearing += 1;
    positions.set(correct[0], (positions.get(correct[0]) ?? 0) + 1);
  }
  if (choiceBearing > 0) {
    const cap = Math.ceil(choiceBearing / 4) + 1;
    for (const [position, count] of positions) {
      if (count > cap) {
        findings.push({ tier: "POLICY", rule: "ANSWER-POSITION", recordId: "<corpus>", path: "correctChoiceIds", message: `answer position "${position}" is used ${count} times across ${choiceBearing} choice-bearing records; the cap is ${cap}` });
      }
    }
  }

  // MCQ dominance
  if (records.length > 0) {
    const mcq = records.filter((record) => record.taskType === "MCQ").length;
    const share = mcq / records.length;
    if (share > 0.3) {
      findings.push({ tier: "POLICY", rule: "TT-DOMINANCE", recordId: "<corpus>", path: "taskType", message: `MCQ is ${(share * 100).toFixed(1)}% of ${records.length} records; the ceiling is 30%` });
    }
  }
}

// --- scorecard -------------------------------------------------------------

function tally(records, pick) {
  const counts = {};
  for (const record of records) {
    for (const key of [].concat(pick(record) ?? [])) counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

export function scorecard(records, findings, registries) {
  const errors = findings.filter((finding) => SEVERITY[finding.tier] === "ERROR");
  const warnings = findings.filter((finding) => SEVERITY[finding.tier] === "WARNING");
  const byRule = tally(findings, (finding) => finding.rule);
  const approvedStates = new Set(["approved_for_training", "approved_for_generation"]);

  return {
    total: records.length,
    byDifficulty: tally(records, (record) => record.difficulty),
    byModule: tally(records, (record) => record.moduleIds),
    byCompetency: tally(records, (record) => record.competencyIds),
    byTaskType: tally(records, (record) => record.taskType),
    byErrorTarget: tally(records, (record) => record.errorTargets),
    byRecordType: tally(records, (record) => record.recordType),
    bySource: tally(records, (record) => (record.evidence ?? []).map((link) => link.ref)),
    byEvidenceBasis: tally(records, (record) => record.evidenceBasis),
    byContentStatus: tally(records, (record) => record.contentStatus),
    byAccessClass: tally(records, (record) => record.accessClasses),
    duplicates: findings.filter((finding) => finding.rule === "DUP-EXACT" || finding.rule === "DUP-ID").length,
    nearDuplicates: findings.filter((finding) => finding.rule === "NEAR-DUP" || finding.rule === "NOV-SUPERFICIAL").length,
    schemaErrors: findings.filter((finding) => finding.tier === "STRUCTURAL").length,
    sourceVerificationFailures: findings.filter((finding) => finding.rule.startsWith("EB-") || finding.rule === "VERIFY-FLAG").length,
    safetyFlagged: records.filter((record) => (record.safetyFlags ?? []).length > 0).length,
    privacyFlagged: records.filter((record) => (record.privacyFlags ?? []).length > 0).length,
    codingVersionIssues: findings.filter((finding) => finding.rule === "CODING-VERSION").length,
    unresolvedContradictions: records.filter((record) => (record.auditTags ?? []).includes("UNRESOLVED-CONTRADICTION")).length,
    humanReviewRequired: records.filter((record) => record.verification?.humanVerificationRequired !== false).length,
    approved: records.filter((record) => approvedStates.has(record.contentStatus)).length,
    rejected: records.filter((record) => record.contentStatus === "rejected").length,
    deprecated: records.filter((record) => record.contentStatus === "deprecated" || record.contentStatus === "superseded").length,
    sourceVerified: records.filter((record) => Boolean(record.verification?.humanVerifiedBy)).length,
    errorCount: errors.length,
    warningCount: warnings.length,
    findingsByRule: byRule,
    competencyGaps: [...registries.competencyIds].filter((id) => !records.some((record) => (record.competencyIds ?? []).includes(id))),
    moduleGaps: [...registries.moduleIds].filter((id) => !records.some((record) => (record.moduleIds ?? []).includes(id))),
    taskTypeGaps: [...registries.taskTypeIds].filter((id) => !records.some((record) => record.taskType === id))
  };
}

// --- driver ----------------------------------------------------------------

export function loadRecords(batchFilter) {
  const recordsDir = path.join(CORPUS_ROOT, "records");
  if (!existsSync(recordsDir)) return { records: [], files: [] };
  const files = [];
  for (const entry of readdirSync(recordsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (batchFilter && entry.name !== batchFilter) continue;
    const dir = path.join(recordsDir, entry.name);
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".json")) files.push(path.join(dir, file));
    }
  }
  const records = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    records.push(...(Array.isArray(parsed) ? parsed : parsed.records ?? [parsed]));
  }
  return { records, files };
}

export function validate({ batch } = {}) {
  const registries = loadRegistries();
  const schema = JSON.parse(readFileSync(path.join(CORPUS_ROOT, "schema/kb-record.schema.json"), "utf8"));
  const { records, files } = loadRecords(batch);
  const findings = [];

  for (const record of records) {
    checkAgainstSchema(record, schema, "", findings, record.id ?? "<no id>");
    checkPolicy(record, registries, findings);
  }
  checkCorpus(records, findings);

  return {
    generatedOn: new Date().toISOString().slice(0, 10),
    batch: batch ?? "<all>",
    files: files.map((file) => path.relative(REPO_ROOT, file)),
    schemaId: schema.$id,
    findings: findings.map((finding) => ({ ...finding, severity: SEVERITY[finding.tier] })),
    scorecard: scorecard(records, findings, registries)
  };
}

function main(argv) {
  const batchIndex = argv.indexOf("--batch");
  const outIndex = argv.indexOf("--out");
  const report = validate({ batch: batchIndex === -1 ? undefined : argv[batchIndex + 1] });

  if (outIndex !== -1) {
    const target = path.resolve(REPO_ROOT, argv[outIndex + 1]);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const { scorecard: card } = report;
    console.log(`Knowledgebase QA — batch ${report.batch}`);
    console.log(`  records            ${card.total} across ${report.files.length} file(s)`);
    console.log(`  errors / warnings  ${card.errorCount} / ${card.warningCount}`);
    console.log(`  approved           ${card.approved}   source-verified ${card.sourceVerified}   human review required ${card.humanReviewRequired}`);
    console.log(`  duplicates         ${card.duplicates} exact, ${card.nearDuplicates} near/superficial`);
    console.log(`  by difficulty      ${JSON.stringify(card.byDifficulty)}`);
    console.log(`  by evidence basis  ${JSON.stringify(card.byEvidenceBasis)}`);
    console.log(`  competency gaps    ${card.competencyGaps.length ? card.competencyGaps.join(", ") : "none"}`);
    console.log(`  module gaps        ${card.moduleGaps.length ? card.moduleGaps.join(", ") : "none"}`);
    if (report.findings.length > 0) {
      console.log("\nFindings:");
      for (const finding of report.findings.slice(0, 60)) {
        console.log(`  [${finding.severity}] ${finding.rule} ${finding.recordId}${finding.path ? ` (${finding.path})` : ""}: ${finding.message}`);
      }
      if (report.findings.length > 60) console.log(`  … ${report.findings.length - 60} more (use --json)`);
    }
  }

  return report.scorecard.errorCount > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
