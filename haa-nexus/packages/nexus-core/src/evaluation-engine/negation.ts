import { normalizeText, splitSentences } from "./text-matching.js";

const NEGATION_CUES = ["no ", "not ", "denies", "denied", "negative for", "without", "absent", "afebrile"];

/**
 * Derives a "bare concept" from a negated phrase by stripping known
 * negation-cue prefixes, e.g. "denies fever" -> "fever", "no chest pain" ->
 * "chest pain". Used to check whether the learner mentioned the concept at
 * all without carrying over the negation. Deliberately simple prefix
 * stripping - it does not attempt general negation parsing.
 */
export function deriveBareConcept(negatedPhrase: string): string | null {
  const normalized = normalizeText(negatedPhrase);
  for (const cue of NEGATION_CUES) {
    if (normalized.startsWith(cue)) {
      const remainder = normalized.slice(cue.length).trim();
      return remainder.length > 0 ? remainder : null;
    }
  }
  return null;
}

function sentenceContainsCue(sentence: string, phrase: string): boolean {
  const normalizedSentence = normalizeText(sentence);
  if (!normalizedSentence.includes(normalizeText(phrase))) return false;
  return NEGATION_CUES.some((cue) => normalizedSentence.includes(cue));
}

/**
 * For a pertinent-negative requirement that was NOT satisfied by any of its
 * acceptable (negated) variants, checks whether the learner nonetheless
 * mentioned the bare underlying concept in `sectionText` without a nearby
 * negation cue - i.e., likely asserted the opposite of what the encounter
 * supports. This is the "dangerous reversal" case (Architecture Package
 * Section 17): documenting a positive finding for something the encounter
 * explicitly denied.
 */
export function detectReversedNegative(
  sectionText: string,
  acceptableVariants: string[],
  sourceFact: string
): boolean {
  const bareConcepts = [sourceFact, ...acceptableVariants]
    .map(deriveBareConcept)
    .filter((c): c is string => c !== null);

  if (bareConcepts.length === 0) return false;

  const sentences = splitSentences(sectionText);
  for (const sentence of sentences) {
    for (const concept of bareConcepts) {
      const normalizedSentence = normalizeText(sentence);
      if (normalizedSentence.includes(normalizeText(concept)) && !sentenceContainsCue(sentence, concept)) {
        return true;
      }
    }
  }
  return false;
}
