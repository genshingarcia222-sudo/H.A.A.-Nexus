import type { TrainingLesson } from "./schema.js";

export interface TrainingLessonRepository {
  get(id: string): TrainingLesson | undefined;
  list(): TrainingLesson[];
  byCategory(category: string): TrainingLesson[];
}

export class InMemoryTrainingLessonRepository implements TrainingLessonRepository {
  private readonly lessons = new Map<string, TrainingLesson>();

  register(lesson: TrainingLesson): void {
    if (this.lessons.has(lesson.id)) {
      throw new Error(`Lesson "${lesson.id}" is already registered.`);
    }
    this.lessons.set(lesson.id, lesson);
  }

  get(id: string): TrainingLesson | undefined {
    return this.lessons.get(id);
  }

  list(): TrainingLesson[] {
    return Array.from(this.lessons.values());
  }

  byCategory(category: string): TrainingLesson[] {
    return this.list().filter((l) => l.category === category);
  }
}
