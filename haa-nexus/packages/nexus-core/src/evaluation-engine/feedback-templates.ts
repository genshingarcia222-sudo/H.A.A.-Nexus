import type { RequirementItem } from "../scenario-engine/types.js";
import type { NumericClinicalMention } from "./numeric-fabrication.js";

export interface Feedback {
  what: string;
  why: string;
  how: string;
}

export function omissionFeedback(requirement: RequirementItem): Feedback {
  return {
    what: `"${requirement.description}" was not documented anywhere in the note.`,
    why: requirement.isPertinentNegative
      ? "Omitting a pertinent negative leaves the differential incomplete for anyone reading the note later."
      : "Required information that isn't documented can't inform downstream care decisions or billing.",
    how: `Document this in the ${requirement.section} section, e.g. "${requirement.acceptableVariants[0]}".`
  };
}

export function wrongSectionFeedback(requirement: RequirementItem, foundInSection: string): Feedback {
  return {
    what: `"${requirement.description}" was documented, but in ${foundInSection} instead of ${requirement.section}.`,
    why: "Information in the wrong section makes the note harder to scan and can be missed by anyone reading only the expected section.",
    how: `Move this into the ${requirement.section} section.`
  };
}

export function incorrectTerminologyFeedback(requirement: RequirementItem, rawTerm: string): Feedback {
  const suggestion = requirement.acceptableVariants[0] ?? "the clinical term";
  return {
    what: `The lay phrase "${rawTerm}" was used instead of standard clinical terminology.`,
    why: "Clinical documentation should use standard terminology so it reads unambiguously to other clinicians.",
    how: `Use "${suggestion}" instead of the patient's own wording.`
  };
}

export function incorrectNegativeFeedback(requirement: RequirementItem): Feedback {
  return {
    what: `"${requirement.description}" appears to have been documented as present, but the encounter states the opposite (${requirement.sourceFact}).`,
    why: "Reversing a pertinent negative into a positive finding is a dangerous documentation error that could misdirect clinical decision-making.",
    how: `Correct this to reflect the negative finding, e.g. "${requirement.acceptableVariants[0]}".`
  };
}

export function fabricationFeedback(mention: NumericClinicalMention): Feedback {
  return {
    what: `A specific value ("${mention.raw}") was documented that the encounter never provided.`,
    why: "Documenting a value that wasn't actually given fabricates clinical information, which can mislead anyone relying on this note.",
    how: "Only document values explicitly provided in the encounter. If a vital or lab wasn't given, don't invent one."
  };
}

export function timeManagementFeedback(elapsedSeconds: number, targetSeconds: number): Feedback {
  return {
    what: `Documentation took ${Math.round(elapsedSeconds)}s, well over the ${targetSeconds}s target for this encounter.`,
    why: "In real clinical settings, documentation speed affects patient throughput and workflow efficiency.",
    how: "Practice this scenario again focusing on capturing required information more directly, with less re-reading or hesitation."
  };
}
