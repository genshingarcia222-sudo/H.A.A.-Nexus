import { invoke } from "@tauri-apps/api/core";
import type { CompetencyRecord, ResultPopulation } from "@haa-nexus/nexus-core";
import type { CompetencyRepository } from "@haa-nexus/nexus-core";

export class TauriCompetencyRepository implements CompetencyRepository {
  async get(population: ResultPopulation, domain: string): Promise<CompetencyRecord | undefined> {
    // One indexed lookup rather than listing every record to find one
    // (Phase 7 accepted debt A10); submit calls this once per domain.
    // Population is part of the key (D5), not a filter applied afterwards.
    const record = await invoke<CompetencyRecord | null>("get_competency_record", { population, domain });
    return record ?? undefined;
  }

  async list(): Promise<CompetencyRecord[]> {
    return invoke<CompetencyRecord[]>("list_competency_records");
  }

  async upsert(record: CompetencyRecord): Promise<void> {
    await invoke("upsert_competency_record", { record });
  }

  async upsertMany(records: readonly CompetencyRecord[]): Promise<void> {
    // One command, one SQLite transaction: the whole fold lands or none of it.
    await invoke("upsert_competency_records", { records });
  }
}
