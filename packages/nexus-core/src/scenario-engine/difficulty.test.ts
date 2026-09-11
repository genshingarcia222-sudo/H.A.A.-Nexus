import { describe, expect, it } from "vitest";
import { DIFFICULTY_LEVELS, difficultyLabel } from "./difficulty.js";

describe("difficulty levels", () => {
  it("defines exactly the six levels from the architecture doc", () => {
    expect(DIFFICULTY_LEVELS).toHaveLength(6);
    expect(DIFFICULTY_LEVELS.map((d) => d.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("labels level 1 as Foundation and level 6 as Master/Elite", () => {
    expect(difficultyLabel(1)).toBe("Foundation");
    expect(difficultyLabel(6)).toBe("Master/Elite");
  });
});
