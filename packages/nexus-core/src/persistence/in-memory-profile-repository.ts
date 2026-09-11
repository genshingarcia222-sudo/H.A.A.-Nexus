import type { UserProfile, ProfileRepository } from "./types.js";

export class InMemoryProfileRepository implements ProfileRepository {
  private profile: UserProfile | null = null;

  async get(): Promise<UserProfile | null> {
    return this.profile;
  }

  async save(profile: UserProfile): Promise<void> {
    this.profile = profile;
  }
}
