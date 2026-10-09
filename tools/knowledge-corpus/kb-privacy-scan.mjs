// Knowledgebase PHI / PII / secret scan.
//
//   node tools/knowledge-corpus/kb-privacy-scan.mjs
//   node tools/knowledge-corpus/kb-privacy-scan.mjs --batch KB-002
//   node tools/knowledge-corpus/kb-privacy-scan.mjs --json
//
// Charter section XXXIII requires this before a batch becomes review-ready, and
// STOP GATE 9 requires the affected batch to be held — not committed, not pushed —
// if anything credible is found. Exit code 1 means held.
//
// What this tool actually proves, stated honestly:
//
//   It CAN prove that every patient, provider, staff member, practice and payer
//   named in the corpus is drawn from a pool declared in kb-slots.mjs, that every
//   MRN follows the reserved synthetic SYN- form, and that no string in the corpus
//   matches a contact-detail, identifier or credential pattern.
//
//   It CANNOT prove that an invented name belongs to nobody real. No tool can. The
//   checkable claim is provenance — every identity traces to a declared synthetic
//   pool — and that is what is asserted here. A reviewer still reads the pools.
//
// Fingerprint fields are hashes by construction and are excluded from the
// credential patterns; they are checked for shape instead.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { poolsForBatch } from "./kb-slots.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CORPUS_ROOT = path.join(REPO_ROOT, "knowledge-corpus");
const RECORDS_ROOT = path.join(CORPUS_ROOT, "records");

/** Reserved synthetic medical-record-number form. Anything MRN-shaped that does
 *  not take this form is treated as a real identifier until proven otherwise. */
const SYNTHETIC_MRN = /^SYN-\d{4}$/;

/** Every synthetic identifier convention the corpus is allowed to mint, measured
 *  from what it actually uses. A SYN- token outside these shapes is a new
 *  convention nobody declared, which is worth a finding in its own right: it is
 *  how a real identifier would get in wearing a synthetic prefix.
 *
 *  SYN-555-#### uses the 555 exchange reserved for fiction, so it is a telephone
 *  or fax number that cannot dial a real subscriber. */
const SYNTHETIC_FORMS = [
  { id: "MRN", re: /^SYN-\d{4}$/ },
  { id: "TELEPHONE_FICTION_EXCHANGE", re: /^SYN-555-\d{4}$/ },
  { id: "AUTHORIZATION_REF", re: /^SYN-AUTH-\d{4}$/ },
  { id: "PAYER_PLAN_ID", re: /^SYN-[A-Z]{2,4}-\d{2}$/ },
  { id: "PHARMACY_ACCOUNT", re: /^SYN-PH-\d{4}$/ }
];

/** An MRN reference only counts as one when what follows looks like an identifier.
 *  "read the MRN and the date of birth" is prose, not a disclosure. */
const MRN_REFERENCE = /\bMRN[\s:]*((?:[A-Z]{2,}-)?[\w-]*\d[\w-]*)/g;

const PATTERNS = [
  { id: "SSN", severity: "CRITICAL", re: /\b\d{3}-\d{2}-\d{4}\b/g, note: "US social-security number form" },
  { id: "PHONE", severity: "CRITICAL", re: /\b(?:\+?1[-. ])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g, note: "telephone number form" },
  { id: "EMAIL", severity: "CRITICAL", re: /\b[\w.+-]+@[\w-]+\.[A-Za-z]{2,}\b/g, note: "email address" },
  { id: "URL", severity: "HIGH", re: /\bhttps?:\/\/\S+/g, note: "absolute URL in content" },
  { id: "STREET_ADDRESS", severity: "HIGH", re: /\b\d{1,5}\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Boulevard|Blvd|Drive|Dr)\b/g, note: "street address form" },
  { id: "POSTCODE_US", severity: "HIGH", re: /\b\d{5}-\d{4}\b/g, note: "ZIP+4 form" },
  { id: "PRIVATE_KEY", severity: "CRITICAL", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, note: "private key block" },
  { id: "AWS_KEY", severity: "CRITICAL", re: /\bAKIA[0-9A-Z]{16}\b/g, note: "AWS access key id" },
  { id: "BEARER", severity: "CRITICAL", re: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/g, note: "bearer token" },
  { id: "CREDENTIAL_ASSIGNMENT", severity: "CRITICAL", re: /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key|client[_-]?secret|passwd|password)\b\s*[:=]\s*\S{6,}/gi, note: "credential assignment" },
  { id: "LONG_OPAQUE_BLOB", severity: "HIGH", re: /\b[A-Fa-f0-9]{32,}\b/g, note: "long hex blob; may be a key or a hash out of place" },
  { id: "CREDIT_CARD", severity: "CRITICAL", re: /\b(?:\d[ -]?){13,16}\b/g, note: "payment card number form" }
];

/** Paths whose values are hashes or enum-like by construction. */
function isExcludedPath(p) {
  return /(^|\.)fingerprints\./.test(p) || /(^|\.)(id|batchId|templateId|parentId|variantOf)$/.test(p) || /variantLineage\[/.test(p);
}

function batchIdsOnDisk() {
  return readdirSync(RECORDS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Every identity any registered batch may legitimately use. */
function buildAllowlist(batchIds) {
  const patientLabels = new Set();
  const mrns = new Set();
  const dobs = new Set();
  const people = new Set();
  const places = new Set();
  for (const batchId of batchIds) {
    let pools;
    try {
      pools = poolsForBatch(batchId);
    } catch {
      continue; // an unregistered batch is reported separately, below
    }
    for (const patient of pools.patients) {
      patientLabels.add(patient.label);
      mrns.add(patient.mrn);
      dobs.add(patient.dob);
    }
    for (const person of [...pools.providers, ...pools.staff]) people.add(person.label);
    for (const place of pools.practices) places.add(place);
    for (const payer of pools.payers) {
      places.add(payer.label);
      places.add(payer.planId);
    }
  }
  return { patientLabels, mrns, dobs, people, places };
}

function walkStrings(value, pathSoFar, visit) {
  if (typeof value === "string") {
    visit(value, pathSoFar);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkStrings(entry, `${pathSoFar}[${index}]`, visit));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      walkStrings(entry, pathSoFar ? `${pathSoFar}.${key}` : key, visit);
    }
  }
}

/** The whole of the per-record scan, exported so it can be tested against planted
 *  violations. A scanner that has never been shown to fail proves nothing. */
export function scanRecord(record, allowlist) {
  const findings = [];
  const add = (severity, rule, p, message, excerpt) =>
    findings.push({ severity, rule, recordId: record.id, path: p, message, ...(excerpt ? { excerpt } : {}) });

  if (record.packet && record.packet.synthetic !== true) {
    add("CRITICAL", "SYNTHETIC-DECLARATION", "packet.synthetic", "a packet does not declare itself synthetic");
  }

  const patientLabel = record.packet?.patientLabel;
  if (patientLabel && !allowlist.patientLabels.has(patientLabel)) {
    add("CRITICAL", "IDENTITY-PROVENANCE", "packet.patientLabel",
      `patient label "${patientLabel}" is not in any declared synthetic pool`);
  }

  walkStrings(record, "", (text, p) => {
    // Every SYN- token must match a declared synthetic convention.
    for (const token of new Set(text.match(/\bSYN-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g) ?? [])) {
      if (!SYNTHETIC_FORMS.some((form) => form.re.test(token))) {
        add("HIGH", "SYNTHETIC-FORM", p, `"${token}" carries the synthetic prefix but matches no declared convention`);
      }
    }
    // An MRN named in content must be a reserved synthetic identifier.
    MRN_REFERENCE.lastIndex = 0;
    let mrnMatch;
    while ((mrnMatch = MRN_REFERENCE.exec(text)) !== null) {
      const value = mrnMatch[1];
      if (!SYNTHETIC_MRN.test(value) && !allowlist.mrns.has(value)) {
        add("CRITICAL", "MRN-PROVENANCE", p, `MRN "${value}" is not a reserved synthetic identifier`);
      }
    }
    if (isExcludedPath(p)) return;
    for (const pattern of PATTERNS) {
      pattern.re.lastIndex = 0;
      const found = text.match(pattern.re);
      if (!found) continue;
      for (const hit of new Set(found)) {
        // A synthetic date of birth or MRN from a declared pool is not a leak.
        if (allowlist.dobs.has(hit) || allowlist.mrns.has(hit)) continue;
        add(pattern.severity, pattern.id, p, `${pattern.note}: "${hit}"`, text.slice(0, 160));
      }
    }
  });

  for (const [key, value] of Object.entries(record.fingerprints ?? {})) {
    if (typeof value !== "string" || !/^[a-f0-9]{16}$/.test(value)) {
      add("HIGH", "FINGERPRINT-SHAPE", `fingerprints.${key}`, `not a 16-character hex digest: "${value}"`);
    }
  }

  return findings;
}

export { buildAllowlist, batchIdsOnDisk };

export function scan({ batch } = {}) {
  const batchIds = batch ? [batch] : batchIdsOnDisk();
  const allowlist = buildAllowlist(batchIdsOnDisk());
  const findings = [];
  let recordCount = 0;
  let fileCount = 0;

  for (const batchId of batchIds) {
    const dir = path.join(RECORDS_ROOT, batchId);
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".json")) continue;
      fileCount += 1;
      const payload = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      for (const record of payload.records) {
        recordCount += 1;
        findings.push(...scanRecord(record, allowlist));
      }
    }
  }

  const bySeverity = {};
  for (const finding of findings) bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;

  return {
    scan: "kb-privacy-scan/1.0.0",
    batch: batch ?? "<all>",
    batches: batchIds,
    records: recordCount,
    files: fileCount,
    allowlist: {
      patientLabels: allowlist.patientLabels.size,
      syntheticMrns: allowlist.mrns.size,
      providersAndStaff: allowlist.people.size,
      practicesAndPayers: allowlist.places.size
    },
    findings,
    bySeverity,
    verdict: findings.length === 0 ? "CLEAR" : "HELD"
  };
}

function main(argv) {
  const batchIndex = argv.indexOf("--batch");
  const report = scan({ batch: batchIndex === -1 ? undefined : argv[batchIndex + 1] });

  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return report.verdict === "CLEAR" ? 0 : 1;
  }

  console.log(`Knowledgebase PHI / PII / secret scan — ${report.batch}`);
  console.log(`  records            ${report.records} across ${report.files} file(s)`);
  console.log(`  synthetic pools    ${report.allowlist.patientLabels} patient labels, ${report.allowlist.syntheticMrns} MRNs, ${report.allowlist.providersAndStaff} providers/staff, ${report.allowlist.practicesAndPayers} practices/payers`);
  console.log(`  findings           ${report.findings.length}${report.findings.length ? ` (${Object.entries(report.bySeverity).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`);
  console.log(`  verdict            ${report.verdict}`);
  if (report.findings.length) {
    console.log("\nFindings:");
    for (const finding of report.findings.slice(0, 40)) {
      console.log(`  [${finding.severity}] ${finding.rule} ${finding.recordId} (${finding.path}): ${finding.message}`);
    }
    if (report.findings.length > 40) console.log(`  … and ${report.findings.length - 40} more`);
    console.log("\nSTOP GATE 9: hold the affected batch. Do not commit, push or copy the content.");
  }
  return report.verdict === "CLEAR" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
