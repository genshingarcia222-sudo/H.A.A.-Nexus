import { create } from "zustand";
import { profileRepository } from "../persistence/repositories.js";

/**
 * Phase 5: backed by ProfileRepository (SQLite via Tauri, or in-memory
 * outside the Tauri shell - see persistence/repositories.ts). `hydrate()`
 * must be called once at app startup to load any previously-saved name;
 * until then this shows the "Learner" default rather than blocking render.
 */
export interface ProfileState {
  displayName: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  displayName: "Learner",
  hydrated: false,

  hydrate: async () => {
    try {
      const saved = await profileRepository.get();
      if (saved) set({ displayName: saved.displayName });
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      set({ hydrated: true });
    }
  },

  setDisplayName: async (name: string) => {
    set({ displayName: name });
    try {
      await profileRepository.save({ displayName: name, updatedAt: Date.now() });
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  }
}));
