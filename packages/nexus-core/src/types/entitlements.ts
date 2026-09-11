/**
 * Entitlement keys gate features. UI code must only ever call
 * EntitlementService.can(key) — it must never branch on subscription tier
 * directly (see Architecture Package, Section 25).
 */
export interface Entitlements {
  canUseSimulation: boolean;
  canUseAdvancedScenarios: boolean;
  canUseAI: boolean;
  canUseCloudSync: boolean;
  canUseAdvancedAnalytics: boolean;
  canAccessPremiumModules: boolean;
}

/**
 * MVP default: every local user is effectively on the FREE tier, with no
 * subscription record backing it yet (Phase 12 introduces real tiers).
 * This is intentionally the ONLY place these booleans are hardcoded.
 */
export const DEFAULT_ENTITLEMENTS: Entitlements = {
  canUseSimulation: true,
  canUseAdvancedScenarios: false,
  canUseAI: false,
  canUseCloudSync: false,
  canUseAdvancedAnalytics: false,
  canAccessPremiumModules: false
};
