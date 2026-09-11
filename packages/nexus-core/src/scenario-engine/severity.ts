import type { ErrorType, ErrorSeverity } from "./types.js";

/**
 * Severity floors (Architecture Package Section 13): certain error types can
 * never be authored or scored below a minimum severity, regardless of what
 * scenario content or a future evaluator suggests. This is the single
 * source of truth for those floors, shared by content QA (Phase 2) and the
 * evaluation engine (Phase 4) so neither can quietly under-weight a
 * dangerous error type.
 */
export const SEVERITY_FLOORS: Partial<Record<ErrorType, ErrorSeverity>> = {
  fabrication: "major",
  critical_documentation_error: "critical",
  // A pertinent negative reported as a positive is the "dangerous reversal"
  // example the architecture doc calls out under Critical severity - it can
  // never be authored or scored as merely Minor/Major.
  incorrect_negative: "critical"
};

const SEVERITY_RANK: Record<ErrorSeverity, number> = { minor: 0, major: 1, critical: 2 };

/** Returns the higher of the proposed severity and the type's floor, if any. */
export function enforceSeverityFloor(errorType: ErrorType, proposed: ErrorSeverity): ErrorSeverity {
  const floor = SEVERITY_FLOORS[errorType];
  if (!floor) return proposed;
  return SEVERITY_RANK[proposed] >= SEVERITY_RANK[floor] ? proposed : floor;
}
