import type { CompetencyRecord } from "../competency-engine/index.js";

export interface CompetencyRepository {
  get(domain: string): Promise<CompetencyRecord | undefined>;
  list(): Promise<CompetencyRecord[]>;
  upsert(record: CompetencyRecord): Promise<void>;
}

export class InMemoryCompetencyRepository implements CompetencyRepository {
  private readonly records = new Map<string, CompetencyRecord>();

  async get(domain: string): Promise<CompetencyRecord | undefined> {
    return this.records.get(domain);
  }

  async list(): Promise<CompetencyRecord[]> {
    return Array.from(this.records.values());
  }

  async upsert(record: CompetencyRecord): Promise<void> {
    this.records.set(record.domain, record);
  }
}
