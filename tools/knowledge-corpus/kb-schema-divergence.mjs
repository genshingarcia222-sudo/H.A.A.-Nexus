// Measures the distance between the two Knowledgebase record contracts that
// currently exist in this repository, so decision O1 / D18 can be made from
// numbers instead of from impressions.
//
//   A. this branch's authoring contract
//      knowledge-corpus/schema/kb-record.schema.json  (JSON Schema, one flat
//      record type with a `recordType` discriminator)
//
//   B. the runtime contract on `main` since D15's merge
//      packages/nexus-core/src/knowledge-corpus/  (Zod, four typed families:
//      KNOWLEDGE / ITEM / CONTEXT / CONCEPT)
//
// It reads both and the 432 authored records. It changes nothing, and it does
// not choose: O1 is the owner's, and nothing here may be read as having
// answered it.
//
//   node tools/knowledge-corpus/kb-schema-divergence.mjs           report
//   node tools/knowledge-corpus/kb-schema-divergence.mjs --json    machine-readable
//
// Exit code is 0 unless an input cannot be read or parsed, which is a defect in
// this tool or in the contracts, not a finding about them.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const CORE_DIR = "packages/nexus-core/src/knowledge-corpus";
const BANK_DIR = "packages/nexus-core/src/question-bank";

// --- TypeScript object-literal field extraction --------------------------
//
// The Zod contract is TypeScript consumed as source: `nexus-core` declares no
// build (`main` points at `src/index.ts`), so a zero-dependency tool cannot
// import it and evaluate the schemas. It is read instead.
//
// That is a real limitation and is reported rather than hidden: this measures
// the *declared field names*, not Zod's runtime behaviour. Field names are
// enough for the migration question O1 asks, because `.strict()` decides the
// answer on names alone.

/**
 * Comments removed, string and template literals left intact.
 *
 * This is not cosmetic. These schemas document nearly every field with a
 * leading `/** ... *\/` or `//`, and a field-name scanner that reads the
 * comment first never sees the name behind it — which silently *undercounts*
 * the runtime contract and overstates how far the two models are apart. The
 * first run of this tool did exactly that and lost `questionId`, `domain`,
 * `question` and `rationale`.
 */
export function stripComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < text.length) {
        if (text[i] === "\\") {
          out += text.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += text[i];
        if (text[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
      out += " ";
      continue;
    }
    if (ch === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** The body of the first balanced {...} at or after `from`. */
export function balancedBraces(text, from) {
  const open = text.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/**
 * Top-level `key:` names and `...spread` references in an object-literal body.
 *
 * Only depth zero counts, so a nested `z.object({ inner: ... })` does not leak
 * its own fields up into its parent's field set.
 */
export function topLevelKeys(rawBody) {
  // Stripped here as well as in `parseShapes`, because a caller that hands this
  // a commented literal must not silently get an empty field set back.
  // `stripComments` is idempotent, so doing it twice costs nothing.
  const body = stripComments(rawBody);
  const keys = [];
  const spreads = [];
  let depth = 0;
  let line = "";
  const flush = () => {
    const trimmed = line.trim();
    line = "";
    if (!trimmed) return;
    const spread = /^\.\.\.([A-Za-z_$][\w$]*)/.exec(trimmed);
    if (spread) {
      spreads.push(spread[1]);
      return;
    }
    const key = /^["']?([A-Za-z_$][\w$]*)["']?\s*:/.exec(trimmed);
    if (key) keys.push(key[1]);
  };
  for (const ch of body) {
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (depth === 0 && ch === ",") {
      flush();
      continue;
    }
    line += ch;
  }
  flush();
  return { keys, spreads };
}

/**
 * Every named object shape in a TypeScript source: `const X = {`,
 * `const X = z.object({`, and `const X = Base.extend({`.
 *
 * `extends` is kept rather than resolved here, so the caller can resolve
 * across files — `AssessmentItemObjectSchema` extends a schema that lives in
 * `question-bank`, not in `knowledge-corpus`.
 */
export function parseShapes(rawSource) {
  const source = stripComments(rawSource);
  const shapes = {};

  // A discriminated union has no fields of its own: it admits exactly what its
  // members admit. Recorded as a union so the caller can resolve it, rather
  // than being mistaken for a schema this tool failed to find.
  const union = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*z\s*\.\s*discriminatedUnion\s*\(\s*["'][^"']*["']\s*,\s*\[([^\]]*)\]/g;
  let unionMatch;
  while ((unionMatch = union.exec(source)) !== null) {
    const [, name, members] = unionMatch;
    shapes[name] = {
      name,
      keys: [],
      spreads: [],
      extends: null,
      unionOf: members
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    };
  }

  const decl = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]{0,80}?)\{/g;
  let match;
  while ((match = decl.exec(source)) !== null) {
    const [, name, between] = match;
    if (/\bz\s*$|\bz\s*\.\s*$/.test(between) && !/object\s*\(\s*$/.test(between)) {
      // `const X = z` with the `.object({` on a later line: fall through, the
      // brace search below still finds the right literal.
    }
    const braces = balancedBraces(source, match.index + match[0].length - 1);
    if (!braces) continue;
    const extend = /([A-Za-z_$][\w$]*)\s*\.\s*extend\s*\($/.exec(between.trim() + "(");
    const extendsFrom = /([A-Za-z_$][\w$]*)\s*\.\s*extend\s*\(/.exec(between);
    const { keys, spreads } = topLevelKeys(braces.body);
    if (shapes[name]?.unionOf) {
      decl.lastIndex = braces.end;
      continue;
    }
    shapes[name] = {
      name,
      keys,
      spreads,
      extends: extendsFrom ? extendsFrom[1] : extend ? extend[1] : null
    };
    decl.lastIndex = braces.end;
  }
  return shapes;
}

/** Field set of `name`, following `...spreads` and `.extend()` bases. */
export function resolveFields(shapes, name, seen = new Set()) {
  if (seen.has(name) || !shapes[name]) return [];
  seen.add(name);
  const shape = shapes[name];
  const fields = [...shape.keys];
  for (const spread of shape.spreads) fields.push(...resolveFields(shapes, spread, seen));
  if (shape.extends) fields.push(...resolveFields(shapes, shape.extends, seen));
  for (const member of shape.unionOf ?? []) fields.push(...resolveFields(shapes, member, seen));
  return [...new Set(fields)];
}

// --- the two contracts ---------------------------------------------------

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8"));
}

function readTsDir(rel) {
  const dir = path.join(REPO_ROOT, rel);
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

/** Contract A: the branch's JSON Schema. */
export function branchContract() {
  const schema = readJson("knowledge-corpus/schema/kb-record.schema.json");
  const properties = Object.keys(schema.properties ?? {}).sort();
  return {
    file: "knowledge-corpus/schema/kb-record.schema.json",
    shape: "one flat record type, discriminated by `recordType`",
    properties,
    required: [...(schema.required ?? [])].sort()
  };
}

/** The family schemas of contract B, and the fields each one admits. */
export const CORE_FAMILY_SCHEMAS = {
  KNOWLEDGE: "KnowledgeRecordSchema",
  ITEM: "AssessmentItemObjectSchema",
  "CONTEXT:CASE": "CaseContextSchema",
  "CONTEXT:SCENARIO": "ScenarioContextSchema",
  "CONTEXT:SOAP": "SoapContextSchema",
  CONCEPT: "AssessmentConceptSchema"
};

/** Contract B: the Zod families on `main`. */
export function coreContract() {
  const source = readTsDir(CORE_DIR) + "\n" + readTsDir(BANK_DIR);
  const shapes = parseShapes(source);
  const families = {};
  for (const [family, schemaName] of Object.entries(CORE_FAMILY_SCHEMAS)) {
    families[family] = {
      schema: schemaName,
      present: Boolean(shapes[schemaName]),
      fields: resolveFields(shapes, schemaName).sort()
    };
  }
  const strict = (source.match(/\.strict\(\)/g) ?? []).length;
  return {
    dirs: [CORE_DIR, BANK_DIR],
    shape: "four typed families (KNOWLEDGE / ITEM / CONTEXT / CONCEPT)",
    families,
    strictCount: strict,
    // Every field any family admits. A branch key outside this set has no
    // same-named home anywhere in the runtime contract.
    union: [...new Set(Object.values(families).flatMap((f) => f.fields))].sort()
  };
}

// --- what the authored records actually use ------------------------------

/** Every record file under `knowledge-corpus/records/`. */
export function recordFiles() {
  const root = path.join(REPO_ROOT, "knowledge-corpus/records");
  if (!existsSync(root)) return [];
  const out = [];
  for (const batch of readdirSync(root)) {
    const dir = path.join(root, batch);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".json")) out.push(path.join("knowledge-corpus/records", batch, f));
    }
  }
  return out.sort();
}

/**
 * Which top-level keys the authored corpus actually populates, and how often.
 *
 * A schema property nobody uses costs nothing to migrate; one on every record
 * costs 432 edits. The distinction is the whole point of counting.
 */
export function recordKeyUsage(files = recordFiles()) {
  const counts = new Map();
  let records = 0;
  const problems = [];
  for (const rel of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8"));
    } catch (e) {
      problems.push(`${rel}: ${e.message}`);
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : [parsed];
    for (const record of list) {
      if (!record || typeof record !== "object") continue;
      records++;
      for (const key of Object.keys(record)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return { records, counts, problems };
}

// --- the comparison -----------------------------------------------------

export function compare(branch, core, usage) {
  const coreUnion = new Set(core.union);
  const used = [...usage.counts.keys()].sort();

  const unmapped = used.filter((k) => !coreUnion.has(k));
  const mapped = used.filter((k) => coreUnion.has(k));

  // Declared but never populated: migration does not have to carry these.
  const declaredUnused = branch.properties.filter((p) => !usage.counts.has(p));

  // What the runtime contract demands that the records have no field for at
  // all. Named, not counted, because each one is a separate authoring question.
  const coreOnly = core.union.filter((f) => !usage.counts.has(f));

  return {
    recordsExamined: usage.records,
    branchPropertiesDeclared: branch.properties.length,
    branchPropertiesPopulated: used.length,
    declaredUnused,
    mapped,
    unmapped,
    coreOnly,
    // `.strict()` is the cost driver: an unmapped key is not ignored, it is a
    // validation error, so every record carrying one fails until it is moved.
    strictRejectionRisk: unmapped.map((k) => ({ key: k, records: usage.counts.get(k) }))
  };
}

// --- report -------------------------------------------------------------

function render(branch, core, usage, result) {
  const lines = [];
  lines.push("H.A.A. Nexus Knowledgebase schema divergence  (decision O1 / D18)");
  lines.push("");
  lines.push("This measures two contracts. It does not choose between them.");
  lines.push("");
  lines.push("CONTRACT A - authoring, this branch");
  lines.push(`  file                  ${branch.file}`);
  lines.push(`  shape                 ${branch.shape}`);
  lines.push(`  properties declared   ${branch.properties.length}`);
  lines.push(`  properties required   ${branch.required.length}`);
  lines.push("");
  lines.push("CONTRACT B - runtime, on main since D15");
  lines.push(`  source                ${core.dirs.join(", ")}`);
  lines.push(`  shape                 ${core.shape}`);
  lines.push(`  strict() schemas      ${core.strictCount}  (unknown keys are rejected, not ignored)`);
  for (const [family, info] of Object.entries(core.families)) {
    lines.push(`  ${family.padEnd(18)}  ${info.present ? `${info.fields.length} fields via ${info.schema}` : `MISSING ${info.schema}`}`);
  }
  lines.push(`  union of all fields   ${core.union.length}`);
  lines.push("");
  lines.push("AUTHORED CORPUS");
  lines.push(`  records examined      ${usage.records}`);
  lines.push(`  top-level keys used   ${result.branchPropertiesPopulated} of ${result.branchPropertiesDeclared} declared`);
  lines.push(`  declared, unused      ${result.declaredUnused.length}${result.declaredUnused.length ? `  (${result.declaredUnused.join(", ")})` : ""}`);
  for (const p of usage.problems) lines.push(`  PROBLEM               ${p}`);
  lines.push("");
  lines.push("MIGRATION DISTANCE  (name-level; see the header on what this does not measure)");
  lines.push(`  keys with a same-named home in B   ${result.mapped.length}`);
  lines.push(`  keys with NO home in B             ${result.unmapped.length}`);
  for (const row of result.strictRejectionRisk) {
    lines.push(`    ${row.key.padEnd(26)} on ${String(row.records).padStart(4)} record(s)`);
  }
  lines.push(`  B fields no record supplies        ${result.coreOnly.length}`);
  for (const f of result.coreOnly) lines.push(`    ${f}`);
  lines.push("");
  lines.push("O1 / D18 remains OPEN. Nothing here resolves it.");
  return lines.join("\n");
}

export function collect() {
  const branch = branchContract();
  const core = coreContract();
  const usage = recordKeyUsage();
  return { branch, core, usage, result: compare(branch, core, usage) };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const { branch, core, usage, result } = collect();
  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        { branch, core, usage: { records: usage.records, keys: Object.fromEntries(usage.counts), problems: usage.problems }, result },
        null,
        2
      )
    );
  } else {
    console.log(render(branch, core, usage, result));
  }
  // A missing family schema or an unparseable record means this tool cannot be
  // trusted; a large divergence does not.
  const broken = Object.values(core.families).some((f) => !f.present) || usage.problems.length > 0;
  process.exit(broken ? 1 : 0);
}
