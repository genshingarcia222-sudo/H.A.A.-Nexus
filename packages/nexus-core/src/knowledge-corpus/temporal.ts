import { z } from "zod";

/**
 * When a record is true (D12-23, D12-24).
 *
 * **Temporal state is computed, never stored.** A record carries dates; whether
 * it is future, current or expired is derived at the date you ask about. The
 * alternative — writing "current" into a record — makes a release go stale
 * because a calendar day passed rather than because content changed, and makes
 * every rollover a migration.
 *
 * Windows are inclusive at both ends and may be open on either side.
 */

export const TEMPORAL_STATES = ["FUTURE_EFFECTIVE", "CURRENT", "EXPIRED", "IMPOSSIBLE"] as const;
export type TemporalState = (typeof TEMPORAL_STATES)[number];

/** Which records a request is willing to receive (D12-23). */
export const TEMPORAL_MODES = ["CURRENT_ONLY", "INCLUDE_FUTURE", "HISTORICAL"] as const;
export type TemporalMode = (typeof TEMPORAL_MODES)[number];

export interface EffectiveWindow {
  from?: string | undefined;
  to?: string | undefined;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** ISO dates sort lexicographically, which is why they are the storage form. */
export function isIsoDate(value: string): boolean {
  return isoDate.safeParse(value).success;
}

/**
 * The overlap of several windows.
 *
 * An item is only true while *everything it rests on* is true: its own window,
 * its case context's, and every source it cites. Intersecting rather than
 * trusting the item's own dates is what stops a question about next year's
 * guidelines being served as this year's.
 */
export function intersectWindows(windows: EffectiveWindow[]): EffectiveWindow {
  let from: string | undefined;
  let to: string | undefined;
  for (const window of windows) {
    if (window.from && (!from || window.from > from)) from = window.from;
    if (window.to && (!to || window.to < to)) to = window.to;
  }
  return { from, to };
}

/** Whether a window can ever be open. An empty window is an authoring error. */
export function isImpossible(window: EffectiveWindow): boolean {
  return Boolean(window.from && window.to && window.from > window.to);
}

/**
 * The state of a window on a date.
 *
 * `asOf` is always supplied by the caller. Nothing in this module reads the
 * clock: a deterministic build and a reproducible selection both depend on the
 * date being an input, not an ambient fact.
 */
export function temporalState(window: EffectiveWindow, asOf: string): TemporalState {
  if (isImpossible(window)) return "IMPOSSIBLE";
  if (window.from && asOf < window.from) return "FUTURE_EFFECTIVE";
  if (window.to && asOf > window.to) return "EXPIRED";
  return "CURRENT";
}

/** Whether a delivery mode accepts a state. */
export function modeAccepts(mode: TemporalMode, state: TemporalState): boolean {
  if (state === "IMPOSSIBLE") return false;
  switch (mode) {
    case "CURRENT_ONLY":
      return state === "CURRENT";
    case "INCLUDE_FUTURE":
      return state === "CURRENT" || state === "FUTURE_EFFECTIVE";
    case "HISTORICAL":
      // The caller has already moved `asOf` to the past date it cares about;
      // what it wants is what was current *then*.
      return state === "CURRENT";
    default:
      return false;
  }
}

/** Days between two ISO dates, positive when `later` is after `earlier`. */
export function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface UpcomingTransition {
  id: string;
  /** The state it will move to. */
  becomes: Extract<TemporalState, "CURRENT" | "EXPIRED">;
  on: string;
  inDays: number;
}

/**
 * Records whose state changes within `withinDays` of `asOf`.
 *
 * The release build reports these so re-verification can be scheduled *before*
 * content expires, rather than discovered by a learner meeting an empty pool.
 */
export function upcomingTransitions(
  records: { id: string; window: EffectiveWindow }[],
  asOf: string,
  withinDays = 60
): UpcomingTransition[] {
  const transitions: UpcomingTransition[] = [];
  for (const record of records) {
    const { from, to } = record.window;
    if (from && from > asOf) {
      const inDays = daysBetween(asOf, from);
      if (inDays <= withinDays) transitions.push({ id: record.id, becomes: "CURRENT", on: from, inDays });
    }
    if (to && to >= asOf) {
      const inDays = daysBetween(asOf, to);
      if (inDays <= withinDays) transitions.push({ id: record.id, becomes: "EXPIRED", on: to, inDays });
    }
  }
  return transitions.sort((a, b) => a.inDays - b.inDays || a.id.localeCompare(b.id));
}
