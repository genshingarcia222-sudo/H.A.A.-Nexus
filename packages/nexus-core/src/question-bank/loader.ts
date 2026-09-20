import { InMemoryQuestionBankRepository } from "./repository.js";
import { validateQuestionBank } from "./validate.js";
import type { QuestionBank, TrainingQuestion } from "./schema.js";

/**
 * The read-only question bank loader.
 *
 * This module is **platform-neutral on purpose**. `nexus-core` production code
 * has no `node:` imports anywhere, and the desktop app bundles the package for
 * the browser through Vite; a `node:fs` import in the package's public surface
 * would break that build. So the loader takes file *contents* that somebody
 * else has already read, and the filesystem discovery that pairs with it lives
 * in `loader-node.ts`, which is deliberately not exported from the package
 * index.
 *
 * It is read-only in the strong sense: it parses, validates and returns. It
 * writes nothing, promotes nothing, and changes no status. A candidate that
 * goes in comes out a candidate.
 */

/** One bank file, already read from wherever it lives. */
export interface QuestionBankFile {
  /** Identifier used in error messages — a filename or path. */
  file: string;
  /** Raw JSON text. */
  contents: string;
}

export interface LoadedQuestionBank {
  file: string;
  bank: QuestionBank;
}

export type QuestionBankLoadResult =
  | { success: true; banks: LoadedQuestionBank[]; questions: TrainingQuestion[] }
  | { success: false; errors: string[] };

/**
 * Parses and validates bank files.
 *
 * Every problem in every file is reported, not just the first: an author fixing
 * content should see the whole list rather than discover it one run at a time,
 * which is the same reason scenario intake reports per-file errors with paths.
 *
 * Nothing is returned unless everything validates. A partial load would mean a
 * consumer silently working from a subset of the bank, which for content that
 * carries provenance is worse than failing.
 */
export function loadQuestionBanks(files: QuestionBankFile[]): QuestionBankLoadResult {
  // Sorted so a directory listing's order cannot change what a consumer sees.
  const ordered = [...files].sort((a, b) => a.file.localeCompare(b.file));

  const errors: string[] = [];
  const banks: LoadedQuestionBank[] = [];

  for (const { file, contents } of ordered) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch (e) {
      errors.push(`${file}: not valid JSON (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }

    const result = validateQuestionBank(parsed);
    if (!result.success) {
      // The strict schema means an unknown field arrives here by name rather
      // than being dropped, so "silent field loss" shows up as a load failure.
      for (const error of result.errors) errors.push(`${file}: ${error}`);
      continue;
    }

    banks.push({ file, bank: result.data });
  }

  // Ids must be unique across the whole bank, not merely within one file —
  // otherwise two files can each be valid while the set they form is not.
  const seen = new Map<string, string>();
  for (const { file, bank } of banks) {
    for (const question of bank.questions) {
      const previous = seen.get(question.questionId);
      if (previous !== undefined) {
        errors.push(`duplicate question id "${question.questionId}" in ${previous} and ${file}`);
      }
      seen.set(question.questionId, file);
    }
  }

  if (errors.length > 0) return { success: false, errors };

  return { success: true, banks, questions: banks.flatMap(({ bank }) => bank.questions) };
}

export type QuestionBankRepositoryResult =
  | { success: true; repository: InMemoryQuestionBankRepository }
  | { success: false; errors: string[] };

/**
 * Loads bank files straight into a repository — the one call a consumer wants.
 *
 * The repository it returns holds every question that loaded, whatever its
 * status, because development and validation tooling needs to see candidates.
 * A learner-facing consumer must ask for `getProductionEligible()`; being
 * handed the repository is not permission to show its contents to anybody.
 */
export function createQuestionBankRepository(files: QuestionBankFile[]): QuestionBankRepositoryResult {
  const loaded = loadQuestionBanks(files);
  if (!loaded.success) return { success: false, errors: loaded.errors };

  const repository = new InMemoryQuestionBankRepository();
  for (const { bank } of loaded.banks) {
    repository.registerBank(bank);
  }
  return { success: true, repository };
}
