import {
  CHICK_RADIUS,
  MAX_PATH_DISTANCE,
  PATH_STEP,
  TURN_SECONDS,
  WORLD,
} from "./constants";
import { parseExpression } from "./expression";
import { createChickens, createObstacles } from "./map";
import type {
  ChickState,
  CircleObstacle,
  FireCommand,
  FireOutcome,
  GamePlayer,
  GameState,
  Point,
  ShotEndReason,
  ShotResult,
} from "./types";

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

const rounded = (value: number) => Math.round(value * 10_000) / 10_000;

function pointInWorld(point: Point): boolean {
  return (
    point.x >= WORLD.minX &&
    point.x <= WORLD.maxX &&
    point.y >= WORLD.minY &&
    point.y <= WORLD.maxY
  );
}

function segmentHitsCircle(from: Point, to: Point, circle: Point, radius: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const interpolation =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((circle.x - from.x) * dx + (circle.y - from.y) * dy) /
              lengthSquared,
          ),
        );
  const closestX = from.x + interpolation * dx;
  const closestY = from.y + interpolation * dy;
  return Math.hypot(circle.x - closestX, circle.y - closestY) <= radius;
}

function findCollision(
  from: Point,
  to: Point,
  shooter: ChickState,
  travelled: number,
  chickens: ChickState[],
  obstacles: CircleObstacle[],
): { reason: ShotEndReason; hitChickId: string | null } | null {
  for (const chicken of chickens) {
    if (!chicken.alive) continue;
    if (chicken.id === shooter.id && travelled < CHICK_RADIUS * 2) continue;
    if (segmentHitsCircle(from, to, chicken, CHICK_RADIUS)) {
      return { reason: "chicken", hitChickId: chicken.id };
    }
  }

  for (const obstacle of obstacles) {
    if (segmentHitsCircle(from, to, obstacle, obstacle.radius)) {
      return { reason: "obstacle", hitChickId: null };
    }
  }

  return null;
}

export function getActiveChicken(
  state: GameState,
  playerId: string,
): ChickState | null {
  const available = state.chickens
    .filter((chicken) => chicken.ownerId === playerId && chicken.alive)
    .sort((left, right) => left.slot - right.slot);

  if (available.length === 0) return null;

  const playerRound = Math.floor(state.turnNumber / state.players.length);
  return available[playerRound % available.length];
}

function shooterFor(state: GameState, playerId: string): ChickState {
  const shooter = getActiveChicken(state, playerId);
  if (!shooter) throw new GameRuleError("This player has no chickens left.");
  return shooter;
}

function nextLivingPlayer(state: GameState, currentPlayerId: string): string | null {
  const currentIndex = state.players.findIndex(
    (player) => player.id === currentPlayerId,
  );

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = state.players[(currentIndex + offset) % state.players.length];
    if (
      state.chickens.some(
        (chicken) => chicken.ownerId === candidate.id && chicken.alive,
      )
    ) {
      return candidate.id;
    }
  }

  return null;
}

function livingPlayerIds(chickens: ChickState[]): string[] {
  return [...new Set(chickens.filter((chicken) => chicken.alive).map((c) => c.ownerId))];
}

export function createInitialState({
  matchId,
  players,
  seed,
  now = new Date(),
}: {
  matchId: string;
  players: GamePlayer[];
  seed: number;
  now?: Date;
}): GameState {
  if (players.length < 2 || players.length > 4) {
    throw new GameRuleError("A match requires between two and four players.");
  }

  const seats = new Set(players.map((player) => player.seat));
  if (seats.size !== players.length) {
    throw new GameRuleError("Each player must have a unique seat.");
  }

  const orderedPlayers = [...players].sort((left, right) => left.seat - right.seat);
  return {
    matchId,
    status: "active",
    version: 1,
    seed,
    turnNumber: 0,
    currentPlayerId: orderedPlayers[0].id,
    turnDeadline: new Date(now.getTime() + TURN_SECONDS * 1_000).toISOString(),
    winnerId: null,
    players: orderedPlayers,
    chickens: createChickens(orderedPlayers),
    obstacles: createObstacles(seed),
  };
}

export function traceShot(
  state: GameState,
  playerId: string,
  expressionSource: string,
): ShotResult {
  const expression = parseExpression(expressionSource);
  const shooter = shooterFor(state, playerId);
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new GameRuleError("Player is not part of this match.");

  const direction = player.seat % 2 === 0 ? 1 : -1;
  const baseline = expression.evaluate(shooter.x);
  if (!Number.isFinite(baseline)) {
    throw new GameRuleError("The function is not defined at your chicken's position.");
  }

  const points: Point[] = [{ x: rounded(shooter.x), y: rounded(shooter.y) }];
  let previous = points[0];
  let endReason: ShotEndReason = "range";
  let hitChickId: string | null = null;

  for (
    let travelled = PATH_STEP;
    travelled <= MAX_PATH_DISTANCE;
    travelled += PATH_STEP
  ) {
    const x = shooter.x + direction * travelled;
    const evaluated = expression.evaluate(x);
    if (!Number.isFinite(evaluated)) {
      endReason = "invalid-number";
      break;
    }

    const next = { x: rounded(x), y: rounded(evaluated - baseline + shooter.y) };
    points.push(next);

    const collision = findCollision(
      previous,
      next,
      shooter,
      travelled,
      state.chickens,
      state.obstacles,
    );
    if (collision) {
      endReason = collision.reason;
      hitChickId = collision.hitChickId;
      break;
    }

    if (!pointInWorld(next)) {
      endReason = "bounds";
      break;
    }
    previous = next;
  }

  return {
    expression: expression.source,
    shooterId: playerId,
    shooterChickId: shooter.id,
    turnNumber: state.turnNumber,
    points,
    endReason,
    hitChickId,
  };
}

export function fireShot(
  state: GameState,
  command: FireCommand,
  now = new Date(),
): FireOutcome {
  if (state.status !== "active") {
    throw new GameRuleError("This match is not active.");
  }
  if (state.version !== command.expectedVersion) {
    throw new GameRuleError("The match changed. Refresh and try again.");
  }
  if (state.currentPlayerId !== command.playerId) {
    throw new GameRuleError("It is not your turn.");
  }
  if (state.turnDeadline && now.getTime() > new Date(state.turnDeadline).getTime()) {
    throw new GameRuleError("This turn has expired.");
  }

  const shot = traceShot(state, command.playerId, command.expression);
  const chickens = state.chickens.map((chicken) =>
    chicken.id === shot.hitChickId ? { ...chicken, alive: false } : chicken,
  );
  const survivors = livingPlayerIds(chickens);
  const finished = survivors.length === 1;
  const nextPlayerId = finished
    ? null
    : nextLivingPlayer({ ...state, chickens }, command.playerId);

  return {
    shot,
    state: {
      ...state,
      chickens,
      status: finished ? "finished" : "active",
      version: state.version + 1,
      turnNumber: state.turnNumber + 1,
      currentPlayerId: nextPlayerId,
      turnDeadline: finished
        ? null
        : new Date(now.getTime() + TURN_SECONDS * 1_000).toISOString(),
      winnerId: finished ? survivors[0] : null,
    },
  };
}

export function skipExpiredTurn(
  state: GameState,
  now = new Date(),
): GameState {
  if (state.status !== "active" || !state.currentPlayerId || !state.turnDeadline) {
    throw new GameRuleError("This match does not have an active turn.");
  }
  if (now.getTime() < new Date(state.turnDeadline).getTime()) {
    throw new GameRuleError("The current turn has not expired.");
  }

  const nextPlayerId = nextLivingPlayer(state, state.currentPlayerId);
  if (!nextPlayerId) {
    throw new GameRuleError("No player can receive the next turn.");
  }

  return {
    ...state,
    version: state.version + 1,
    turnNumber: state.turnNumber + 1,
    currentPlayerId: nextPlayerId,
    turnDeadline: new Date(now.getTime() + TURN_SECONDS * 1_000).toISOString(),
  };
}

export function resignMatch(
  state: GameState,
  playerId: string,
): GameState {
  if (state.status !== "active") {
    throw new GameRuleError("This match is not active.");
  }
  if (!state.players.some((player) => player.id === playerId)) {
    throw new GameRuleError("Player is not part of this match.");
  }

  const chickens = state.chickens.map((chicken) =>
    chicken.ownerId === playerId ? { ...chicken, alive: false } : chicken,
  );
  const survivors = livingPlayerIds(chickens);
  return {
    ...state,
    chickens,
    status: "finished",
    version: state.version + 1,
    turnNumber: state.turnNumber + 1,
    currentPlayerId: null,
    turnDeadline: null,
    winnerId: survivors.length === 1 ? survivors[0] : null,
  };
}
