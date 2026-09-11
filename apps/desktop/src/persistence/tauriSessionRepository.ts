import { invoke } from "@tauri-apps/api/core";
import type { SessionRecord, SessionRepository } from "@haa-nexus/nexus-core";

export class TauriSessionRepository implements SessionRepository {
  async save(record: SessionRecord): Promise<void> {
    await invoke("save_session", { record });
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    const result = await invoke<SessionRecord | null>("get_session", { id });
    return result ?? undefined;
  }

  async list(): Promise<SessionRecord[]> {
    return invoke<SessionRecord[]>("list_sessions");
  }

  async findInterrupted(): Promise<SessionRecord[]> {
    return invoke<SessionRecord[]>("find_interrupted_sessions");
  }
}
