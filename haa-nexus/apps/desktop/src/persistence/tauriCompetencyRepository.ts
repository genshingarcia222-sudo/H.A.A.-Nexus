import { invoke } from "@tauri-apps/api/core";
import type { CompetencyRecord } from "@haa-nexus/nexus-core";
import type { CompetencyRepository } from "@haa-nexus/nexus-core";

export class TauriCompetencyRepository implements CompetencyRepository {
  async get(domain: string): Promise<CompetencyRecord | undefined> {
    const all = await this.list();
    return all.find((r) => r.domain === domain);
  }

  async list(): Promise<CompetencyRecord[]> {
    return invoke<CompetencyRecord[]>("list_competency_records");
  }

  async upsert(record: CompetencyRecord): Promise<void> {
    await invoke("upsert_competency_record", { record });
  }
}
