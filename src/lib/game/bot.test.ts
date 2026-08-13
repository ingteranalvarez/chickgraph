import { describe, expect, it } from "vitest";

import { chooseBotExpression } from "./bot";
import { createInitialState, traceShot } from "./engine";
import { parseExpression } from "./expression";
import type { GamePlayer, GameState } from "./types";

const humanId = "10000000-0000-4000-8000-000000000001";
const botId = "20000000-0000-4000-8000-000000000002";
const players: GamePlayer[] = [
  {
    id: humanId,
    username: "Human",
    countryCode: "MX",
    color: "cyan",
    seat: 0,
  },
  {
    id: botId,
    username: "GraphBot",
    countryCode: "AI",
    color: "coral",
    seat: 1,
  },
];

function botTurn(turnNumber: number, seed = 42): GameState {
  const initial = createInitialState({
    matchId: "30000000-0000-4000-8000-000000000003",
    players,
    seed,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  return {
    ...initial,
    obstacles: [],
    turnNumber,
    version: turnNumber + 1,
    currentPlayerId: botId,
  };
}

describe("practice bot", () => {
  it("fires a valid near miss on its first turn", () => {
    const state = botTurn(1);
    const expression = chooseBotExpression(state, botId);
    expect(() => parseExpression(expression)).not.toThrow();
    expect(traceShot(state, botId, expression).hitChickId).toBeNull();
  });

  it("can hit an opposing chicken on its next turn", () => {
    const state = botTurn(3);
    const expression = chooseBotExpression(state, botId);
    const shot = traceShot(state, botId, expression);
    const target = state.chickens.find((chicken) => chicken.id === shot.hitChickId);
    expect(target?.ownerId).toBe(humanId);
  });

  it("finds an opposing chicken across seeded arenas with obstacles", () => {
    for (const seed of [1, 7, 19, 42, 73, 144, 233, 377, 610, 901]) {
      const state = botTurn(3, seed);
      const expression = chooseBotExpression(state, botId);
      const shot = traceShot(state, botId, expression);
      const target = state.chickens.find((chicken) => chicken.id === shot.hitChickId);
      expect(target?.ownerId, `seed ${seed}: ${expression}`).toBe(humanId);
    }
  });

  it("is deterministic for the same arena and turn", () => {
    const state = botTurn(3, 901);
    expect(chooseBotExpression(state, botId)).toBe(
      chooseBotExpression(state, botId),
    );
  });
});
