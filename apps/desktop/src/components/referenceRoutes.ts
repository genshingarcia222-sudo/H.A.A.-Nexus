/**
 * The learner-facing reference surfaces, in one place.
 *
 * Decision D4 closes these during an active assessment. Two files need to
 * agree on which routes those are - the router, which guards them, and the nav
 * rail, which hides their links - and a list they both import is the only way
 * that agreement cannot quietly drift when a third reference surface is added.
 *
 * This is a list of *runtime learner surfaces*, not of content. The scenario,
 * terminology, lesson and question-bank repositories that feed them are
 * authoring and content infrastructure; D4 governs what a learner may open
 * mid-attempt, and never restricts the content archive itself.
 */
export const REFERENCE_ROUTES: Record<string, string> = {
  "/training": "Training",
  "/knowledge-base": "The Knowledge Base"
};

export function isReferenceRoute(path: string): boolean {
  return Object.hasOwn(REFERENCE_ROUTES, path);
}
