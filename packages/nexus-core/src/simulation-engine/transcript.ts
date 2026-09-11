export interface TranscriptBeat {
  id: string;
  text: string;
}

/**
 * Splits a narrative into sentence-level beats for progressive reveal.
 * Deliberately simple (split on sentence-ending punctuation) — this is the
 * deterministic MVP approach the architecture doc calls for; a future audio
 * pipeline (Section 10) would replace the source of beats, not this
 * consuming logic.
 */
export function splitNarrativeIntoBeats(narrative: string): TranscriptBeat[] {
  const sentences = narrative
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.map((text, index) => ({ id: `beat-${index + 1}`, text }));
}

/** How many beats should currently be visible, given a reveal cursor position. Clamped to the beat count. */
export function visibleBeats(beats: TranscriptBeat[], revealedCount: number): TranscriptBeat[] {
  return beats.slice(0, Math.max(0, Math.min(revealedCount, beats.length)));
}
