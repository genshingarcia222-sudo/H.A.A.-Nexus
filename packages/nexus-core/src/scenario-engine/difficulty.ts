export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface DifficultyLevelMeta {
  level: DifficultyLevel;
  label: string;
}

export const DIFFICULTY_LEVELS: readonly DifficultyLevelMeta[] = [
  { level: 1, label: "Foundation" },
  { level: 2, label: "Beginner" },
  { level: 3, label: "Intermediate" },
  { level: 4, label: "Advanced" },
  { level: 5, label: "Expert" },
  { level: 6, label: "Master/Elite" }
];

export function difficultyLabel(level: DifficultyLevel): string {
  const meta = DIFFICULTY_LEVELS.find((d) => d.level === level);
  // Exhaustive by type, but guarded in case content ever supplies a raw
  // number from outside the type system (e.g. parsed JSON before validation).
  if (!meta) throw new Error(`Unknown difficulty level: ${level}`);
  return meta.label;
}
