import { describe, expect, it } from "vitest";
import { extractNumericClinicalMentions, findUnsupportedNumericMentions } from "./numeric-fabrication.js";

describe("extractNumericClinicalMentions", () => {
  it("extracts a temperature value", () => {
    expect(extractNumericClinicalMentions("Temperature 37.0°C.")).toEqual([{ raw: "37.0°C", key: "37.0c" }]);
  });

  it("extracts heart rate, blood pressure, and O2 sat", () => {
    const mentions = extractNumericClinicalMentions("HR 110 bpm, BP 120/80 mmHg, O2 sat 98%.");
    expect(mentions.map((m) => m.key)).toEqual(["110bpm", "80mmhg", "98%"]);
  });

  it("finds nothing in plain prose", () => {
    expect(extractNumericClinicalMentions("Patient denies fever and chest pain.")).toEqual([]);
  });
});

describe("findUnsupportedNumericMentions - the spec's canonical fabrication example", () => {
  it("flags a temperature the encounter never provided", () => {
    const encounterText = "Patient denies fever. No other vitals given.";
    const documented = "Temperature 37.0°C, no fever.";
    const unsupported = findUnsupportedNumericMentions(documented, encounterText);
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]!.key).toBe("37.0c");
  });

  it("does not flag a value that the encounter actually provided", () => {
    const encounterText = "Vitals: Temp 38.2C, HR 100 bpm.";
    const documented = "Temp 38.2C noted, tachycardic at 100 bpm.";
    expect(findUnsupportedNumericMentions(documented, encounterText)).toEqual([]);
  });

  it("returns an empty array when the documentation has no numeric mentions at all", () => {
    expect(findUnsupportedNumericMentions("No fever, no chest pain.", "Patient denies fever.")).toEqual([]);
  });
});
