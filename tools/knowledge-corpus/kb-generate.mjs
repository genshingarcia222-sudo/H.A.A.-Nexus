// H.A.A. Nexus Knowledgebase generator.
//
// Deterministic: the same templates, operators and slot pools produce byte-identical
// records on every run, so a failed batch is rerunnable without duplicating an
// accepted record and a diff shows content changes rather than shuffling.
//
//   node tools/knowledge-corpus/kb-generate.mjs --batch KB-001
//   node tools/knowledge-corpus/kb-generate.mjs --batch KB-001 --dry-run
//
// What this tool may and may not assign:
//   * It writes MACHINE_DRAFTED provenance under machine:<agent-id>. It never
//     writes a person's name.
//   * A SELF_CONTAINED record is written at `candidate`. An EXTERNAL_AUTHORITY
//     record is written at `candidate_needs_source_verification` and flagged
//     HUMAN-VERIFY-REQUIRED, because nothing here opened a source.
//   * It never fills verification.humanVerifiedBy, never writes reviewStatus
//     approved, and never assigns the ASSESSMENT_CLOSED_BOOK access class.
//     Those are human decisions and one of them is an entitlement boundary.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { poolsForBatch, pick } from "./kb-slots.mjs";
import { OPERATORS } from "./kb-operators.mjs";
import { TEMPLATES } from "./kb-templates.mjs";
import { normalizeText, shortHash, trigramOverlap } from "./kb-validate.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CORPUS_ROOT = path.join(REPO_ROOT, "knowledge-corpus");

export const GENERATOR_VERSION = "kb-generate/1.0.0";
export const AGENT_ID = "machine:claude-code-kb-workstream";
const GENERATED_ON = "2026-09-26";

function readRegistry(name) {
  return JSON.parse(readFileSync(path.join(CORPUS_ROOT, name), "utf8"));
}

const ERRORS = readRegistry("registries/error-taxonomy.json").errors;
const ERROR_BY_ID = new Map(ERRORS.map((entry) => [entry.id, entry]));
const COMPETENCY_BY_ID = new Map(readRegistry("registries/competencies.json").competencies.map((entry) => [entry.id, entry]));
const RECORD_TOKEN = new Map(readRegistry("registries/record-types.json").recordTypes.map((entry) => [entry.id, entry.token]));
const TASK_TYPE_BY_ID = new Map(readRegistry("registries/task-types.json").taskTypes.map((entry) => [entry.id, entry]));
const CODING_EDITIONS = readRegistry("registries/coding-versions.json").editions;

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The slot context for one record. Derived from the global index and the batch's
 *  own pools, so it is reproducible and every variant inside a family gets a
 *  different persona.
 *
 *  The pools are selected per batch on purpose. `pick` is `pool[index % length]`,
 *  so appending one persona to a shared pool would silently re-cast every record
 *  already generated. Batch-scoped pools mean a later batch can grow its persona
 *  set — charter section XXV — without rewriting an earlier batch's bytes. */
export function buildContext(globalIndex, batchId = "KB-001") {
  const pools = poolsForBatch(batchId);
  const patient = pick(pools.patients, globalIndex);
  const encounterDate = pick(pools.encounterDates, globalIndex);
  return {
    patient,
    nearMatch: {
      label: patient.label,
      mrn: `${patient.mrn.slice(0, -1)}${(Number(patient.mrn.slice(-1)) + 1) % 10}`,
      dob: `${patient.dob.slice(0, 8)}${String(((Number(patient.dob.slice(8)) + 7) % 28) + 1).padStart(2, "0")}`
    },
    provider: pick(pools.providers, globalIndex),
    staff: pick(pools.staff, globalIndex),
    practice: pick(pools.practices, globalIndex),
    payer: pick(pools.payers, globalIndex),
    channel: pick(pools.channels, globalIndex),
    encounterDate,
    expiryDate: addDays(encounterDate, 21),
    scheduledDate: addDays(encounterDate, 28)
  };
}

/** Deterministic shuffle, so a sequencing task is presented out of order and the
 *  canonical order is the only place the true sequence is stored. */
function shuffleDeterministic(items, seed) {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function resolveBase(template, ctx) {
  const resolve = (value) => (typeof value === "function" ? value(ctx) : value);
  return {
    ...template,
    ask: resolve(template.ask),
    lines: resolve(template.lines),
    gold: resolve(template.gold),
    acceptance: resolve(template.acceptance),
    steps: resolve(template.steps),
    answer: {
      correct: resolve(template.answer.correct),
      wrong: resolve(template.answer.wrong),
      secondCorrect: resolve(template.secondCorrect)
    },
    missingFact: resolve(template.missingFact),
    contradiction: resolve(template.contradiction),
    redFlag: resolve(template.redFlag),
    prerequisite: resolve(template.prerequisite),
    consequence: resolve(template.consequence)
  };
}

function normalizeCredits(criteria) {
  const count = criteria.length;
  const share = Math.round((100 / count)) / 100;
  return criteria.map((criterion, index) => ({
    id: `AC${index + 1}`,
    requirement: criterion.requirement,
    credit: index === 0 ? Number((1 - share * (count - 1)).toFixed(2)) : share,
    ...(criterion.evidenceRef ? { evidenceRef: criterion.evidenceRef } : {})
  }));
}

function remediationsFor(errorTargets) {
  const out = [];
  for (const target of errorTargets) {
    const entry = ERROR_BY_ID.get(target);
    if (entry && !out.includes(entry.remediationRef)) out.push(entry.remediationRef);
  }
  return out;
}

function hardFailuresFor(errorTargets, patch, ctx) {
  const out = [];
  for (const target of errorTargets) {
    const entry = ERROR_BY_ID.get(target);
    if (entry?.severity === "HARD_FAILURE") {
      out.push(`Any response that commits ${entry.title.toLowerCase()} fails outright, whatever else it gets right.`);
    }
  }
  if (patch.safety) {
    out.push(`Completing the administrative task before the volunteered statement reaches a named clinician fails outright.`);
    out.push(`Offering any assessment, threshold or reassurance about the symptom fails outright: it is outside the role's authorised scope.`);
  }
  if (patch.privacy) {
    out.push(`Any disclosure or transmission made before identity and authority are established fails outright, because it cannot be recalled.`);
  }
  return [...new Set(out)];
}

function composeRationale(template, operator, patch, ctx) {
  const competencyTitles = template.competencies.map((id) => COMPETENCY_BY_ID.get(id)?.title ?? id).join("; ");
  const basis =
    template.evidenceBasis === "SELF_CONTAINED"
      ? `The gold behaviour is settled by the packet carried in this record — nothing outside it is asserted — which is why the acceptance criteria point at packet lines rather than at an external rule.`
      : `The gold behaviour asserts something about the world, so this record cites the source registry and is held at candidate_needs_source_verification. No source was opened when it was written, and the cited locators are unverified.`;
  const mutation =
    operator.id === "BASE"
      ? `This is the family's unmutated case: ${operator.label}.`
      : `This variant applies ${operator.id} — ${operator.label} — so the response that is correct in the family's unmutated case is a trap here. That is the point of the family: the wording barely moves and the defensible action does.`;
  return `${mutation} Competency targeted: ${competencyTitles}. ${basis} The distractors are not filler: each one is a way a competent-sounding responder actually goes wrong on this material, and each carries its own explanation.`;
}

function accessClassesFor(template, patch) {
  const classes = ["TRAINING", "PRACTICE"];
  if (template.recordType === "SCENARIO" || patch.premium || template.packetKind === "CALL_TRANSCRIPT") classes.push("SIMULATION");
  if (patch.premium) classes.push("PREMIUM_REALISTIC");
  classes.push("INSTRUCTOR_ADMIN");
  return [...new Set(classes)];
}

function codingEditionFor(encounterDate) {
  for (const edition of CODING_EDITIONS) {
    const afterStart = !edition.effectiveFrom || encounterDate >= edition.effectiveFrom;
    const beforeEnd = !edition.effectiveTo || encounterDate <= edition.effectiveTo;
    if (afterStart && beforeEnd) return edition;
  }
  return null;
}

/** A distractor must be wrong, and it must be visibly a different action from the
 *  answer. Some mutations land on the behaviour the family's base case already
 *  asked for — surfacing a conflict, naming a gap — and there the base answer is
 *  not a trap at all; carrying it in as one would mark a correct action wrong.
 *  Anything that close to the answer is dropped rather than relabelled. */
const RESTATEMENT_THRESHOLD = 0.4;

function buildChoices(base, patch, operator, rotation, multi) {
  const asWrong = (entry, why, trapType) => ({ text: entry.text, why, ...(trapType ? { trapType } : {}) });
  const correctOptions = [{ ...patch.correct, correct: true }];
  if (multi && base.answer.secondCorrect) correctOptions.push({ ...base.answer.secondCorrect, correct: true });

  const candidates = [...(patch.extraWrong ?? [])];
  if (patch.replacesBaseAnswer) {
    candidates.push(
      asWrong(
        base.answer.correct,
        `Correct in this family's unmutated case and wrong here: ${operator.label}, which changes what a defensible response has to do. Recognising that is the whole test.`,
        "TRAP_COMPLETE_THE_TASK_ANYWAY"
      )
    );
  }
  candidates.push(...base.answer.wrong);

  const target = multi ? 5 : 4;
  const seen = new Set(correctOptions.map((option) => normalizeText(option.text)));
  const distractors = [];
  for (const candidate of candidates) {
    if (correctOptions.length + distractors.length >= target) break;
    const normalized = normalizeText(candidate.text);
    if (seen.has(normalized)) continue;
    if (correctOptions.some((option) => trigramOverlap(option.text, candidate.text) > RESTATEMENT_THRESHOLD)) continue;
    seen.add(normalized);
    distractors.push({ ...candidate, correct: false });
  }

  let ordered = [...correctOptions, ...distractors];
  if (!multi) {
    // Spread the answer position deterministically so no position dominates.
    const correctIndex = ordered.findIndex((option) => option.correct);
    const targetIndex = rotation % ordered.length;
    ordered = [...ordered];
    [ordered[correctIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[correctIndex]];
  }

  const choices = ordered.map((option, index) => ({
    id: String.fromCharCode(97 + index),
    text: option.text,
    why: option.why,
    ...(option.trapType ? { trapType: option.trapType } : {})
  }));
  const correctChoiceIds = ordered.map((option, index) => (option.correct ? String.fromCharCode(97 + index) : null)).filter(Boolean);
  return { choices, correctChoiceIds };
}

/** The batch token embedded in an id: KB-001 -> KB001. */
export function batchToken(batchId) {
  return batchId.replace("-", "");
}

/** A template belongs to exactly one batch, and says so in its own batch-stamped
 *  templateId. Selecting on that is what stops a later batch from re-emitting an
 *  earlier batch's content under fresh ids: before this existed, `--batch KB-002`
 *  walked every template and produced 324 records byte-identical to KB-001. A
 *  per-batch QA run would not have caught it, because duplicate detection is
 *  corpus-wide. */
export function templatesForBatch(batchId) {
  const token = batchToken(batchId);
  return TEMPLATES.filter((template) => template.templateId.includes(`-${token}-`));
}

/** The operators a family is built with. A template may narrow the set — KB-002
 *  leans on BASE/LATE_CLUE/BURIED_CLUE because those are the operators that do
 *  not raise the difficulty band, and the corpus needs EASY and MODERATE mass.
 *  Omitting the field keeps every operator, which is what KB-001's families do. */
function operatorsForTemplate(template) {
  if (!template.operatorIds) return OPERATORS;
  const selected = template.operatorIds.map((id) => {
    const operator = OPERATORS.find((candidate) => candidate.id === id);
    if (!operator) throw new Error(`${template.templateId}: unknown operator "${id}"`);
    return operator;
  });
  if (selected.length === 0) throw new Error(`${template.templateId}: operatorIds is empty`);
  if (selected[0].id !== "BASE") throw new Error(`${template.templateId}: operatorIds must start with BASE`);
  return selected;
}

export function generateBatch(batchId = "KB-001") {
  const records = [];
  let rotation = 0;
  let sequence = 0;

  const templates = templatesForBatch(batchId);
  if (templates.length === 0) throw new Error(`no templates declared for batch ${batchId}`);

  templates.forEach((template) => {
    // Sequence numbers run cumulatively through the batch, so a family that uses
    // a narrowed operator set does not leave a gap in the id space.
    const familyBaseId = `KB-${RECORD_TOKEN.get(template.recordType)}-${batchToken(batchId)}-${String(sequence + 1).padStart(6, "0")}`;

    operatorsForTemplate(template).forEach((operator) => {
      const globalIndex = sequence;
      const ctx = buildContext(globalIndex, batchId);
      const base = resolveBase(template, ctx);
      const patch = operator.apply(base, ctx);
      sequence += 1;

      // A family whose own base packet carries a red flag or a disclosure risk —
      // rather than acquiring one from the SAFETY_CLUE or WRONG_RECIPIENT operator
      // — declares it on the template. Without this, the only way to reach the
      // safety and privacy competencies was through operators that force the band
      // to HARD, which is precisely why KB-001 has no EASY safety content. The
      // flags carry the same weight either way: escalationRequired, the hard
      // failure conditions and SAFETY-PRECEDENCE all apply.
      if (template.safetyBaseline) patch.safety = true;
      if (template.privacyBaseline) patch.privacy = true;

      const token = RECORD_TOKEN.get(template.recordType);
      const id = `KB-${token}-${batchToken(batchId)}-${String(sequence).padStart(6, "0")}`;
      const isBase = operator.id === "BASE";

      const errorTargets = [...new Set(patch.errorTargets)].filter((target) => ERROR_BY_ID.has(target));
      const trapTypes = [...new Set(patch.trapTypes)];
      const acceptance = normalizeCredits(patch.acceptance);
      const taskType = TASK_TYPE_BY_ID.get(template.taskType);
      const multi = template.taskType === "MULTI_SELECT";

      let choices;
      let correctChoiceIds;
      if (taskType?.presentsChoices) {
        const built = buildChoices(base, patch, operator, rotation, multi);
        choices = built.choices;
        correctChoiceIds = built.correctChoiceIds;
        if (!multi) rotation += 1;
      }

      const packetLines = patch.lines.map((line) => ({
        ref: line.ref,
        text: line.text,
        ...(line.section ? { section: line.section } : {}),
        ...(line.recordedBy ? { recordedBy: line.recordedBy } : {}),
        ...(line.recordedOn ? { recordedOn: line.recordedOn } : {}),
        decisive: Boolean(line.decisive)
      }));

      const escalationRequired =
        Boolean(patch.safety) || ["CONTRADICTION", "IDENTITY_NEAR_MATCH", "WRONG_RECIPIENT", "STALE_PREREQUISITE", "MULTI_STAGE"].includes(operator.id);
      const safetyFlags = patch.safety ? ["VOLUNTEERED-RED-FLAG", "ESCALATION-BEFORE-ADMIN"] : [];
      const privacyFlags = patch.privacy ? ["DISCLOSURE-RISK", "IDENTITY-OR-AUTHORITY-UNESTABLISHED"] : [];
      const edition = template.coding ? codingEditionFor(ctx.encounterDate) : null;

      const steps = base.steps ? shuffleDeterministic(base.steps, globalIndex + 1) : null;
      const canonicalOrder = steps ? base.steps.map((step) => steps.indexOf(step)) : null;

      const record = {
        id,
        recordType: template.recordType,
        revision: 1,
        batchId,
        moduleIds: template.modules,
        competencyIds: template.competencies,
        sourceCompetencyIds: template.competencies.map((competencyId) => COMPETENCY_BY_ID.get(competencyId).sourceCompetencyId),
        difficulty: patch.difficulty,
        taskType: template.taskType,
        scenarioType: isBase ? template.scenarioType : `${template.scenarioType}__${operator.id}`,
        evidenceBasis: template.evidenceBasis,
        domain: template.domain,
        jurisdictions: template.evidenceBasis === "EXTERNAL_AUTHORITY" || template.payerSpecific ? ["US"] : ["UNIVERSAL"],
        accessClasses: accessClassesFor(template, patch),
        effectiveFrom: edition?.effectiveFrom ?? null,
        effectiveTo: edition?.effectiveTo ?? null,
        contentStatus: template.evidenceBasis === "EXTERNAL_AUTHORITY" ? "candidate_needs_source_verification" : "candidate",
        reviewStatus: "pending",
        flags: template.evidenceBasis === "EXTERNAL_AUTHORITY" ? ["HUMAN-VERIFY-REQUIRED"] : ["HUMAN-CONTENT-REVIEW-REQUIRED"],
        verification: {
          humanVerificationRequired: true,
          humanVerifiedBy: null,
          humanVerifiedOn: null,
          locatorConfidence: "NONE"
        },
        provenance: {
          generationMethod: "MACHINE_DRAFTED",
          authoredBy: AGENT_ID,
          authoredOn: GENERATED_ON,
          originBatch: batchId,
          derivedFrom: [template.templateId],
          generatorVersion: GENERATOR_VERSION,
          generatorSeed: `${template.templateId}#${operator.id}`
        },
        ...(template.evidence ? { evidence: template.evidence } : {}),
        packet: {
          synthetic: true,
          kind: template.packetKind,
          lines: packetLines,
          patientLabel: ctx.patient.label,
          encounterLabel: `${ctx.practice} — ${ctx.channel}`,
          encounterDate: ctx.encounterDate
        },
        prompt: patch.prompt,
        ...(choices ? { choices, correctChoiceIds } : {}),
        ...(steps ? { steps, canonicalOrder } : {}),
        goldBehavior: patch.gold,
        ...(taskType?.presentsChoices
          ? {}
          : { expectedOutput: `A written response that satisfies every acceptance criterion below, cites the packet lines it rests on, and states what the record does not establish.` }),
        acceptanceCriteria: acceptance,
        hardFailureConditions: hardFailuresFor(errorTargets, patch, ctx),
        rationale: composeRationale(template, operator, patch, ctx),
        parentId: isBase ? null : familyBaseId,
        variantOf: isBase ? null : familyBaseId,
        templateId: template.templateId,
        mutationTypes: operator.mutationTypes,
        variantLineage: isBase ? [] : [familyBaseId],
        errorTargets,
        remediationTargets: remediationsFor(errorTargets),
        trapTypes,
        safetyFlags,
        privacyFlags,
        codingVersion: edition?.id ?? null,
        encounterDate: template.coding ? ctx.encounterDate : null,
        payerSpecific: Boolean(template.payerSpecific),
        clinicianJudgmentRequired:
          Boolean(patch.safety) || template.competencies.includes("KB-D03") || errorTargets.includes("KB-ERR-SCOPE-VIOLATION"),
        escalationRequired,
        ownerRole: template.ownerRole,
        nextActionOwner: escalationRequired ? ctx.provider.label : ctx.staff.label,
        auditTags: [...new Set([...(patch.auditTags ?? []), ...(template.payerSpecific ? ["SYNTHETIC-GIVEN-POLICY"] : [])])],
        fingerprints: {
          promptHash: shortHash(normalizeText(patch.prompt)),
          scenarioFingerprint: shortHash(`${template.templateId}|${ctx.patient.mrn}|${ctx.encounterDate}|${template.packetKind}`),
          competencyFingerprint: shortHash(`${[...template.competencies].sort().join(",")}|${template.taskType}|${patch.difficulty}`),
          evidenceLayoutFingerprint: shortHash(packetLines.map((line) => `${line.ref}:${line.section ?? ""}:${line.decisive ? 1 : 0}`).join("|")),
          answerPatternFingerprint: shortHash(`${normalizeText(patch.gold)}|${(correctChoiceIds ?? []).join("")}`)
        },
        createdAt: GENERATED_ON,
        updatedAt: GENERATED_ON
      };

      records.push(record);
    });
  });

  return records;
}

function main(argv) {
  const batchIndex = argv.indexOf("--batch");
  const batchId = batchIndex === -1 ? "KB-001" : argv[batchIndex + 1];
  const records = generateBatch(batchId);

  const byTemplate = new Map();
  for (const record of records) {
    if (!byTemplate.has(record.templateId)) byTemplate.set(record.templateId, []);
    byTemplate.get(record.templateId).push(record);
  }

  // Report the operators actually used, not the size of the registry: a batch whose
  // families narrow the operator set would otherwise print a number it never used.
  const operatorsUsed = new Set(records.flatMap((record) => (record.variantOf ? record.scenarioType.split("__").slice(1) : ["BASE"])));
  console.log(`${GENERATOR_VERSION} — batch ${batchId}`);
  console.log(`  templates ${byTemplate.size}, operators used ${operatorsUsed.size}/${OPERATORS.length}, records ${records.length}`);

  if (argv.includes("--dry-run")) return 0;

  const outDir = path.join(CORPUS_ROOT, "records", batchId);
  mkdirSync(outDir, { recursive: true });
  let fileIndex = 0;
  for (const [templateId, group] of byTemplate) {
    fileIndex += 1;
    const file = path.join(outDir, `${String(fileIndex).padStart(2, "0")}-${templateId.toLowerCase()}.json`);
    writeFileSync(file, `${JSON.stringify({ batchId, templateId, generatorVersion: GENERATOR_VERSION, records: group }, null, 2)}\n`);
  }
  console.log(`  wrote ${fileIndex} file(s) to ${path.relative(REPO_ROOT, outDir)}`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
