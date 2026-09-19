import {
  InMemorySessionRepository,
  InMemoryProfileRepository,
  InMemoryCompetencyRepository,
  type SessionRepository,
  type ProfileRepository,
  type CompetencyRepository
} from "@haa-nexus/nexus-core";
import { isTauriRuntime } from "./environment.js";
import { TauriSessionRepository } from "./tauriSessionRepository.js";
import { TauriProfileRepository } from "./tauriProfileRepository.js";
import { TauriCompetencyRepository } from "./tauriCompetencyRepository.js";
import {
  browserStorageAvailable,
  DevBrowserCompetencyRepository,
  DevBrowserProfileRepository,
  DevBrowserSessionRepository
} from "./devBrowserRepositories.js";

/**
 * Where persistence goes, decided once, here.
 *
 * 1. Inside the Tauri shell: SQLite, through IPC. This is the product.
 * 2. `vite dev` in a browser, with working storage: development-only
 *    `localStorage` repositories, so a reload does not wipe what you were
 *    looking at.
 * 3. Anything else - tests, a production web bundle, a browser with storage
 *    blocked: in-memory, resetting on reload.
 *
 * Case 2 is a developer convenience and **not** an answer to D10. What
 * persists a real web learner's progress is an open product decision (see
 * `docs/DECISION_REGISTER.md`); the `import.meta.env.DEV` guard is what keeps
 * this out of any shipped web build.
 */
// `import.meta.env.DEV` is also true under vitest, and jsdom provides a
// localStorage - so without excluding test mode explicitly, tests would
// silently run against browser storage instead of the in-memory repositories
// they are written for. Test determinism should not rest on which environment
// a file happens to use.
const useDevBrowserStorage =
  Boolean(import.meta.env?.DEV) &&
  import.meta.env?.MODE !== "test" &&
  !isTauriRuntime() &&
  browserStorageAvailable();

export const sessionRepository: SessionRepository = isTauriRuntime()
  ? new TauriSessionRepository()
  : useDevBrowserStorage
    ? new DevBrowserSessionRepository()
    : new InMemorySessionRepository();

export const profileRepository: ProfileRepository = isTauriRuntime()
  ? new TauriProfileRepository()
  : useDevBrowserStorage
    ? new DevBrowserProfileRepository()
    : new InMemoryProfileRepository();

export const competencyRepository: CompetencyRepository = isTauriRuntime()
  ? new TauriCompetencyRepository()
  : useDevBrowserStorage
    ? new DevBrowserCompetencyRepository()
    : new InMemoryCompetencyRepository();

/** Which of the three backends is actually in use, for diagnostics. */
export const persistenceMode: "tauri-sqlite" | "dev-browser-storage" | "in-memory" = isTauriRuntime()
  ? "tauri-sqlite"
  : useDevBrowserStorage
    ? "dev-browser-storage"
    : "in-memory";
