import { NO_SUBSCRIPTION, TIER_ORDER, type SubscriptionState, type Tier } from "@haa-nexus/nexus-core";
import { isTauriRuntime } from "../persistence/environment.js";

/**
 * WEBSITE PREVIEW ENTITLEMENT — development/preview only.
 *
 * The browser build runs as a highest-tier **preview client** so that
 * implemented paid features can be seen without a subscription system. This is
 * not billing truth and not a purchase: it records *which tier this browser is
 * previewing*, nothing more.
 *
 * It deliberately reuses the production path rather than bypassing it:
 *
 *     stored preview tier → SubscriptionState → resolveEntitlements → capabilities
 *
 * So a feature is visible here only if the real capability matrix grants it to
 * that tier. There is no feature-specific bypass, no forked matrix, and no
 * weakened capability rule - if a gate is wrong, the preview shows it as
 * wrong.
 *
 * It is confined to the website: the Tauri desktop shell and the test
 * environment both fall through to `NO_SUBSCRIPTION` (Free), exactly as
 * before, so no production or test behaviour changes.
 */

/** The highest tier the capability matrix currently defines. */
export const PREVIEW_TIER: Tier = TIER_ORDER[TIER_ORDER.length - 1]!;

export const PREVIEW_STORAGE_KEY = "nexus.preview.subscriptionTier";
export const PREVIEW_STORAGE_VERSION = 1;

interface StoredPreview {
  version: number;
  tier: Tier;
}

/**
 * Whether this runtime is the website preview client.
 *
 * `MODE !== "test"` matters: jsdom supplies `localStorage` and reports no
 * Tauri global, so without it every desktop test would silently start at
 * Fast-Track and the D1 entitlement tests would stop testing anything.
 */
export function isWebsitePreview(): boolean {
  return (
    import.meta.env?.MODE !== "test" && !isTauriRuntime() && typeof globalThis.localStorage !== "undefined"
  );
}

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIER_ORDER as readonly string[]).includes(value);
}

/**
 * The preview tier for this browser, defaulting to the highest tier.
 *
 * Missing, unreadable, corrupt, or version-mismatched state all resolve to the
 * preview tier rather than downgrading: stale storage must never silently
 * demote the preview client to Free and hide the features it exists to show.
 */
export function readPreviewTier(storage: Storage = globalThis.localStorage): Tier {
  try {
    const raw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return PREVIEW_TIER;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as StoredPreview).version === PREVIEW_STORAGE_VERSION &&
      isTier((parsed as StoredPreview).tier)
    ) {
      return (parsed as StoredPreview).tier;
    }
    return PREVIEW_TIER;
  } catch {
    return PREVIEW_TIER;
  }
}

/** Persists the preview tier. A storage failure is never fatal to the app. */
export function writePreviewTier(tier: Tier, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ version: PREVIEW_STORAGE_VERSION, tier }));
  } catch {
    /* a preview that cannot persist still works for this session */
  }
}

/**
 * The subscription state the preview should resolve through, or
 * `NO_SUBSCRIPTION` when this is not the website.
 *
 * The stored value is the *selected preview tier*, not a snapshot of which
 * features existed when it was written - so a newer build's Fast-Track
 * features appear automatically, with no reactivation.
 */
export function previewSubscription(storage?: Storage): SubscriptionState {
  if (!isWebsitePreview()) return NO_SUBSCRIPTION;

  const store = storage ?? globalThis.localStorage;
  const tier = readPreviewTier(store);
  // Re-persist on every load: it seeds a first visit and repairs corrupt or
  // outdated state in place, so the preview survives updates untouched.
  writePreviewTier(tier, store);

  return {
    tier,
    status: "active",
    currentPeriodEnd: null,
    fastTrackPurchased: tier === "fast_track"
  };
}
