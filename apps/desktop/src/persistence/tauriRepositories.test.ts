import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { TauriCompetencyRepository } from "./tauriCompetencyRepository.js";

const invokeMock = vi.mocked(invoke);

const record = {
  domain: "accuracy",
  level: "developing" as const,
  avgScore: 70,
  recentScore: 70,
  trend: "flat" as const,
  attemptCount: 3,
  confidence: 0.3,
  recentScores: [70],
  updatedAt: 1
};

beforeEach(() => {
  invokeMock.mockReset();
});

describe("TauriCompetencyRepository (Phase 7 accepted debt A10)", () => {
  it("looks up one domain with a single per-domain command instead of listing every record", async () => {
    invokeMock.mockResolvedValueOnce(record);

    const found = await new TauriCompetencyRepository().get("assessment", "accuracy");

    expect(found).toEqual(record);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    // The population is part of the lookup key (D5), not a filter applied after.
    expect(invokeMock).toHaveBeenCalledWith("get_competency_record", {
      population: "assessment",
      domain: "accuracy"
    });
  });

  it("returns undefined, not null, for a domain that has never been scored", async () => {
    invokeMock.mockResolvedValueOnce(null);
    expect(await new TauriCompetencyRepository().get("practice", "terminology")).toBeUndefined();
  });
});

describe("Tauri IPC contract", () => {
  it("every command the frontend invokes is registered in the Rust command handler", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const mainRs = readFileSync(path.join(here, "../../src-tauri/src/main.rs"), "utf8");
    const registered = new Set([...mainRs.matchAll(/commands::([a-z_]+)/g)].map((m) => m[1]));

    const invoked = new Set<string>();
    for (const file of readdirSync(here).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const source = readFileSync(path.join(here, file), "utf8");
      for (const m of source.matchAll(/invoke(?:<[^>]*>)?\(\s*"([a-z_]+)"/g)) invoked.add(m[1]!);
    }

    expect(invoked.size).toBeGreaterThan(0);
    const unregistered = [...invoked].filter((name) => !registered.has(name));
    expect(unregistered, `invoked but not registered in main.rs: ${unregistered.join(", ")}`).toEqual([]);
  });
});
