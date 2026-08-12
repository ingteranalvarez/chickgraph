import { describe, expect, it } from "vitest";

import {
  fireShot,
  GameRuleError,
  createInitialState,
  resignMatch,
  skipExpiredTurn,
  traceShot,
} from "./engine";
import { ExpressionError, parseExpression } from "./expression";
import type { GamePlayer, GameState } from "./types";

const players: GamePlayer[] = [
  {
    id: "alpha",
    username: "Alpha",
    countryCode: "MX",
    color: "cyan",
    seat: 0,
  },
  {
    id: "bravo",
    username: "Bravo",
    countryCode: "US",
    color: "coral",
    seat: 1,
  },
];

function openState(): GameState {
  const state = createInitialState({
    matchId: "match-1",
    players,
    seed: 42,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  return { ...state, obstacles: [] };
}

describe("expression parser", () => {
  it("evaluates the supported Graphwar-style functions", () => {
    const expression = parseExpression("2*sin(x) + sqrt(abs(x)) - ln(2)");
    expect(expression.evaluate(4)).toBeCloseTo(
      2 * Math.sin(4) + 2 - Math.log(2),
    );
  });

  it.each(["y = x", "import(1)", "x[1]", "random()", "x > 2 ? 1 : 0"])(
    "rejects unsafe expression %s",
    (source) => {
      expect(() => parseExpression(source)).toThrow(ExpressionError);
    },
  );
});

describe("deterministic engine", () => {
  it("creates the same arena from the same seed", () => {
    const first = createInitialState({ matchId: "a", players, seed: 901 });
    const second = createInitialState({ matchId: "b", players, seed: 901 });
    expect(first.obstacles).toEqual(second.obstacles);
    expect(first.chickens).toEqual(second.chickens);
  });

  it("translates the curve through the active chicken", () => {
    const state = openState();
    const shot = traceShot(state, "alpha", "x^2");
    expect(shot.points[0]).toEqual({ x: -21, y: -8 });
    expect(shot.points[1].y).toBeCloseTo(-9.6784, 4);
  });

  it("alternates a player's active chicken each round", () => {
    const state = {
      ...openState(),
      turnNumber: 2,
      currentPlayerId: "alpha",
    };
    const shot = traceShot(state, "alpha", "0");
    expect(shot.shooterChickId).toBe("alpha-chick-2");
    expect(shot.points[0]).toEqual({ x: -19, y: 7 });
  });

  it("eliminates a chicken and advances the authoritative version", () => {
    const state = openState();
    const target = state.chickens.find(
      (chicken) => chicken.ownerId === "bravo" && chicken.slot === 1,
    );
    if (!target) throw new Error("fixture target missing");

    const shooter = state.chickens.find(
      (chicken) => chicken.ownerId === "alpha" && chicken.slot === 0,
    );
    if (!shooter) throw new Error("fixture shooter missing");

    const slope = (target.y - shooter.y) / (target.x - shooter.x);
    const outcome = fireShot(
      state,
      {
        playerId: "alpha",
        expression: `${slope} * x`,
        expectedVersion: 1,
      },
      new Date("2026-01-01T00:00:15.000Z"),
    );

    expect(outcome.shot.hitChickId).toBe(target.id);
    expect(outcome.state.version).toBe(2);
    expect(outcome.state.currentPlayerId).toBe("bravo");
    expect(outcome.state.turnDeadline).toBe("2026-01-01T00:01:15.000Z");
  });

  it("rejects stale and out-of-turn commands", () => {
    const state = openState();
    expect(() =>
      fireShot(state, {
        playerId: "bravo",
        expression: "x",
        expectedVersion: 1,
      }),
    ).toThrow(GameRuleError);
    expect(() =>
      fireShot(state, {
        playerId: "alpha",
        expression: "x",
        expectedVersion: 0,
      }),
    ).toThrow(GameRuleError);
  });

  it("advances an expired turn without firing", () => {
    const state = openState();
    const advanced = skipExpiredTurn(
      state,
      new Date("2026-01-01T00:01:01.000Z"),
    );
    expect(advanced.currentPlayerId).toBe("bravo");
    expect(advanced.version).toBe(2);
    expect(advanced.turnNumber).toBe(1);
  });

  it("does not skip a turn before its deadline", () => {
    expect(() =>
      skipExpiredTurn(openState(), new Date("2026-01-01T00:00:30.000Z")),
    ).toThrow(GameRuleError);
  });

  it("finishes the match when a player resigns", () => {
    const resigned = resignMatch(openState(), "alpha");
    expect(resigned.status).toBe("finished");
    expect(resigned.winnerId).toBe("bravo");
    expect(resigned.chickens.filter((chicken) => chicken.ownerId === "alpha").every((chicken) => !chicken.alive)).toBe(true);
  });
});
