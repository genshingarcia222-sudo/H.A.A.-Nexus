// Tests for the Knowledgebase QA facility.
//
// The validator is the only thing standing between machine-drafted healthcare
// training content and a claim that it has been checked, so the rules that
// enforce that boundary are tested by name: if one is removed, a test fails with
// the rule's own id rather than the corpus quietly passing.
//
// Plain Node with node:assert, dependency-free, matching the other tools:
//   node tools/knowledge-corpus/kb-validate.test.mjs
import assert from "node:assert/strict";
import { checkAgainstSchema, checkCorpus, checkPolicy, loadRegistries, normalizeText, shortHash, trigramOverlap, validate } from "./kb-validate.mjs";
import { generateBatch } from "./kb-generate.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA = JSON.parse(readFileSync(path.join(REPO_ROOT, "knowledge-corpus/schema/kb-record.schema.json"), "utf8"));
const REGISTRIES = loadRegistries();

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  PASS  " + name);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log("  FAIL  " + name + " - " + error.message);
  }
}

/** A minimal record that passes, so each test can break exactly one thing. */
function validRecord(overrides = {}) {
  const prompt = overrides.prompt ?? "A baseline prompt for the fixture record.";
  const base = {
    id: "KB-QUES-KB999-000001",
    recordType: "QUESTION",
    revision: 1,
    batchId: "KB-999",
    moduleIds: ["M04"],
    competencyIds: ["KB-D05"],
    sourceCompetencyIds: ["D05"],
    difficulty: "MODERATE",
    taskType: "SHORT_ANSWER",
    scenarioType: "FIXTURE",
    evidenceBasis: "SELF_CONTAINED",
    domain: "Fixture",
    jurisdictions: ["UNIVERSAL"],
    accessClasses: ["TRAINING"],
    effectiveFrom: null,
    effectiveTo: null,
    contentStatus: "candidate",
    reviewStatus: "pending",
    flags: [],
    verification: { humanVerificationRequired: true, humanVerifiedBy: null, humanVerifiedOn: null },
    provenance: {
      generationMethod: "MACHINE_DRAFTED",
      authoredBy: "machine:test",
      authoredOn: "2026-09-26",
      originBatch: "KB-999",
      derivedFrom: []
    },
    packet: {
      synthetic: true,
      kind: "CHART_EXCERPT",
      lines: [
        { ref: "L1", text: "A routine entry.", decisive: false },
        { ref: "L2", text: "The entry the task turns on.", decisive: true }
      ]
    },
    prompt,
    goldBehavior: "Do the defensible thing.",
    acceptanceCriteria: [{ id: "AC1", requirement: "Cites the decisive entry.", credit: 1, evidenceRef: "L2" }],
    hardFailureConditions: [],
    rationale: "Because the packet settles it.",
    parentId: null,
    variantOf: null,
    templateId: null,
    mutationTypes: [],
    variantLineage: [],
    errorTargets: [],
    remediationTargets: [],
    trapTypes: [],
    safetyFlags: [],
    privacyFlags: [],
    codingVersion: null,
    encounterDate: null,
    payerSpecific: false,
    clinicianJudgmentRequired: false,
    escalationRequired: false,
    ownerRole: "fixture",
    nextActionOwner: null,
    auditTags: [],
    fingerprints: {
      promptHash: shortHash(normalizeText(prompt)),
      scenarioFingerprint: "0".repeat(16),
      competencyFingerprint: "0".repeat(16),
      evidenceLayoutFingerprint: "0".repeat(16),
      answerPatternFingerprint: "0".repeat(16)
    },
    createdAt: "2026-09-26",
    updatedAt: "2026-09-26"
  };
  return { ...base, ...overrides };
}

function findingsFor(record) {
  const findings = [];
  checkAgainstSchema(record, SCHEMA, "", findings, record.id);
  checkPolicy(record, REGISTRIES, findings);
  return findings;
}

function rules(record) {
  return findingsFor(record).map((finding) => finding.rule);
}

console.log("knowledgebase QA tests\n");
console.log("fixture");

test("the baseline fixture passes every rule", () => {
  assert.deepEqual(findingsFor(validRecord()), []);
});

console.log("\nschema pass");

test("an unrecognised property is a named error, never silently dropped", () => {
  const findings = findingsFor(validRecord({ somethingNew: 1 }));
  assert.ok(findings.some((f) => f.rule === "CLOSED_OBJECT" && f.message.includes("somethingNew")));
});

test("a missing required property is reported by name", () => {
  const record = validRecord();
  delete record.goldBehavior;
  assert.ok(findingsFor(record).some((f) => f.rule === "REQUIRED" && f.message.includes("goldBehavior")));
});

test("packet.synthetic is a required literal true", () => {
  const record = validRecord();
  record.packet = { ...record.packet, synthetic: false };
  assert.ok(findingsFor(record).some((f) => f.path === "packet.synthetic"));
});

test("an id that does not match the minting pattern is rejected", () => {
  assert.ok(rules(validRecord({ id: "KB-1" })).includes("PATTERN"));
});

console.log("\nthe machine ceiling");

test("MACHINE-CEILING blocks a machine-authored record from a human-only state", () => {
  assert.ok(rules(validRecord({ contentStatus: "source_verified" })).includes("MACHINE-CEILING"));
});

test("MACHINE-CEILING blocks a machine filling humanVerifiedBy", () => {
  const record = validRecord({ verification: { humanVerificationRequired: false, humanVerifiedBy: "A Person", humanVerifiedOn: "2026-09-26" } });
  assert.ok(rules(record).includes("MACHINE-CEILING"));
});

test("MACHINE-CEILING blocks a machine writing reviewStatus approved", () => {
  assert.ok(rules(validRecord({ reviewStatus: "approved" })).includes("MACHINE-CEILING"));
});

test("MACHINE-PROVENANCE rejects MACHINE_DRAFTED under a person's name", () => {
  const record = validRecord();
  record.provenance = { ...record.provenance, authoredBy: "A Person" };
  assert.ok(rules(record).includes("MACHINE-PROVENANCE"));
});

test("MACHINE-PROVENANCE rejects HUMAN_AUTHORED under a machine id", () => {
  const record = validRecord();
  record.provenance = { ...record.provenance, generationMethod: "HUMAN_AUTHORED" };
  assert.ok(rules(record).includes("MACHINE-PROVENANCE"));
});

console.log("\nevidence basis");

test("EB-EVIDENCE requires a citation on external-authority content", () => {
  assert.ok(rules(validRecord({ evidenceBasis: "EXTERNAL_AUTHORITY", contentStatus: "candidate_needs_source_verification" })).includes("EB-EVIDENCE"));
});

test("EB-EVIDENCE rejects a citation that does not resolve in the source registry", () => {
  const record = validRecord({
    evidenceBasis: "EXTERNAL_AUTHORITY",
    contentStatus: "candidate_needs_source_verification",
    evidence: [{ ref: "NOT-A-REAL-SOURCE", locator: "somewhere", supports: "ANSWER" }]
  });
  assert.ok(findingsFor(record).some((f) => f.rule === "EB-EVIDENCE" && f.message.includes("does not resolve")));
});

test("EB-STATUS holds unverified external-authority content at candidate_needs_source_verification", () => {
  const record = validRecord({
    evidenceBasis: "EXTERNAL_AUTHORITY",
    contentStatus: "candidate",
    evidence: [{ ref: "HHS-PR-SUMMARY", locator: "Summary", supports: "ANSWER" }]
  });
  assert.ok(rules(record).includes("EB-STATUS"));
});

test("EB-PACKET requires a decisive line on self-contained content", () => {
  const record = validRecord();
  record.packet = { ...record.packet, lines: record.packet.lines.map((line) => ({ ...line, decisive: false })) };
  assert.ok(rules(record).includes("EB-PACKET"));
});

test("EB-PACKET requires an acceptance criterion anchored to a packet line", () => {
  const record = validRecord({ acceptanceCriteria: [{ id: "AC1", requirement: "Something ungrounded.", credit: 1 }] });
  assert.ok(rules(record).includes("EB-PACKET"));
});

test("EB-PACKET rejects duplicate packet line refs", () => {
  const record = validRecord();
  record.packet = { ...record.packet, lines: [record.packet.lines[1], record.packet.lines[1]] };
  assert.ok(findingsFor(record).some((f) => f.rule === "EB-PACKET" && f.message.includes("unique")));
});

console.log("\nsafety, privacy and scope");

test("SAFETY-PRECEDENCE requires escalation on a safety-flagged record", () => {
  const record = validRecord({ safetyFlags: ["RED-FLAG"], hardFailureConditions: ["Fails."] });
  assert.ok(rules(record).includes("SAFETY-PRECEDENCE"));
});

test("SAFETY-PRECEDENCE requires a hard-failure condition on a safety-flagged record", () => {
  const record = validRecord({ safetyFlags: ["RED-FLAG"], escalationRequired: true, nextActionOwner: "Dr Fixture" });
  assert.ok(rules(record).includes("SAFETY-PRECEDENCE"));
});

test("SAFETY-PRECEDENCE requires a hard-failure condition on a privacy-flagged record", () => {
  assert.ok(rules(validRecord({ privacyFlags: ["DISCLOSURE-RISK"] })).includes("SAFETY-PRECEDENCE"));
});

test("OWNERSHIP requires a next-action owner wherever escalation is required", () => {
  assert.ok(rules(validRecord({ escalationRequired: true })).includes("OWNERSHIP"));
});

console.log("\ncoding version");

test("CODING-VERSION requires an edition and an encounter date on coding content", () => {
  const found = rules(validRecord({ taskType: "CODING_SUPPORT", evidenceBasis: "EXTERNAL_AUTHORITY", contentStatus: "candidate_needs_source_verification", evidence: [{ ref: "CDC-ICD10CM", locator: "index", supports: "ANSWER" }] }));
  assert.ok(found.includes("CODING-VERSION"));
});

test("CODING-VERSION rejects an encounter date outside its declared edition window", () => {
  const record = validRecord({
    taskType: "CODING_SUPPORT",
    evidenceBasis: "EXTERNAL_AUTHORITY",
    contentStatus: "candidate_needs_source_verification",
    evidence: [{ ref: "CDC-ICD10CM", locator: "index", supports: "ANSWER" }],
    codingVersion: "ICD-10-CM-FY2026",
    encounterDate: "2027-01-05"
  });
  assert.ok(findingsFor(record).some((f) => f.rule === "CODING-VERSION" && f.message.includes("outside")));
});

console.log("\nreference integrity");

test("REF-INTEGRITY rejects an unregistered module, competency and error target", () => {
  const found = rules(validRecord({ moduleIds: ["M99"], competencyIds: ["KB-D99"], sourceCompetencyIds: ["D99"], errorTargets: ["KB-ERR-INVENTED"], remediationTargets: ["KB-REM-EVIDENCE-DISCIPLINE"] }));
  assert.equal(found.filter((rule) => rule === "REF-INTEGRITY").length, 3);
});

test("COMPETENCY-PAIRING rejects axes that do not correspond entry by entry", () => {
  assert.ok(rules(validRecord({ competencyIds: ["KB-D05"], sourceCompetencyIds: ["D04"] })).includes("COMPETENCY-PAIRING"));
});

test("REMEDIATION requires a remediation wherever an error is targeted", () => {
  assert.ok(rules(validRecord({ errorTargets: ["KB-ERR-OMISSION"] })).includes("REMEDIATION"));
});

test("JURISDICTION-EARNED rejects UNIVERSAL combined with a specific jurisdiction", () => {
  assert.ok(rules(validRecord({ jurisdictions: ["UNIVERSAL", "US"] })).includes("JURISDICTION-EARNED"));
});

test("PAYER-SPECIFIC rejects payer-specific content claiming UNIVERSAL", () => {
  assert.ok(rules(validRecord({ payerSpecific: true })).includes("PAYER-SPECIFIC"));
});

console.log("\nchoices");

function choiceRecord(choices, correctChoiceIds, overrides = {}) {
  return validRecord({ taskType: "MCQ", choices, correctChoiceIds, ...overrides });
}

test("CHOICE-COLLISION catches a distractor that restates the correct answer", () => {
  const record = choiceRecord(
    [
      { id: "a", text: "Hold the transmission and confirm the authorised destination against the chart.", why: "Correct." },
      { id: "b", text: "Hold the transmission, confirming the authorised destination against the chart.", why: "Wrong." },
      { id: "c", text: "Send it to whichever address the requester supplied.", why: "Wrong." },
      { id: "d", text: "Discard the request without replying to anyone.", why: "Wrong." }
    ],
    ["a"]
  );
  assert.ok(rules(record).includes("CHOICE-COLLISION"));
});

test("NO-ALL-OF-THE-ABOVE rejects an all-of-the-above option", () => {
  const record = choiceRecord(
    [
      { id: "a", text: "Confirm two identifiers first.", why: "Correct." },
      { id: "b", text: "Proceed on the name alone.", why: "Wrong." },
      { id: "c", text: "Ask a colleague to decide.", why: "Wrong." },
      { id: "d", text: "All of the above", why: "Wrong." }
    ],
    ["a"]
  );
  assert.ok(rules(record).includes("NO-ALL-OF-THE-ABOVE"));
});

test("CHOICE-COUNT rejects ids that do not ascend from a, and a correct id that is not a choice", () => {
  const record = choiceRecord(
    [
      { id: "a", text: "One.", why: "Correct." },
      { id: "c", text: "Two.", why: "Wrong." },
      { id: "d", text: "Three.", why: "Wrong." }
    ],
    ["b"]
  );
  const found = rules(record);
  assert.ok(found.filter((rule) => rule === "CHOICE-COUNT").length >= 2);
});

test("CHOICE-COUNT rejects MCQ with more than one correct answer", () => {
  const record = choiceRecord(
    [
      { id: "a", text: "One.", why: "Correct." },
      { id: "b", text: "Two.", why: "Also correct." },
      { id: "c", text: "Three.", why: "Wrong." },
      { id: "d", text: "Four.", why: "Wrong." }
    ],
    ["a", "b"]
  );
  assert.ok(findingsFor(record).some((f) => f.rule === "CHOICE-COUNT" && f.message.includes("single best answer")));
});

console.log("\nevaluation and workflow");

test("EVALUATION rejects acceptance credit that does not sum to 1", () => {
  const record = validRecord({
    acceptanceCriteria: [
      { id: "AC1", requirement: "One.", credit: 0.3, evidenceRef: "L2" },
      { id: "AC2", requirement: "Two.", credit: 0.3 }
    ]
  });
  assert.ok(rules(record).includes("EVALUATION"));
});

test("WORKFLOW-ORDER requires canonicalOrder to be a permutation of steps", () => {
  const record = validRecord({ taskType: "SEQUENCING", steps: ["a", "b", "c"], canonicalOrder: [0, 1, 1] });
  assert.ok(rules(record).includes("WORKFLOW-ORDER"));
});

test("FINGERPRINT rejects a promptHash that is not the hash of the normalized prompt", () => {
  const record = validRecord();
  record.fingerprints = { ...record.fingerprints, promptHash: "f".repeat(16) };
  assert.ok(rules(record).includes("FINGERPRINT"));
});

console.log("\ncorpus-wide rules");

test("DUP-ID and DUP-EXACT catch a repeated id and a repeated normalized prompt", () => {
  const findings = [];
  checkCorpus([validRecord(), validRecord()], findings);
  const found = findings.map((finding) => finding.rule);
  assert.ok(found.includes("DUP-ID"));
  assert.ok(found.includes("DUP-EXACT"));
});

test("LINEAGE rejects a variantOf that does not resolve", () => {
  const findings = [];
  checkCorpus([validRecord({ variantOf: "KB-QUES-KB999-999999" })], findings);
  assert.ok(findings.some((finding) => finding.rule === "LINEAGE"));
});

test("NOV-SUPERFICIAL rejects a reworded variant whose evidence layout is unchanged", () => {
  const parent = validRecord({ id: "KB-QUES-KB999-000001", prompt: "Reconcile the allergy information before the referral goes out." });
  const child = validRecord({
    id: "KB-QUES-KB999-000002",
    prompt: "Reconcile the allergy information before the referral goes out today.",
    variantOf: parent.id
  });
  const findings = [];
  checkCorpus([parent, child], findings);
  assert.ok(findings.some((finding) => finding.rule === "NOV-SUPERFICIAL"));
});

test("TT-DOMINANCE rejects a batch that is more than 30% MCQ", () => {
  const records = [0, 1, 2].map((index) =>
    validRecord({ id: `KB-QUES-KB999-00000${index + 1}`, prompt: `Prompt number ${index}.`, taskType: "MCQ" })
  );
  const findings = [];
  checkCorpus(records, findings);
  assert.ok(findings.some((finding) => finding.rule === "TT-DOMINANCE"));
});

test("ANSWER-POSITION enforces the per-file cap", () => {
  const records = Array.from({ length: 12 }, (_, index) =>
    validRecord({
      id: `KB-QUES-KB999-${String(index + 1).padStart(6, "0")}`,
      prompt: `Distinct prompt ${index}.`,
      taskType: "SHORT_ANSWER",
      choices: [
        { id: "a", text: "One.", why: "Correct." },
        { id: "b", text: "Two.", why: "Wrong." },
        { id: "c", text: "Three.", why: "Wrong." }
      ],
      correctChoiceIds: ["a"]
    })
  );
  const findings = [];
  checkCorpus(records, findings);
  assert.ok(findings.some((finding) => finding.rule === "ANSWER-POSITION"));
});

console.log("\ntext helpers");

test("trigramOverlap is 1 for identical text and low for unrelated text", () => {
  assert.equal(trigramOverlap("the same sentence", "the same sentence"), 1);
  assert.ok(trigramOverlap("confirm two identifiers", "route the imaging order") < 0.3);
});

console.log("\nthe generator against its own contract");

test("generation is deterministic: two runs produce identical records", () => {
  assert.equal(JSON.stringify(generateBatch("KB-001")), JSON.stringify(generateBatch("KB-001")));
});

test("no generated record reaches a state a machine may not assign", () => {
  const reachable = new Set([...REGISTRIES.lifecycleById.entries()].filter(([, state]) => state.machineReachable !== false).map(([id]) => id));
  for (const record of generateBatch("KB-001")) {
    assert.ok(reachable.has(record.contentStatus), `${record.id} carries ${record.contentStatus}`);
    assert.equal(record.verification.humanVerifiedBy, null, `${record.id} claims a human verifier`);
    assert.notEqual(record.reviewStatus, "approved", `${record.id} claims approval`);
  }
});

test("no generated record claims the closed-book Assessment access class", () => {
  for (const record of generateBatch("KB-001")) {
    assert.ok(!record.accessClasses.includes("ASSESSMENT_CLOSED_BOOK"), `${record.id} claims closed-book Assessment`);
  }
});

test("every generated packet declares itself synthetic", () => {
  for (const record of generateBatch("KB-001")) {
    assert.equal(record.packet.synthetic, true, `${record.id} has a packet that does not say it is synthetic`);
  }
});

test("the committed corpus passes QA with no errors", () => {
  const report = validate({});
  assert.equal(report.scorecard.errorCount, 0, `${report.scorecard.errorCount} error(s): ${report.findings.filter((f) => f.severity === "ERROR").slice(0, 3).map((f) => `${f.rule} ${f.recordId}`).join(", ")}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.log("  - " + failure);
  process.exit(1);
}
