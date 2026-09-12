import { describe, expect, it } from "vitest";
import { createEmptyDraft, updateDraftField, isDraftEmpty } from "./documentation-draft.js";

describe("documentation draft", () => {
  it("creates a draft with every section blank", () => {
    const draft = createEmptyDraft();
    expect(Object.values(draft).every((v) => v === "")).toBe(true);
    expect(Object.keys(draft)).toContain("hpi");
  });

  it("updates a single field without touching others", () => {
    const draft = createEmptyDraft();
    const updated = updateDraftField(draft, "hpi", "Onset 3 days ago.");
    expect(updated.hpi).toBe("Onset 3 days ago.");
    expect(updated.ros).toBe("");
  });

  it("reports an all-blank draft as empty", () => {
    expect(isDraftEmpty(createEmptyDraft())).toBe(true);
  });

  it("reports a draft with any content as non-empty", () => {
    const draft = updateDraftField(createEmptyDraft(), "plan", "Follow up in 1 week.");
    expect(isDraftEmpty(draft)).toBe(false);
  });

  it("treats whitespace-only content as still empty", () => {
    const draft = updateDraftField(createEmptyDraft(), "plan", "   ");
    expect(isDraftEmpty(draft)).toBe(true);
  });
});
