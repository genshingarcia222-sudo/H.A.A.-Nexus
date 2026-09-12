export interface NumericClinicalMention {
  raw: string;
  /** Normalized "number+unit" key used for comparison, e.g. "37.0c", "110bpm". */
  key: string;
}

/**
 * Matches number+unit patterns typical of vital signs and common labs:
 * temperature (C/F), heart rate (bpm), blood pressure (mmHg), glucose
 * (mg/dL), oxygen saturation (%), respiratory rate (breaths/min).
 *
 * This is deliberately narrow and pattern-based, not general NLP. It
 * catches the canonical fabrication case the spec describes (a specific
 * vital/lab value that was never given) - it does not attempt to detect
 * every possible form of fabricated or unsupported clinical content, which
 * would require real language understanding (Architecture Package Section
 * 23's "AI-assisted interpretation", not the deterministic MVP core).
 */
const CLINICAL_VALUE_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*°?\s*(c|f|bpm|mmhg|mg\/dl|%|breaths\/min)(?![a-z])/gi;

export function extractNumericClinicalMentions(text: string): NumericClinicalMention[] {
  const mentions: NumericClinicalMention[] = [];
  for (const match of text.matchAll(CLINICAL_VALUE_PATTERN)) {
    const [raw, number, unit] = match;
    if (!number || !unit) continue;
    mentions.push({ raw, key: `${number}${unit.toLowerCase()}` });
  }
  return mentions;
}

/**
 * Returns the mentions in `documentedText` whose number+unit does not
 * appear anywhere in `encounterText` - i.e., values the learner introduced
 * that the encounter never provided.
 */
export function findUnsupportedNumericMentions(
  documentedText: string,
  encounterText: string
): NumericClinicalMention[] {
  const encounterKeys = new Set(extractNumericClinicalMentions(encounterText).map((m) => m.key));
  return extractNumericClinicalMentions(documentedText).filter((m) => !encounterKeys.has(m.key));
}
