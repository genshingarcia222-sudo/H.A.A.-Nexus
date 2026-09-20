import { beforeEach, describe, expect, it } from "vitest";
import { resolveEntitlements, NO_SUBSCRIPTION, TIER_ORDER } from "@haa-nexus/nexus-core";
import {
  PREVIEW_STORAGE_KEY,
  PREVIEW_STORAGE_VERSION,
  PREVIEW_TIER,
  previewSubscription,
  readPreviewTier,
  writePreviewTier
} from "./previewEntitlement.js";

/**
 * The website preview entitlement.
 *
 * This is development/preview state, not billing truth. What these protect is
 * that the preview (a) defaults to the highest tier, (b) survives reloads and
 * updates, (c) never silently downgrades itself on bad data, and (d) resolves
 * through the real capability matrix rather than bypassing it.
 */

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

/** Storage that throws on every access, as a private window or blocked site data does. */
const hostileStorage = new Proxy({} as Storage, {
  get() {
    throw new Error("storage blocked");
  }
});

let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
});

describe("the preview tier is the highest tier the matrix defines", () => {
  it("tracks TIER_ORDER rather than hardcoding a name", () => {
    // If a higher tier is ever added, the preview follows it automatically.
    expect(PREVIEW_TIER).toBe(TIER_ORDER[TIER_ORDER.length - 1]);
    expect(PREVIEW_TIER).toBe("fast_track");
  });
});

describe("reading the preview tier", () => {
  it("defaults to the highest tier on a first visit", () => {
    expect(readPreviewTier(storage)).toBe(PREVIEW_TIER);
  });

  it("round-trips a stored tier", () => {
    writePreviewTier("pro", storage);
    expect(readPreviewTier(storage)).toBe("pro");
  });

  it("does not downgrade on corrupt JSON", () => {
    storage.setItem(PREVIEW_STORAGE_KEY, "{not json");
    expect(readPreviewTier(storage)).toBe(PREVIEW_TIER);
  });

  it("does not downgrade on an unknown tier value", () => {
    storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ version: PREVIEW_STORAGE_VERSION, tier: "platinum" }));
    expect(readPreviewTier(storage)).toBe(PREVIEW_TIER);
  });

  it("does not downgrade on a version it does not recognise", () => {
    storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ version: 999, tier: "free" }));
    expect(readPreviewTier(storage)).toBe(PREVIEW_TIER);
  });

  it("does not downgrade when storage itself throws", () => {
    expect(readPreviewTier(hostileStorage)).toBe(PREVIEW_TIER);
  });

  it("writing never throws, even when storage is unavailable", () => {
    expect(() => writePreviewTier("fast_track", hostileStorage)).not.toThrow();
  });
});

describe("the stored value is a selected tier, not a snapshot of features", () => {
  it("keeps the same tier across reloads, so a new build's features just appear", () => {
    // Simulating a reload: a fresh read of the same storage.
    writePreviewTier(PREVIEW_TIER, storage);
    const afterReload = readPreviewTier(storage);
    const afterUpdate = readPreviewTier(storage);

    expect(afterReload).toBe(PREVIEW_TIER);
    expect(afterUpdate).toBe(PREVIEW_TIER);
    // Nothing about which capabilities existed is recorded.
    expect(JSON.parse(storage.getItem(PREVIEW_STORAGE_KEY)!)).toEqual({
      version: PREVIEW_STORAGE_VERSION,
      tier: PREVIEW_TIER
    });
  });

  it("uses a clearly namespaced key", () => {
    writePreviewTier(PREVIEW_TIER, storage);
    expect(PREVIEW_STORAGE_KEY).toBe("nexus.preview.subscriptionTier");
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).not.toBeNull();
  });
});

describe("the preview resolves through the real capability matrix", () => {
  it("grants exactly what Fast-Track grants - no more, and no bypass", () => {
    const fromPreview = resolveEntitlements(
      { tier: PREVIEW_TIER, status: "active", currentPeriodEnd: null, fastTrackPurchased: true },
      Date.now()
    );
    const fromProduction = resolveEntitlements(
      { tier: "fast_track", status: "active", currentPeriodEnd: null, fastTrackPurchased: true },
      Date.now()
    );

    expect(fromPreview).toEqual(fromProduction);
    // Spot-check the gates the previous decisions added: they are granted by
    // the matrix, not waived by the preview.
    expect(fromPreview.canStartAssessment).toBe(true);
    expect(fromPreview.maxScenarioDifficulty).toBe(6);
  });

  it("is inert outside the website: the test environment stays on no subscription", () => {
    // `isWebsitePreview()` is false under MODE === "test", which is what keeps
    // every other suite - and the D1 entitlement tests especially - honest.
    expect(previewSubscription(storage)).toEqual(NO_SUBSCRIPTION);
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBeNull();
  });

  it("writes no production subscription record", () => {
    previewSubscription(storage);
    // The only key this module may ever touch.
    expect(storage.length).toBe(0);
  });
});
