/**
 * Provider-independent AI abstraction (Architecture Package, Section 23).
 * The MVP wires NullAIProvider unconditionally. No method here may be
 * called by evaluation or scoring logic to invent a clinical fact that
 * isn't already present in scenario data — future providers are expected
 * to be constrained to scenario context, not general knowledge.
 */
export interface AIServiceProvider {
  isAvailable(): boolean;
}

export class NullAIProvider implements AIServiceProvider {
  isAvailable(): boolean {
    return false;
  }
}
