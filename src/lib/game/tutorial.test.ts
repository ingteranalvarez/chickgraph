import { describe, expect, it } from "vitest";

import { traceShot } from "./engine";
import {
  createTutorialState,
  tutorialChapters,
  tutorialExpressionMeetsRequirement,
  tutorialLevels,
  tutorialSolutionExpression,
  tutorialTargetId,
} from "./tutorial";

const profile = {
  id: "60000000-0000-4000-8000-000000000006",
  username: "Student",
  countryCode: "MX",
};

describe("tutorial curriculum", () => {
  it.each(tutorialLevels)("has a verified solution for $title", (level) => {
    const state = createTutorialState(level, profile);
    const expression = tutorialSolutionExpression(level);
    const shot = traceShot(state, profile.id, expression);
    expect(shot.hitChickId, `${level.id}: y = ${expression}`).toBe(
      tutorialTargetId(level),
    );
    expect(tutorialExpressionMeetsRequirement(level, expression)).toBe(true);
  });

  it("teaches both positive and negative linear slopes", () => {
    const slopes = tutorialLevels
      .flatMap((level) => level.parameters)
      .filter((parameter) => parameter.id === "slope")
      .map((parameter) => parameter.solution);
    expect(slopes.some((value) => value > 0)).toBe(true);
    expect(slopes.some((value) => value < 0)).toBe(true);
  });

  it("covers every function and operator available in a match", () => {
    const curriculum = tutorialLevels
      .map((level) => `${level.explanation} ${tutorialSolutionExpression(level)}`)
      .join(" ");

    for (const token of [
      "+",
      "-",
      "*",
      "/",
      "^",
      "abs",
      "cos",
      "exp",
      "ln",
      "log",
      "sin",
      "sqrt",
      "tan",
    ]) {
      expect(curriculum, `missing ${token}`).toContain(token);
    }
  });

  it("organizes all 18 sequential levels into five chapters", () => {
    expect(tutorialLevels).toHaveLength(18);
    expect(tutorialChapters).toHaveLength(5);
    expect(new Set(tutorialLevels.map((level) => level.chapterId))).toEqual(
      new Set(tutorialChapters.map((chapter) => chapter.id)),
    );
  });

  it("teaches shots in both horizontal directions", () => {
    const rightSideLevel = tutorialLevels.find((level) => level.shooterSide === "right");
    expect(rightSideLevel).toBeDefined();
    const state = createTutorialState(rightSideLevel!, profile);
    const shot = traceShot(state, profile.id, tutorialSolutionExpression(rightSideLevel!));
    expect(shot.points[1].x).toBeLessThan(shot.points[0].x);
  });
});
