import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadQuestionBanks } from "./loader.js";
import type { QuestionBankFile, QuestionBankLoadResult } from "./loader.js";

/**
 * Filesystem discovery for the question bank — the Node half of the loader.
 *
 * **Deliberately not exported from the package index.** `nexus-core` production
 * code otherwise contains no `node:` imports, and the desktop app bundles the
 * package for the browser; putting `node:fs` on the public surface would drag
 * it into that bundle. Node-side callers (tests, validation tooling, a future
 * Tauri-side loader) import this module by its own path. The browser never sees
 * it.
 *
 * Discovery only. Parsing, validation and every rule about what a bank may
 * contain belong to `loader.ts`, so there is one definition of valid content.
 */

/** The repository's question bank content directory, relative to this file. */
export const QUESTION_BANK_DIR = new URL("../../../../content/question-bank", import.meta.url);

/**
 * Reads the bank files in a directory.
 *
 * `.json` only, sorted by name for a deterministic order, and `_`-prefixed
 * files skipped — the same convention scenario intake uses for its template, so
 * an author can keep a scratch file beside real content without it loading. A
 * directory that does not exist reads as empty rather than throwing: bank
 * content is optional, and an absent directory is not a defect.
 */
export async function readQuestionBankFiles(dir: string): Promise<QuestionBankFile[]> {
  if (!existsSync(dir)) return [];

  const names = (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();

  return Promise.all(
    names.map(async (file) => ({
      file,
      contents: await readFile(path.join(dir, file), "utf-8")
    }))
  );
}

/** Reads a directory and runs the real loader over it. */
export async function loadQuestionBankDirectory(dir: string): Promise<QuestionBankLoadResult> {
  return loadQuestionBanks(await readQuestionBankFiles(dir));
}
