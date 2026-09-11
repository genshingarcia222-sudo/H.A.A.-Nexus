import { describe, expect, it } from "vitest";
import { startSession, pauseSession } from "./session-machine.js";
import { addFlag } from "./flags.js";

const PARAMS = { id: "s1", scenarioId: "SCRIBE-FM-014", scenarioVersion: "1.0", mode: "simulation" as const };

describe("addFlag", () => {
  it("appends a flag while the session is in_progress", () => {
    const session = startSession(PARAMS, 0);
    const flagged = addFlag(session, "beat-2", "uncertain", 500);
    expect(flagged.flags).toEqual([{ beatId: "beat-2", flagType: "uncertain", timestamp: 500 }]);
  });

  it("preserves prior flags when adding another", () => {
    let session = startSession(PARAMS, 0);
    session = addFlag(session, "beat-1", "important", 100);
    session = addFlag(session, "beat-3", "review_later", 200);
    expect(session.flags).toHaveLength(2);
  });

  it("refuses to flag a paused session", () => {
    let session = startSession(PARAMS, 0);
    session = pauseSession(session, 100);
    expect(() => addFlag(session, "beat-1", "important", 200)).toThrow(/status is "paused"/);
  });
});
