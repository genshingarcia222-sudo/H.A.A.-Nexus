import type {
  CompetencyRecord,
  CompetencyRepository,
  ProfileRepository,
  SessionRecord,
  ResultPopulation,
  SessionRepository,
  UserProfile
} from "@haa-nexus/nexus-core";

/**
 * DEVELOPMENT ONLY browser persistence.
 *
 * Running the frontend in a browser (`pnpm dev:desktop`) falls back to
 * in-memory repositories, so every reload wipes the session - which makes
 * looking at the developing UI needlessly painful.
 *
 * These repositories keep that state in `localStorage` so a refresh survives.
 * They are wired in **only** when `import.meta.env.DEV` is true and the app is
 * not running inside the Tauri shell (see `repositories.ts`), so a production
 * bundle never reaches them.
 *
 * **This does not answer D10.** What persists a real web learner's progress -
 * per-browser, per-account across devices, or both - is an open product
 * decision recorded in `docs/DECISION_REGISTER.md`. This is a developer
 * convenience with a deliberately obvious namespace, not a product mechanism:
 * it has no migration story, no schema versioning and no account model, and it
 * must not be mistaken for one.
 */

const PREFIX = "nexus.dev.";
export const DEV_STORAGE_KEYS = {
  sessions: PREFIX + "sessions",
  competency: PREFIX + "competency",
  profile: PREFIX + "profile"
} as const;

/**
 * Whether `localStorage` can actually be used.
 *
 * It throws rather than returning null in a private window, with site data
 * blocked, or when a quota is exhausted - so it is probed, not assumed.
 */
export function browserStorageAvailable(storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    if (!storage) return false;
    const probe = PREFIX + "probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and parses a key, treating any failure as "nothing stored".
 *
 * Corrupt JSON must not break the app on boot: a developer clearing half a key
 * by hand should see an empty history, not a white screen.
 */
function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Out of quota or storage disabled mid-session. A development convenience
    // must never take the app down; the data stays in memory for this tab.
  }
}

export class DevBrowserSessionRepository implements SessionRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  private all(): SessionRecord[] {
    return readJson<SessionRecord[]>(this.storage, DEV_STORAGE_KEYS.sessions, []);
  }

  async save(record: SessionRecord): Promise<void> {
    const records = this.all().filter((r) => r.id !== record.id);
    records.push(record);
    writeJson(this.storage, DEV_STORAGE_KEYS.sessions, records);
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.all().find((r) => r.id === id);
  }

  async list(): Promise<SessionRecord[]> {
    // Newest first, matching the SQLite repository's ordering.
    return this.all().sort((a, b) => b.startedAt - a.startedAt);
  }

  async findInterrupted(): Promise<SessionRecord[]> {
    return (await this.list()).filter((r) => r.status === "in_progress" || r.status === "paused");
  }

  /** Development helper: forget everything this repository stored. */
  clear(): void {
    try {
      this.storage.removeItem(DEV_STORAGE_KEYS.sessions);
    } catch {
      /* nothing to do */
    }
  }
}

/** Competency is keyed by population *and* domain (D5), never domain alone. */
function keyOf(record: CompetencyRecord): string {
  return `${record.population}:${record.domain}`;
}

export class DevBrowserCompetencyRepository implements CompetencyRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  private all(): CompetencyRecord[] {
    const stored = readJson<CompetencyRecord[]>(this.storage, DEV_STORAGE_KEYS.competency, []);
    // Records written before D5 have no population. They are read as
    // practice, exactly as migration 003 does for the real database: they
    // were produced by the old mode-agnostic fold, and dropping them would
    // silently empty a developer's existing competency view.
    return stored.map((record) => (record.population ? record : { ...record, population: "practice" }));
  }

  private write(records: CompetencyRecord[]): void {
    writeJson(this.storage, DEV_STORAGE_KEYS.competency, records);
  }

  async get(population: ResultPopulation, domain: string): Promise<CompetencyRecord | undefined> {
    return this.all().find((r) => r.population === population && r.domain === domain);
  }

  async list(): Promise<CompetencyRecord[]> {
    return this.all();
  }

  async upsert(record: CompetencyRecord): Promise<void> {
    this.write([...this.all().filter((r) => keyOf(r) !== keyOf(record)), record]);
  }

  async upsertMany(records: readonly CompetencyRecord[]): Promise<void> {
    // One write for the whole batch, so a fold cannot land half-applied
    // (the M14 all-or-nothing guarantee, as far as this storage allows).
    // Records are replaced by (population, domain), so folding an assessment
    // leaves the practice record for the same domain untouched (D5).
    const keys = new Set(records.map(keyOf));
    this.write([...this.all().filter((r) => !keys.has(keyOf(r))), ...records]);
  }

  clear(): void {
    try {
      this.storage.removeItem(DEV_STORAGE_KEYS.competency);
    } catch {
      /* nothing to do */
    }
  }
}

export class DevBrowserProfileRepository implements ProfileRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  async get(): Promise<UserProfile | null> {
    return readJson<UserProfile | null>(this.storage, DEV_STORAGE_KEYS.profile, null);
  }

  async save(profile: UserProfile): Promise<void> {
    writeJson(this.storage, DEV_STORAGE_KEYS.profile, profile);
  }
}
