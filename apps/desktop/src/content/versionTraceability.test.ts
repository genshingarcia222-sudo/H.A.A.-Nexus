import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryScenarioRepository,
  InMemorySessionRepository,
  NO_SUBSCRIPTION,
  computeContentHash,
  evaluateAttempt,
  type Scenario
} from "@haa-nexus/nexus-core";
import { useSessionStore } from "../store/sessionStore.js";
import { useEntitlementStore } from "../store/entitlementStore.js";
import { sessionRepository } from "../persistence/repositories.js";
import { scenarioRepository } from "./scenarios.js";

/**
 * Architecture Package §28 edge case: "scenario version bump after a completed
 * attempt (assert old attempt still resolves to old version's content)".
 *
 * v1.1 below is a test-only clone: it is never written to /content, so the
 * content-hash gate and the shipped library are unaffected.
 */

const V1_0 = scenarioRepository.get("SCRIBE-FM-014", "1.0")!;

function bumpedVersion(): Scenario {
  return {
    ...V1_0,
    version: "1.1",
    requiredDocumentation: [
      ...V1_0.requiredDocumentation,
      {
        id: "req-test-only-v11",
        section: "plan",
        description: "Test-only requirement added in v1.1",
        sourceFact: "follow up in one week",
        acceptableVariants: ["follow up in 1 week", "follow-up in one week"]
      }
    ]
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  (sessionRepository as InMemorySessionRepository).clear();
  useEntitlementStore.getState().setSubscription(NO_SUBSCRIPTION);
});

async function submitRealAttempt() {
  const store = useSessionStore.getState();
  store.start(V1_0, "practice");
  store.updateField("hpi", "Non-productive cough x3 days.");
  store.updateField("ros", "No fever. Temperature 37.0°C.");
  await useSessionStore.getState().submit();
  const [record] = await sessionRepository.list();
  return record!;
}

describe("scenario version bump after a completed attempt", () => {
  it("still resolves the stored attempt to the exact content it was scored against", async () => {
    const record = await submitRealAttempt();
    const library = new InMemoryScenarioRepository();
    library.register(V1_0);
    library.register(bumpedVersion());

    expect(library.getLatest("SCRIBE-FM-014")?.version).toBe("1.1");
    const resolved = library.get(record.scenarioId, record.scenarioVersion)!;
    expect(resolved.version).toBe("1.0");
    expect(await computeContentHash(resolved)).toBe(await computeContentHash(V1_0));
  });

  it("re-evaluating the stored draft against its recorded version reproduces the stored evaluation exactly", async () => {
    const record = await submitRealAttempt();
    const library = new InMemoryScenarioRepository();
    library.register(V1_0);
    library.register(bumpedVersion());

    const again = evaluateAttempt({
      scenario: library.get(record.scenarioId, record.scenarioVersion)!,
      draft: record.draft,
      activeMs: record.activeMs
    });

    expect({ ...again, evaluatedAt: 0 }).toEqual({ ...record.evaluation!, evaluatedAt: 0 });
  });

  it("would score the same draft differently against the newer version, which is why the version is recorded", async () => {
    const record = await submitRealAttempt();
    const againstNewer = evaluateAttempt({ scenario: bumpedVersion(), draft: record.draft, activeMs: record.activeMs });

    expect(againstNewer.errors.some((e) => e.relatedRequirementId === "req-test-only-v11")).toBe(true);
    expect(againstNewer.overallScore).not.toBe(record.evaluation!.overallScore);
  });
});
