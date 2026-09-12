import { describe, expect, it } from "vitest";
import { NullAIProvider } from "./index.js";

describe("NullAIProvider", () => {
  it("reports AI as unavailable, keeping the MVP core AI-independent", () => {
    expect(new NullAIProvider().isAvailable()).toBe(false);
  });
});
