import type { AssessmentItem } from "./item.js";

/**
 * Scoring an assessment item's selection, deterministically (O5, 2026-10-14).
 *
 * **The rule is all-or-nothing.** A multi-select response earns credit only
 * when the learner's selection is exactly the expected set: no missing member,
 * and no extra one. This was the delegated product decision, chosen because it
 * is the only rule that keeps deterministic evaluation free of a weighting
 * judgement nobody has made; the owner has since authorised it directly.
 * **Partial credit is a product call and would be an override, not a tweak.**
 *
 * Two properties are deliberate and are tested:
 *
 * - **Nothing is silently filtered or normalised.** An unknown choice id or a
 *   repeated one makes the response malformed and earns nothing. Quietly
 *   dropping an invalid extra selection would hand credit to a learner who
 *   selected a wrong option, which is the exact failure O5 names.
 * - **A multi-select item is never scored from `correctChoiceId`.** That field
 *   stays populated for consumers that predate multi-select, but accepting one
 *   id as a complete answer would silently weaken the item.
 */
export type ScoreReason =
  | "correct"
  /** O9: the record is not choice-based, so this scorer must not judge it. */
  | "not-a-choice-item"
  | "incomplete"
  | "extra-selection"
  | "unknown-choice"
  | "duplicate-selection"
  | "empty-selection"
  | "multiple-for-single-answer";

export interface SelectionScore {
  /** All-or-nothing: 1 for a fully correct response, 0 otherwise. */
  credit: 0 | 1;
  reason: ScoreReason;
  /** The expected set, sorted, for an explanation the learner can be shown. */
  expected: string[];
  /** What the learner actually selected, in the order given. */
  selected: string[];
}

/** The complete expected set for an item, sorted, whatever its format. */
export function expectedSelection(item: AssessmentItem): string[] {
  if (item.responseFormat === "MULTI_SELECT" && item.correctChoiceIds) {
    return [...item.correctChoiceIds].sort();
  }
  return [item.correctChoiceId];
}

export function scoreSelection(item: AssessmentItem, selected: readonly string[]): SelectionScore {
  const given = [...selected];

  // O9: refuse anything that is not choice-based, before touching its shape.
  //
  // The type says AssessmentItem, but a migration output, a JSON load or a
  // plain-JS consumer can hand this an open-response task at runtime - and
  // reading `item.choices` on one threw rather than refusing. A crash awards no
  // credit, so the guarantee held by accident; a caller wrapping this in
  // try/catch would not have been able to tell a refusal from a bug. Refusing
  // explicitly is the behaviour O9 asks for.
  if (!Array.isArray((item as { choices?: unknown }).choices)) {
    return { credit: 0, reason: "not-a-choice-item", expected: [], selected: given };
  }

  const expected = expectedSelection(item);
  const fail = (reason: ScoreReason): SelectionScore => ({ credit: 0, reason, expected, selected: given });

  if (given.length === 0) return fail("empty-selection");

  // Malformed input is rejected before anything is compared, so no invalid
  // selection can be normalised away into a correct answer.
  if (new Set(given).size !== given.length) return fail("duplicate-selection");

  const choiceIds = new Set(item.choices.map((c) => c.id));
  if (given.some((id) => !choiceIds.has(id))) return fail("unknown-choice");

  if (item.responseFormat !== "MULTI_SELECT") {
    if (given.length > 1) return fail("multiple-for-single-answer");
    return given[0] === item.correctChoiceId
      ? { credit: 1, reason: "correct", expected, selected: given }
      : fail("extra-selection");
  }

  const expectedSet = new Set(expected);
  const missing = expected.filter((id) => !given.includes(id));
  const extra = given.filter((id) => !expectedSet.has(id));

  if (extra.length > 0) return fail("extra-selection");
  if (missing.length > 0) return fail("incomplete");
  return { credit: 1, reason: "correct", expected, selected: given };
}

/** True when the response is fully correct. The only credit-bearing outcome. */
export function isFullyCorrect(item: AssessmentItem, selected: readonly string[]): boolean {
  return scoreSelection(item, selected).credit === 1;
}
