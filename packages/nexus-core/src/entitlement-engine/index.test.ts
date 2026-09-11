import { describe, expect, it } from "vitest";
import { EntitlementService } from "./index.js";
import { DEFAULT_ENTITLEMENTS } from "../types/entitlements.js";

describe("EntitlementService", () => {
  it("defaults every local MVP user to FREE-tier access", () => {
    const service = new EntitlementService();
    expect(service.can("canUseSimulation")).toBe(true);
    expect(service.can("canUseAI")).toBe(false);
    expect(service.can("canUseCloudSync")).toBe(false);
    expect(service.can("canAccessPremiumModules")).toBe(false);
  });

  it("accepts an explicit entitlement set (for future subscription tiers)", () => {
    const premium = new EntitlementService({
      ...DEFAULT_ENTITLEMENTS,
      canUseAI: true,
      canUseCloudSync: true
    });
    expect(premium.can("canUseAI")).toBe(true);
    expect(premium.can("canUseCloudSync")).toBe(true);
    // Everything not explicitly upgraded stays at its default value.
    expect(premium.can("canAccessPremiumModules")).toBe(false);
  });

  it("all() returns the full set without exposing tier logic", () => {
    const service = new EntitlementService();
    expect(service.all()).toEqual(DEFAULT_ENTITLEMENTS);
  });
});
