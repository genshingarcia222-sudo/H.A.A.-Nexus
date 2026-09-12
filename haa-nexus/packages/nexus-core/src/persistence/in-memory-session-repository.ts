import type { SessionRecord, SessionRepository } from "./types.js";

export class InMemorySessionRepository implements SessionRepository {
  private readonly records = new Map<string, SessionRecord>();

  async save(record: SessionRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.records.get(id);
  }

  async list(): Promise<SessionRecord[]> {
    return Array.from(this.records.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  async findInterrupted(): Promise<SessionRecord[]> {
    return Array.from(this.records.values()).filter(
      (r) => r.status === "in_progress" || r.status === "paused"
    );
  }

  /** Test-only convenience - not part of the SessionRepository interface, since clearing all data isn't a real product operation. */
  clear(): void {
    this.records.clear();
  }
}
