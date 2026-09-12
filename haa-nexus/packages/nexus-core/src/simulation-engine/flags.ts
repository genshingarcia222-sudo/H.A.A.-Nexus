import type { FlagType, SimulationSession } from "./types.js";

/**
 * Flags can only be added while the encounter is live (in_progress) — a
 * completed or paused review isn't "flagging during the encounter"
 * (Architecture Package Section 43).
 */
export function addFlag(
  session: SimulationSession,
  beatId: string,
  flagType: FlagType,
  now: number
): SimulationSession {
  if (session.status !== "in_progress") {
    throw new Error(`Cannot flag a beat while session status is "${session.status}".`);
  }
  return {
    ...session,
    flags: [...session.flags, { beatId, flagType, timestamp: now }]
  };
}
