import type { ChickState, CircleObstacle, GamePlayer } from "./types";

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createObstacles(seed: number): CircleObstacle[] {
  const random = mulberry32(seed);
  const obstacles: CircleObstacle[] = [];

  for (let index = 0; index < 9; index += 1) {
    const lane = index % 3;
    const column = Math.floor(index / 3);
    obstacles.push({
      id: `obstacle-${index + 1}`,
      x: -10 + column * 10 + (random() - 0.5) * 4,
      y: -9 + lane * 9 + (random() - 0.5) * 3,
      radius: 1.4 + random() * 1.8,
    });
  }

  return obstacles;
}

export function createChickens(players: GamePlayer[]): ChickState[] {
  const positions = [
    [
      { x: -21, y: -8 },
      { x: -19, y: 7 },
    ],
    [
      { x: 21, y: 8 },
      { x: 19, y: -7 },
    ],
    [
      { x: -10, y: 12 },
      { x: 10, y: 12 },
    ],
    [
      { x: -10, y: -12 },
      { x: 10, y: -12 },
    ],
  ];

  return players.flatMap((player, playerIndex) =>
    positions[playerIndex].map((position, slot) => ({
      id: `${player.id}-chick-${slot + 1}`,
      ownerId: player.id,
      slot,
      alive: true,
      ...position,
    })),
  );
}
