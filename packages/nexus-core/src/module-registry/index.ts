/**
 * A module is a data contract, not a special-cased code path (Architecture
 * Package, Section 5). Nexus Core must never contain `if (module === 'x')`
 * branches — the registry is the only place modules are looked up by id.
 *
 * `TWorkspaceComponent` is left generic so this package stays UI-framework
 * agnostic; the desktop app supplies its own React component type here.
 */
export interface NexusModule<TWorkspaceComponent = unknown> {
  id: string;
  title: string;
  workspaceComponent: TWorkspaceComponent;
}

/**
 * `competencyDomains` used to sit on this interface and was removed by A2
 * (2026-10-04). It declared 12 section-level labels while the evaluator scored
 * 7 categories, and nothing read it, so the two could never be reconciled by
 * use - only by someone noticing.
 *
 * The domains a competency record is actually keyed by are exported once, as
 * `COMPETENCY_DOMAINS` in the scenario engine, guarded by `satisfies` against
 * `ScoringWeights` so they cannot drift again. A module does not re-declare
 * them: a second copy is what A2 was.
 *
 * Per-section competency (Architecture Package §5's example, §21's list) would
 * be a change to what competency *means* and what a learner is shown, and would
 * need a migration of every stored `CompetencyRecord`. A2 did not make that
 * change; it removed the field that pretended it had already been made.
 */

/**
 * `scenarioSchemaVersion` used to sit on this interface and was removed by A9
 * (2026-10-04). It had been `"0.0.0-unbuilt"` since Phase 1, nothing ever read
 * it, and any value written there would have been a compatibility claim no
 * source defines.
 *
 * Scenario compatibility is real, it just never lived here. It is carried by
 * three mechanisms that are all enforced: the Zod gate in
 * `scenario/validate.ts` rejects a scenario that does not match the domain
 * model; each scenario file declares its own content `version`, which is
 * persisted on `SessionRecord.scenarioVersion` so a past attempt names the
 * content it was scored against; and the content-hash gate (Phase 7 debt A3,
 * cleared) stops a released scenario being edited without a version bump.
 *
 * If a *schema* version is ever needed - a breaking change to the scenario
 * shape itself - it comes back with a policy saying when it increments, what a
 * mismatch does at load time, and what happens to sessions recorded under the
 * old shape. Re-adding the field without that policy is what A9 refused.
 */

export class ModuleRegistry<TWorkspaceComponent = unknown> {
  private readonly modules = new Map<string, NexusModule<TWorkspaceComponent>>();

  register(module: NexusModule<TWorkspaceComponent>): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered.`);
    }
    this.modules.set(module.id, module);
  }

  get(id: string): NexusModule<TWorkspaceComponent> | undefined {
    return this.modules.get(id);
  }

  list(): ReadonlyArray<NexusModule<TWorkspaceComponent>> {
    return Array.from(this.modules.values());
  }
}
