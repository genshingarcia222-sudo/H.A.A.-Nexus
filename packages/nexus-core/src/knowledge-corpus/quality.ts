import type { AssessmentItem } from "./item.js";

/**
 * Question-quality checks (D12-54), ported from `validate_pilot_batch.py`.
 *
 * Three tiers, and the distinction is the whole point:
 *
 * - **STRUCTURAL** — the record is malformed. (Mostly the schema's job; the few
 *   here are cross-choice checks the schema cannot express.)
 * - **POLICY** — the record is well-formed but breaks an authoring rule the
 *   repository has already committed to, such as the answer-length bias
 *   revision 2 of the pilot was created to remove.
 * - **HEURISTIC** — a *guess* that something may be wrong. Warnings only.
 *
 * **A heuristic result is never verification.** These functions check shape and
 * habit. Nothing here reads a source, and nothing here can tell whether a
 * question is medically, legally or clinically correct — that remains the human
 * gate, which no code advances.
 */

export const QUALITY_TIERS = ["STRUCTURAL", "POLICY", "HEURISTIC"] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

export interface QualityFinding {
  rule: string;
  tier: QualityTier;
  /** The item this concerns, or `(batch)` for a whole-file rule. */
  subject: string;
  message: string;
}

export interface QualityOptions {
  /**
   * Check the rules that only bind content about to face learners. Authors
   * drafting candidates should not be blocked by them; production must be.
   */
  production?: boolean;
}

const ABSOLUTE_TERMS = /\b(always|never|all|none|only|must|every|cannot)\b/i;
const CODE_LIKE = /\b[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?\b/g;
const CATCH_ALL_CHOICE = /^(all|none) of the above\b/i;

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/** Cognitive types that would be surprising for a given modality. */
const MODALITY_TYPE_MISMATCH: Record<string, string[]> = {
  DIRECT_KNOWLEDGE: ["scenario"],
  SITUATIONAL: ["recall"],
  SOAP: [],
  WORKFLOW: [],
  ERROR_DETECTION: ["recall"],
  COMPARATIVE_DECISION: [],
  TRANSFORMATION: []
};

/** Quality findings for one item. */
export function checkItemQuality(item: AssessmentItem, options: QualityOptions = {}): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const add = (rule: string, tier: QualityTier, message: string) =>
    findings.push({ rule, tier, subject: item.questionId, message });

  const correct = item.choices.find((choice) => choice.id === item.correctChoiceId);
  const distractors = item.choices.filter((choice) => choice.id !== item.correctChoiceId);

  // Two choices that read the same give the learner a defensible second answer.
  const texts = item.choices.map((choice) => normalise(choice.text));
  if (new Set(texts).size !== texts.length) {
    add("duplicate-choice-text", "STRUCTURAL", "two choices have the same text");
  }

  if (correct && distractors.length > 0) {
    const longestDistractor = Math.max(...distractors.map((choice) => choice.text.length));
    if (correct.text.length > longestDistractor) {
      // The defect revision 2 of Pilot 001 existed to remove, and which the
      // first revision-3 pass reintroduced.
      add(
        "answer-length-bias",
        "POLICY",
        `correct choice is the longest option (${correct.text.length} > ${longestDistractor})`
      );
    }
    const shortestDistractor = Math.min(...distractors.map((choice) => choice.text.length));
    if (correct.text.length < shortestDistractor * 0.5) {
      add(
        "answer-much-shorter",
        "HEURISTIC",
        `correct choice is less than half the length of every distractor (${correct.text.length} vs ${shortestDistractor})`
      );
    }
  }

  for (const choice of item.choices) {
    if (CATCH_ALL_CHOICE.test(choice.text.trim())) {
      add("catch-all-choice", "POLICY", `choice "${choice.id}" is an "all/none of the above" option`);
    }
  }

  if (options.production) {
    for (const choice of item.choices) {
      if (!choice.why) {
        add("missing-choice-explanation", "POLICY", `choice "${choice.id}" has no explanation`);
      }
    }
    if (item.knowledgeRefs.length === 0) {
      add("no-knowledge-grounding", "POLICY", "a production item must cite at least one knowledge record");
    }
    if (!item.applicability) {
      add("no-applicability", "POLICY", "a production item must declare where and when it applies");
    }
    if (!("ref" in item.source)) {
      add("inline-source", "POLICY", "a production item must cite the source registry, not an inline source");
    }
  }

  if (item.domain.toUpperCase().includes("ICD") && !item.codingReference) {
    add("icd-without-coding-reference", "POLICY", "an ICD item must state its system, jurisdiction and release");
  }

  const listed = new Set(item.codingReference?.codes ?? []);
  const blob = [item.question, ...item.choices.map((choice) => choice.text), item.rationale].join(" ");
  for (const match of blob.match(CODE_LIKE) ?? []) {
    if (!listed.has(match)) {
      add("unlisted-code-token", "HEURISTIC", `text contains code-like token "${match}" not listed in codingReference.codes`);
    }
  }

  if (correct && ABSOLUTE_TERMS.test(correct.text) && item.additionalEvidence.every((link) => link.supports !== "EXCEPTION")) {
    // r3's Q1 and Q12 corrections were exactly this: an absolute reading of a
    // rule that has documented exceptions.
    add(
      "absolute-wording",
      "HEURISTIC",
      "correct choice uses absolute wording with no exception cited; check the source's exceptions"
    );
  }

  // "… is a/an ____" with only some options agreeing gives the answer away.
  const article = /\b(a|an)\s*$/i.exec(item.question.trim().replace(/[?:]$/, ""));
  if (article) {
    const vowelStart = item.choices.filter((choice) => /^[aeiou]/i.test(choice.text.trim()));
    if (vowelStart.length > 0 && vowelStart.length < item.choices.length) {
      add("grammatical-cue", "HEURISTIC", `stem ends in "${article[1]}" and only some choices agree with it`);
    }
  }

  if ((MODALITY_TYPE_MISMATCH[item.modality] ?? []).includes(item.questionType)) {
    add(
      "modality-type-mismatch",
      "HEURISTIC",
      `questionType "${item.questionType}" is unusual for modality ${item.modality}`
    );
  }

  return findings;
}

/**
 * Findings that only exist across a set of items — an authoring file, or a
 * batch being ingested.
 */
export function checkBatchQuality(items: AssessmentItem[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const add = (rule: string, tier: QualityTier, message: string, subject = "(batch)") =>
    findings.push({ rule, tier, subject, message });

  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.questionId)) add("duplicate-item-id", "STRUCTURAL", `duplicate item id "${item.questionId}"`);
    ids.add(item.questionId);
  }

  // Position balance, on the pilot validator's own cap: ceil(n/4) + 1.
  // Balance is authoring hygiene. It is never evidence that an answer is right.
  if (items.length > 0) {
    const positions = new Map<string, number>();
    for (const item of items) {
      positions.set(item.correctChoiceId, (positions.get(item.correctChoiceId) ?? 0) + 1);
    }
    const cap = Math.ceil(items.length / 4) + 1;
    for (const [choiceId, count] of positions) {
      if (count > cap) {
        add(
          "answer-position-imbalance",
          "POLICY",
          `correct answer is "${choiceId}" in ${count} of ${items.length} items (max ${cap})`
        );
      }
    }
  }

  // Near-duplicate stems, by trigram overlap. A guess, hence heuristic: two
  // questions may legitimately share phrasing and test different things.
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!a || !b) continue;
      const similarity = trigramSimilarity(a.question, b.question);
      if (similarity >= 0.85) {
        add(
          "near-duplicate-stem",
          "HEURISTIC",
          `stem is ${(similarity * 100).toFixed(0)}% similar to "${b.questionId}"`,
          a.questionId
        );
      }
    }
  }

  return findings;
}

export function qualityErrors(findings: QualityFinding[]): QualityFinding[] {
  return findings.filter((finding) => finding.tier !== "HEURISTIC");
}

export function qualityWarnings(findings: QualityFinding[]): QualityFinding[] {
  return findings.filter((finding) => finding.tier === "HEURISTIC");
}

function trigrams(text: string): Set<string> {
  const normalised = normalise(text);
  const set = new Set<string>();
  for (let i = 0; i + 3 <= normalised.length; i++) {
    set.add(normalised.slice(i, i + 3));
  }
  return set;
}

/** Jaccard overlap of character trigrams, in [0, 1]. */
export function trigramSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const gram of left) {
    if (right.has(gram)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}
