import { DEFAULT_ENTITLEMENTS, type Entitlements } from "../types/entitlements.js";

export class EntitlementService {
  private readonly entitlements: Entitlements;

  constructor(entitlements: Entitlements = DEFAULT_ENTITLEMENTS) {
    this.entitlements = entitlements;
  }

  /** The only method UI code should call. Never branch on tier directly. */
  can(key: keyof Entitlements): boolean {
    return this.entitlements[key];
  }

  all(): Readonly<Entitlements> {
    return this.entitlements;
  }
}
