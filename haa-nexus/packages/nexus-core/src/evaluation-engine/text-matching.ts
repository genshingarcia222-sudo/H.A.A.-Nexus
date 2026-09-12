/** Lowercases and collapses whitespace so matching is not sensitive to spacing/casing. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Whether `needle` appears as a substring of `haystack`, normalized. Deliberately simple: this is the MVP's terminology-acceptance mechanism (Architecture Package Section 6) - it accepts any authored variant, but is still literal substring matching, not semantic similarity. */
export function containsPhrase(haystack: string, needle: string): boolean {
  if (needle.trim().length === 0) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}

export interface PhraseMatch {
  variant: string;
  matched: true;
}

/** Returns the first variant found in `text`, or null if none match. */
export function findFirstMatch(text: string, variants: string[]): string | null {
  for (const variant of variants) {
    if (containsPhrase(text, variant)) return variant;
  }
  return null;
}

/** Splits text into sentences for sentence-scoped checks (e.g. negation proximity). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
