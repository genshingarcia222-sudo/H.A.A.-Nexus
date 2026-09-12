import { documentationSection } from "../scenario-engine/schema.js";
import type { DocumentationSection } from "../scenario-engine/types.js";

export type DocumentationDraft = Record<DocumentationSection, string>;

/** Built from the canonical section enum so this can never drift from the scenario schema's section list. */
export function createEmptyDraft(): DocumentationDraft {
  return Object.fromEntries(documentationSection.options.map((section) => [section, ""])) as DocumentationDraft;
}

export function updateDraftField(
  draft: DocumentationDraft,
  section: keyof DocumentationDraft,
  value: string
): DocumentationDraft {
  return { ...draft, [section]: value };
}

/** Used to decide whether to warn before submitting a fully blank note (never to block submission - see edge case testing requirements). */
export function isDraftEmpty(draft: DocumentationDraft): boolean {
  return Object.values(draft).every((value) => value.trim().length === 0);
}
