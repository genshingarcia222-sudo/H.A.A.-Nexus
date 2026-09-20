import type { RequirementItem } from "../scenario-engine/types.js";
import type { DocumentationDraft } from "../simulation-engine/documentation-draft.js";
import { containsPhrase, findFirstMatch } from "./text-matching.js";
import { detectReversedNegative } from "./negation.js";

export interface RequirementEvaluation {
  requirement: RequirementItem;
  found: boolean;
  foundInSection: keyof DocumentationDraft | null;
  matchedVariant: string | null;
  /** Found, but in a different section than the requirement specifies. */
  isWrongSection: boolean;
  /** Found only via the raw sourceFact (lay phrasing), not any clinical acceptableVariant. */
  usedRawLayTerm: boolean;
  /** A pertinent-negative requirement where the bare concept appears without its required negation. */
  negationReversed: boolean;
  /**
   * The requirement is satisfied *and* the same section also asserts the
   * opposite - a note that says both "No fever" and "Fever present"
   * (decision D7).
   *
   * Only computed for pertinent negatives, which is where the existing
   * negation machinery can detect the contradiction reliably. This is not
   * general contradiction detection, and does not claim to be.
   */
  selfContradicted: boolean;
}

/**
 * Whether a satisfied pertinent negative is contradicted elsewhere in its own
 * section. Reuses `detectReversedNegative`, which already answers "does this
 * text assert the bare concept without a negation cue" - the only difference
 * is that here the correct negation is present too, which is what makes it a
 * contradiction rather than a plain reversal.
 */
function isSelfContradicted(requirement: RequirementItem, draft: DocumentationDraft): boolean {
  if (!requirement.isPertinentNegative) return false;
  return detectReversedNegative(
    draft[requirement.section],
    requirement.acceptableVariants,
    requirement.sourceFact
  );
}

const ALL_SECTIONS: (keyof DocumentationDraft)[] = [
  "chiefComplaint",
  "hpi",
  "ros",
  "physicalExam",
  "assessment",
  "plan",
  "additionalNotes"
];

export function evaluateRequirement(
  requirement: RequirementItem,
  draft: DocumentationDraft
): RequirementEvaluation {
  const targetSectionText = draft[requirement.section];
  const matchInTargetSection = findFirstMatch(targetSectionText, requirement.acceptableVariants);

  if (matchInTargetSection) {
    return {
      requirement,
      found: true,
      foundInSection: requirement.section,
      matchedVariant: matchInTargetSection,
      isWrongSection: false,
      usedRawLayTerm: false,
      negationReversed: false,
      selfContradicted: isSelfContradicted(requirement, draft)
    };
  }

  // Not found via an acceptable clinical variant in the target section -
  // check if the learner used the raw lay phrasing (sourceFact) instead.
  const usedRawLayTerm =
    !requirement.acceptableVariants.some((v) => v.toLowerCase() === requirement.sourceFact.toLowerCase()) &&
    containsPhrase(targetSectionText, requirement.sourceFact);

  if (usedRawLayTerm) {
    return {
      requirement,
      found: true,
      foundInSection: requirement.section,
      matchedVariant: requirement.sourceFact,
      isWrongSection: false,
      usedRawLayTerm: true,
      negationReversed: false,
      selfContradicted: isSelfContradicted(requirement, draft)
    };
  }

  // Check other sections for a match (wrong_section case).
  for (const section of ALL_SECTIONS) {
    if (section === requirement.section) continue;
    const match = findFirstMatch(draft[section], requirement.acceptableVariants);
    if (match) {
      return {
        requirement,
        found: true,
        foundInSection: section,
        matchedVariant: match,
        isWrongSection: true,
        usedRawLayTerm: false,
        negationReversed: false,
        selfContradicted: false
      };
    }
  }

  // Not found anywhere. If this is a pertinent negative, check for a
  // dangerous reversal before concluding it's a plain omission.
  if (requirement.isPertinentNegative) {
    const reversed = detectReversedNegative(
      targetSectionText,
      requirement.acceptableVariants,
      requirement.sourceFact
    );
    if (reversed) {
      return {
        requirement,
        found: false,
        foundInSection: null,
        matchedVariant: null,
        isWrongSection: false,
        usedRawLayTerm: false,
        negationReversed: true,
        selfContradicted: false
      };
    }
  }

  return {
    requirement,
    found: false,
    foundInSection: null,
    matchedVariant: null,
    isWrongSection: false,
    usedRawLayTerm: false,
    negationReversed: false,
    selfContradicted: false
  };
}
