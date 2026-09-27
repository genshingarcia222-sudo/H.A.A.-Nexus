import { isProductionEligible } from "./schema.js";
import type { QuestionBank, TrainingQuestion } from "./schema.js";

/**
 * Read-only access to validated canonical questions.
 *
 * The interface is deliberately three methods. A future Training run, a future
 * remediation surface and a future Learning Assessment all need *"give me the
 * questions"* and *"give me this one"*; none of them needs a query language,
 * and inventing one now would encode guesses about selection that nobody has
 * made. Selection — randomisation, 10-question runs, replay diversity,
 * seen-item history — is a later checkpoint and is not here.
 *
 * `getProductionEligible()` is the exception, and it is a safety gate rather
 * than a query: it is how a learner-facing consumer avoids being handed
 * candidate content by default. It applies `isProductionEligible`, which
 * already requires status, review outcome and a recorded human verification to
 * line up. Nothing here promotes anything.
 */
export interface QuestionBankRepository {
  /** The question with this id, or undefined. */
  getById(questionId: string): TrainingQuestion | undefined;
  /** Every registered question, in registration order. Content status included, not filtered. */
  getAll(): TrainingQuestion[];
  /** Only questions cleared for a learner. Candidates are never in this list. */
  getProductionEligible(): TrainingQuestion[];
}

/**
 * Recursively freezes a value in place. Used on a private clone, so the
 * caller's own object is never frozen as a side effect.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

/**
 * The in-memory question bank, mirroring `InMemoryTrainingLessonRepository`:
 * register what has already been validated, then read.
 *
 * Two guarantees beyond the lesson repository, both because bank content
 * carries provenance and a review lifecycle that must not drift:
 *
 * - **Stored records are private clones, deep-frozen.** A consumer cannot edit
 *   a question's status, rationale or source through a reference it was handed,
 *   and registering does not freeze the caller's own object.
 * - **Reads are deterministic.** `getAll()` returns registration order every
 *   time, and a fresh array each call, so a consumer sorting or splicing the
 *   result cannot disturb the next reader.
 *
 * It holds no connection, reads no file and performs no I/O. Loading is the
 * loader's job; this only stores what it is given.
 */
export class InMemoryQuestionBankRepository implements QuestionBankRepository {
  private readonly questions = new Map<string, TrainingQuestion>();

  /**
   * Registers one already-validated question.
   *
   * Throws on a duplicate id rather than overwriting: two questions sharing an
   * id means one of them silently disappears, and with provenance attached that
   * is a question whose citation no longer matches its text.
   */
  register(question: TrainingQuestion): void {
    if (this.questions.has(question.questionId)) {
      throw new Error(`Question "${question.questionId}" is already registered.`);
    }
    this.questions.set(question.questionId, deepFreeze(structuredClone(question)));
  }

  /** Registers every question in a validated bank, in file order. */
  registerBank(bank: QuestionBank): void {
    for (const question of bank.questions) {
      this.register(question);
    }
  }

  getById(questionId: string): TrainingQuestion | undefined {
    return this.questions.get(questionId);
  }

  getAll(): TrainingQuestion[] {
    return Array.from(this.questions.values());
  }

  getProductionEligible(): TrainingQuestion[] {
    return this.getAll().filter(isProductionEligible);
  }

  /** How many questions are registered. */
  get size(): number {
    return this.questions.size;
  }
}
