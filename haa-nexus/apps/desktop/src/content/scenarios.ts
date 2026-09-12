// NOTE: despite the filename, this module loads all bundled content
// (scenarios, terminology, and lessons) - kept as one file since Vite's
// static JSON imports and the validation gates all follow the same
// pattern. Renaming would touch several import sites for no functional
// benefit.
import {
  InMemoryScenarioRepository,
  InMemoryTerminologyRepository,
  InMemoryTrainingLessonRepository,
  validateScenario,
  validateTerminologyEntry,
  validateTrainingLesson,
  type Scenario
} from "@haa-nexus/nexus-core";
import scribeF014 from "../../../../content/scenarios/live-scribing/SCRIBE-FM-014-v1.0.json";
import scribeIm032 from "../../../../content/scenarios/live-scribing/SCRIBE-IM-032-v1.0.json";
import terminologyData from "../../../../content/terminology/terminology.json";
import hpiFundamentals from "../../../../content/lessons/hpi-fundamentals.json";
import medicalTerminology from "../../../../content/lessons/medical-terminology.json";
import accuracyLesson from "../../../../content/lessons/accuracy-and-unsupported-inference.json";

/**
 * MVP content loading: bundled via Vite's native JSON import, then run
 * through the same validate*() gates the content-QA tests use, so a bad
 * import fails loudly here too rather than only in CI. Real Tauri
 * resource-bundle loading (reading from the app's resource directory
 * instead of a bundler import) is a Phase 9 concern.
 */
function loadBuiltInScenarios(): Scenario[] {
  const raw = [scribeF014, scribeIm032];
  const scenarios: Scenario[] = [];

  for (const entry of raw) {
    const result = validateScenario(entry);
    if (!result.success) {
      // A shipped content package failing validation is a build-time bug,
      // not a runtime condition to recover from gracefully.
      throw new Error(`Bundled scenario failed validation:\n${result.errors.join("\n")}`);
    }
    scenarios.push(result.data);
  }

  return scenarios;
}

export const scenarioRepository = new InMemoryScenarioRepository();
for (const scenario of loadBuiltInScenarios()) {
  scenarioRepository.register(scenario);
}

export const terminologyRepository = new InMemoryTerminologyRepository();
for (const entry of terminologyData) {
  const result = validateTerminologyEntry(entry);
  if (!result.success) {
    throw new Error(`Bundled terminology entry failed validation:\n${result.errors.join("\n")}`);
  }
  terminologyRepository.register(result.data);
}

export const lessonRepository = new InMemoryTrainingLessonRepository();
for (const entry of [hpiFundamentals, medicalTerminology, accuracyLesson]) {
  const result = validateTrainingLesson(entry);
  if (!result.success) {
    throw new Error(`Bundled lesson failed validation:\n${result.errors.join("\n")}`);
  }
  lessonRepository.register(result.data);
}
