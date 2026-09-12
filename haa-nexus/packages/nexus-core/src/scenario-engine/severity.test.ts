import { describe, expect, it } from "vitest";
import { enforceSeverityFloor } from "./severity.js";

describe("enforceSeverityFloor", () => {
  it("raises fabrication from minor to its major floor", () => {
    expect(enforceSeverityFloor("fabrication", "minor")).toBe("major");
  });

  it("does not lower a severity already above the floor", () => {
    expect(enforceSeverityFloor("fabrication", "critical")).toBe("critical");
  });

  it("leaves error types with no floor untouched", () => {
    expect(enforceSeverityFloor("formatting", "minor")).toBe("minor");
  });

  it("always forces critical_documentation_error to critical", () => {
    expect(enforceSeverityFloor("critical_documentation_error", "minor")).toBe("critical");
  });

  it("always forces incorrect_negative (a reversed pertinent negative) to critical", () => {
    expect(enforceSeverityFloor("incorrect_negative", "minor")).toBe("critical");
  });
});
