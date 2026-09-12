import { describe, expect, it } from "vitest";
import { InMemoryProfileRepository } from "./in-memory-profile-repository.js";

describe("InMemoryProfileRepository", () => {
  it("returns null before any profile has been saved", async () => {
    expect(await new InMemoryProfileRepository().get()).toBeNull();
  });

  it("saves and retrieves a profile", async () => {
    const repo = new InMemoryProfileRepository();
    await repo.save({ displayName: "Jordan", updatedAt: 123 });
    expect(await repo.get()).toEqual({ displayName: "Jordan", updatedAt: 123 });
  });

  it("overwrites the previous profile on save", async () => {
    const repo = new InMemoryProfileRepository();
    await repo.save({ displayName: "Jordan", updatedAt: 1 });
    await repo.save({ displayName: "Alex", updatedAt: 2 });
    expect((await repo.get())?.displayName).toBe("Alex");
  });
});
