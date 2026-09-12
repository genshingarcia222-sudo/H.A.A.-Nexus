import { invoke } from "@tauri-apps/api/core";
import type { UserProfile, ProfileRepository } from "@haa-nexus/nexus-core";

export class TauriProfileRepository implements ProfileRepository {
  async get(): Promise<UserProfile | null> {
    return invoke<UserProfile | null>("get_profile");
  }

  async save(profile: UserProfile): Promise<void> {
    await invoke("save_profile", { profile });
  }
}
