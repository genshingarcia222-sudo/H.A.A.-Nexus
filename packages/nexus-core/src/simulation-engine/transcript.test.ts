import { describe, expect, it } from "vitest";
import { splitNarrativeIntoBeats, visibleBeats } from "./transcript.js";

describe("splitNarrativeIntoBeats", () => {
  it("splits on sentence-ending punctuation", () => {
    const beats = splitNarrativeIntoBeats("Patient denies fever. He reports a cough. Any pain? No.");
    expect(beats.map((b) => b.text)).toEqual([
      "Patient denies fever.",
      "He reports a cough.",
      "Any pain?",
      "No."
    ]);
  });

  it("assigns stable sequential ids", () => {
    const beats = splitNarrativeIntoBeats("One. Two. Three.");
    expect(beats.map((b) => b.id)).toEqual(["beat-1", "beat-2", "beat-3"]);
  });

  it("handles a single-sentence narrative", () => {
    expect(splitNarrativeIntoBeats("Just one sentence.")).toHaveLength(1);
  });

  it("ignores stray whitespace between sentences", () => {
    const beats = splitNarrativeIntoBeats("First.   Second.");
    expect(beats).toHaveLength(2);
  });
});

describe("visibleBeats", () => {
  const beats = splitNarrativeIntoBeats("One. Two. Three.");

  it("reveals only the requested count", () => {
    expect(visibleBeats(beats, 2)).toHaveLength(2);
  });

  it("clamps to the total beat count", () => {
    expect(visibleBeats(beats, 99)).toHaveLength(3);
  });

  it("clamps negative counts to zero", () => {
    expect(visibleBeats(beats, -1)).toHaveLength(0);
  });
});
