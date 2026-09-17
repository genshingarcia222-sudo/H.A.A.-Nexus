import { useMemo } from "react";
import { create } from "zustand";
import {
  NO_SUBSCRIPTION,
  resolveEntitlements,
  type Entitlements,
  type SubscriptionState
} from "@haa-nexus/nexus-core";

/**
 * The desktop app's single source of subscription state.
 *
 * THIS IS NOT BILLING TRUTH. No subscription persistence, payment provider,
 * or account system exists yet (Phase 8.2 deliberately stops short of all
 * three). Every learner therefore starts - and, in production, stays - at
 * `NO_SUBSCRIPTION`, which resolves to exactly the Free tier.
 *
 * That default is the safe direction by design: a missing subscription can
 * only ever resolve to the *least* access, never to more. There is no code
 * path here that defaults anyone to Practice, Pro or Fast-Track.
 *
 * `setSubscription` exists so tests can exercise every tier. It is not
 * wired to any UI, any persisted value, or any environment variable, so it
 * cannot silently become production policy. When subscription persistence
 * lands, it replaces this store's *initial value and setter source* - every
 * consumer below already reads through `resolveEntitlements`, so none of
 * them needs to change.
 */
interface EntitlementStoreState {
  subscription: SubscriptionState;
  setSubscription: (subscription: SubscriptionState) => void;
}

export const useEntitlementStore = create<EntitlementStoreState>((set) => ({
  subscription: NO_SUBSCRIPTION,
  setSubscription: (subscription) => set({ subscription })
}));

/**
 * Resolves the current entitlements outside React - for enforcement code
 * such as `sessionStore.start`.
 *
 * The clock is read here, at the application boundary, and passed into the
 * pure resolver. `nexus-core` itself never reads ambient time.
 */
export function currentEntitlements(now: number = Date.now()): Entitlements {
  return resolveEntitlements(useEntitlementStore.getState().subscription, now);
}

/**
 * Resolves entitlements once per subscription change for a component tree,
 * so a list of N scenarios performs one resolution and N cheap comparisons
 * rather than N resolutions.
 */
export function useEntitlements(): Entitlements {
  const subscription = useEntitlementStore((s) => s.subscription);
  return useMemo(() => resolveEntitlements(subscription, Date.now()), [subscription]);
}
