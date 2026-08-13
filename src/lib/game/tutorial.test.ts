import { describe, expect, it } from "vitest";

import { traceShot } from "./engine";
import {
  createTutorialState,
  tutorialLevels,
  tutorialSolutionValues,
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
    const expression = level.formula(tutorialSolutionValues(level));
    const shot = traceShot(state, profile.id, expression);
    expect(shot.hitChickId, `${level.id}: y = ${expression}`).toBe(
      tutorialTargetId(level),
    );
  });

  it("teaches both positive and negative linear slopes", () => {
    const slopes = tutorialLevels
      .flatMap((level) => level.parameters)
      .filter((parameter) => parameter.id === "slope")
      .map((parameter) => parameter.solution);
    expect(slopes.some((value) => value > 0)).toBe(true);
    expect(slopes.some((value) => value < 0)).toBe(true);
  });
});
