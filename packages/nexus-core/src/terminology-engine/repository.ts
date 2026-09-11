import type { TerminologyEntry } from "./schema.js";

export interface TerminologyRepository {
  get(id: string): TerminologyEntry | undefined;
  list(): TerminologyEntry[];
  /** Matches against layTerm, clinicalTerm, and acceptedAlternatives - case-insensitive substring. */
  search(query: string): TerminologyEntry[];
}

export class InMemoryTerminologyRepository implements TerminologyRepository {
  private readonly entries = new Map<string, TerminologyEntry>();

  register(entry: TerminologyEntry): void {
    if (this.entries.has(entry.id)) {
      throw new Error(`Terminology entry "${entry.id}" is already registered.`);
    }
    this.entries.set(entry.id, entry);
  }

  get(id: string): TerminologyEntry | undefined {
    return this.entries.get(id);
  }

  list(): TerminologyEntry[] {
    return Array.from(this.entries.values());
  }

  search(query: string): TerminologyEntry[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return this.list();
    return this.list().filter(
      (e) =>
        e.layTerm.toLowerCase().includes(q) ||
        e.clinicalTerm.toLowerCase().includes(q) ||
        e.acceptedAlternatives.some((alt) => alt.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q)
    );
  }
}
