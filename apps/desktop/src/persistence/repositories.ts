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

/**
 * Outside the real Tauri shell (e.g. `vite dev` in a browser, or this
 * project's own test/dev sandbox), persistence falls back to in-memory
 * repositories that reset on reload. This is the ONLY place that fallback
 * decision is made - nothing else in the app should check isTauriRuntime()
 * directly.
 */
export const sessionRepository: SessionRepository = isTauriRuntime()
  ? new TauriSessionRepository()
  : new InMemorySessionRepository();

export const profileRepository: ProfileRepository = isTauriRuntime()
  ? new TauriProfileRepository()
  : new InMemoryProfileRepository();

export const competencyRepository: CompetencyRepository = isTauriRuntime()
  ? new TauriCompetencyRepository()
  : new InMemoryCompetencyRepository();
