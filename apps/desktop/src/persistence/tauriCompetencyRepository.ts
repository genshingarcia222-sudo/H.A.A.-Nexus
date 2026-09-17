import { invoke } from "@tauri-apps/api/core";
import type { CompetencyRecord } from "@haa-nexus/nexus-core";
import type { CompetencyRepository } from "@haa-nexus/nexus-core";

export class TauriCompetencyRepository implements CompetencyRepository {
  async get(domain: string): Promise<CompetencyRecord | undefined> {
    // One indexed lookup rather than listing every record to find one
    // (Phase 7 accepted debt A10); submit calls this once per domain.
    const record = await invoke<CompetencyRecord | null>("get_competency_record", { domain });
    return record ?? undefined;
  }

  async list(): Promise<CompetencyRecord[]> {
    return invoke<CompetencyRecord[]>("list_competency_records");
  }

  async upsert(record: CompetencyRecord): Promise<void> {
    await invoke("upsert_competency_record", { record });
  }
}
