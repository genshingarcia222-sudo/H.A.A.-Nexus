import {
  DEFAULT_ENTITLEMENTS,
  type BooleanEntitlementKey,
  type Entitlements
} from "../types/entitlements.js";
import type { SubscriptionState } from "../types/subscription.js";
import type { DifficultyLevel } from "../scenario-engine/difficulty.js";
import { canAccessDifficulty, resolveEntitlements } from "./resolve.js";

export * from "./capability-matrix.js";
export * from "./resolve.js";
export * from "./training-envelopes.js";

export class EntitlementService {
  private readonly entitlements: Entitlements;

  constructor(entitlements: Entitlements = DEFAULT_ENTITLEMENTS) {
    this.entitlements = entitlements;
  }

  /**
   * Builds a service from a subscription state - the path commercial code
   * should use. Kept as a factory rather than a second constructor
   * signature so the existing `new EntitlementService(entitlements)` form
   * keeps working untouched.
   */
  static fromSubscription(state: SubscriptionState, now: number): EntitlementService {
    return new EntitlementService(resolveEntitlements(state, now));
  }

  /**
   * The only method UI code should call for a yes/no capability. Never
   * branch on tier directly.
   *
   * Limited to the boolean-valued keys; numeric/enum limits such as
   * `maxScenarioDifficulty` are read off `all()` or answered by a purpose-
   * built method like `canAccessDifficulty` below.
   */
  can(key: BooleanEntitlementKey): boolean {
    return this.entitlements[key];
  }

  /** Whether a scenario of this difficulty is unlocked for the current entitlements. */
  canAccessDifficulty(difficulty: DifficultyLevel): boolean {
    return canAccessDifficulty(this.entitlements, difficulty);
  }

  all(): Readonly<Entitlements> {
    return this.entitlements;
  }
}
