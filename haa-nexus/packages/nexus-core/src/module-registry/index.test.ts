import { describe, expect, it } from "vitest";
import { ModuleRegistry, type NexusModule } from "./index.js";

const liveScribing: NexusModule<string> = {
  id: "live-scribing",
  title: "Live Scribing",
  scenarioSchemaVersion: "1.0",
  workspaceComponent: "LiveScribingWorkspace", // stand-in for a React component in this test
  competencyDomains: ["HPI", "ROS", "Terminology"]
};

describe("ModuleRegistry", () => {
  it("registers and retrieves a module by id", () => {
    const registry = new ModuleRegistry<string>();
    registry.register(liveScribing);
    expect(registry.get("live-scribing")).toEqual(liveScribing);
  });

  it("returns undefined for an unknown module id rather than throwing", () => {
    const registry = new ModuleRegistry<string>();
    expect(registry.get("medical-billing")).toBeUndefined();
  });

  it("refuses to register a duplicate module id", () => {
    const registry = new ModuleRegistry<string>();
    registry.register(liveScribing);
    expect(() => registry.register(liveScribing)).toThrow(/already registered/);
  });

  it("lists every registered module", () => {
    const registry = new ModuleRegistry<string>();
    registry.register(liveScribing);
    expect(registry.list()).toHaveLength(1);
  });
});
