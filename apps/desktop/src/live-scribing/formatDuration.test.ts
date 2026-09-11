import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatDuration.js";

describe("formatDuration", () => {
  it("formats zero as 00:00", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats sub-minute durations", () => {
    expect(formatDuration(45_000)).toBe("00:45");
  });

  it("formats minutes and seconds together", () => {
    expect(formatDuration(125_000)).toBe("02:05");
  });

  it("truncates rather than rounds partial seconds", () => {
    expect(formatDuration(1_999)).toBe("00:01");
  });
});
