import type { CompetencyRecord } from "../competency-engine/index.js";
import type { ResultPopulation } from "../types/result-population.js";

/**
 * Practice and Assessment competency are separate populations (D5), so a
 * record is identified by population *and* domain. Every read states which
 * population it wants: there is no call that returns "the" record for a
 * domain, because there is no longer one.
 */
function keyOf(population: ResultPopulation, domain: string): string {
  return `${population}:${domain}`;
}

export interface CompetencyRepository {
  get(population: ResultPopulation, domain: string): Promise<CompetencyRecord | undefined>;
  /** Every record across every population; callers filter by `record.population`. */
  list(): Promise<CompetencyRecord[]>;
  upsert(record: CompetencyRecord): Promise<void>;
  /**
   * Writes several records as one unit.
   *
   * An attempt is folded into every competency domain or into none of them.
   * Writing them one at a time means a failure partway through leaves an
   * attempt counted in some domains and not others - and because submitting
   * is idempotent, a retry finds the session already completed and never
   * finishes the fold, so the inconsistency is permanent.
   *
   * Implementations must make this atomic where their storage allows it.
   */
  upsertMany(records: readonly CompetencyRecord[]): Promise<void>;
}

export class InMemoryCompetencyRepository implements CompetencyRepository {
  private readonly records = new Map<string, CompetencyRecord>();

  async get(population: ResultPopulation, domain: string): Promise<CompetencyRecord | undefined> {
    return this.records.get(keyOf(population, domain));
  }

  async list(): Promise<CompetencyRecord[]> {
    return Array.from(this.records.values());
  }

  async upsert(record: CompetencyRecord): Promise<void> {
    this.records.set(keyOf(record.population, record.domain), record);
  }

  /** Test support, mirroring `InMemorySessionRepository.clear()`. */
  clear(): void {
    this.records.clear();
  }

  async upsertMany(records: readonly CompetencyRecord[]): Promise<void> {
    // Nothing to stage: this loop is synchronous, so no caller can observe it
    // partway through. The real all-or-nothing guarantee belongs to the
    // SQLite-backed repository, which writes the batch in one transaction.
    for (const record of records) this.records.set(keyOf(record.population, record.domain), record);
  }
}
