// Tests for the PHI / PII / secret scan.
//
// The point of these is adversarial: a scanner that has only ever been run against
// clean content has not been shown to detect anything. Each test plants exactly one
// violation in an otherwise-clean record and asserts the rule that must fire.
//
//   node tools/knowledge-corpus/kb-privacy-scan.test.mjs
import assert from "node:assert/strict";
import { buildAllowlist, batchIdsOnDisk, scan, scanRecord } from "./kb-privacy-scan.mjs";

const ALLOWLIST = buildAllowlist(batchIdsOnDisk());

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

/** A clean record drawn from declared synthetic pools. */
function cleanRecord(overrides = {}) {
  const patient = [...ALLOWLIST.patientLabels][0];
  const mrn = [...ALLOWLIST.mrns][0];
  return {
    id: "KB-QUES-KB999-000001",
    packet: {
      synthetic: true,
      kind: "CHART_EXCERPT",
      patientLabel: patient,
      lines: [{ ref: "L1", text: `Chart header for MRN ${mrn}.`, decisive: true }]
    },
    prompt: `A routine task for MRN ${mrn}.`,
    goldBehavior: "Do the defensible thing.",
    fingerprints: {
      promptHash: "0123456789abcdef",
      scenarioFingerprint: "0123456789abcdef",
      competencyFingerprint: "0123456789abcdef",
      evidenceLayoutFingerprint: "0123456789abcdef",
      answerPatternFingerprint: "0123456789abcdef"
    },
    ...overrides
  };
}

function rulesFor(record) {
  return scanRecord(record, ALLOWLIST).map((finding) => finding.rule);
}

console.log("privacy scan tests\n");

test("a clean synthetic record produces no findings", () => {
  assert.deepEqual(scanRecord(cleanRecord(), ALLOWLIST), []);
});

test("a packet that does not declare itself synthetic is CRITICAL", () => {
  const record = cleanRecord();
  record.packet.synthetic = false;
  assert.ok(rulesFor(record).includes("SYNTHETIC-DECLARATION"));
});

test("a patient label outside every declared pool is CRITICAL", () => {
  const record = cleanRecord();
  record.packet.patientLabel = "Margaret Thatcher";
  assert.ok(rulesFor(record).includes("IDENTITY-PROVENANCE"));
});

test("an MRN that is not a reserved synthetic identifier is CRITICAL", () => {
  const record = cleanRecord({ goldBehavior: "Open the chart for MRN 40291837 and proceed." });
  assert.ok(rulesFor(record).includes("MRN-PROVENANCE"));
});

test("a generic prose mention of an MRN is not a finding", () => {
  const record = cleanRecord({ goldBehavior: "Read the MRN and the date of birth back to the patient." });
  assert.deepEqual(rulesFor(record), []);
});

test("the reserved 555 fiction exchange is accepted", () => {
  const record = cleanRecord({ goldBehavior: "Fax SYN-555-0142 is the authorised destination." });
  assert.deepEqual(rulesFor(record), []);
});

test("a synthetic prefix on an undeclared shape is flagged", () => {
  const record = cleanRecord({ goldBehavior: "Reference SYN-TOTALLY-MADE-UP-99999 is on file." });
  assert.ok(rulesFor(record).includes("SYNTHETIC-FORM"));
});

for (const [label, rule, text] of [
  ["a social-security number", "SSN", "The number on file is 123-45-6789."],
  ["a telephone number", "PHONE", "Call the patient back on 415-555-2671."],
  ["an email address", "EMAIL", "Confirmation was sent to patient.name@example.com."],
  ["an absolute URL", "URL", "See https://records.example.org/chart/9912 for the note."],
  ["a street address", "STREET_ADDRESS", "The patient lives at 42 Chestnut Street."],
  ["a private key block", "PRIVATE_KEY", "-----BEGIN RSA PRIVATE KEY-----"],
  ["an AWS access key id", "AWS_KEY", "Credentials: AKIAIOSFODNN7EXAMPLE"],
  ["a bearer token", "BEARER", "Header was Bearer abcdefghijklmnopqrstuvwxyz012345"],
  ["a credential assignment", "CREDENTIAL_ASSIGNMENT", "api_key = 9f2b71cc40de"],
  ["a long opaque blob", "LONG_OPAQUE_BLOB", "Token 0123456789abcdef0123456789abcdef0 was used."]
]) {
  test(`${label} is detected as ${rule}`, () => {
    assert.ok(rulesFor(cleanRecord({ goldBehavior: text })).includes(rule), `${rule} did not fire on: ${text}`);
  });
}

test("a malformed fingerprint is flagged", () => {
  const record = cleanRecord();
  record.fingerprints.promptHash = "not-a-digest";
  assert.ok(rulesFor(record).includes("FINGERPRINT-SHAPE"));
});

test("the committed corpus scans CLEAR", () => {
  const report = scan({});
  assert.equal(report.verdict, "CLEAR", `${report.findings.length} finding(s): ${report.findings.slice(0, 3).map((f) => `${f.rule} ${f.recordId}`).join(", ")}`);
  assert.ok(report.records > 0, "the scan found no records at all, which is not a pass");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.log("  - " + failure);
  process.exit(1);
}
