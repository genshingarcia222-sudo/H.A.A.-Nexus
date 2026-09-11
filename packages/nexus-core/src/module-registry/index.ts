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
  scenarioSchemaVersion: string;
  workspaceComponent: TWorkspaceComponent;
  competencyDomains: string[];
}

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
