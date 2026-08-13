import { CHICK_RADIUS } from "./constants";
import { GameRuleError, getActiveChicken, traceShot } from "./engine";
import type { ChickState, GameState, ShotResult } from "./types";

const curvatures = [
  0,
  -0.003,
  0.003,
  -0.006,
  0.006,
  -0.009,
  0.009,
  -0.012,
  0.012,
  -0.016,
  0.016,
  -0.021,
  0.021,
  -0.027,
  0.027,
  -0.034,
  0.034,
  -0.042,
  0.042,
] as const;

const aimOffsets = [0, -2.6, 2.6, -4.2, 4.2] as const;

interface Candidate {
  expression: string;
  shot: ShotResult;
  distance: number;
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function relativeX(origin: number): string {
  if (origin === 0) return "x";
  return origin > 0 ? `(x-${formatNumber(origin)})` : `(x+${formatNumber(-origin)})`;
}

function expressionThrough(
  shooter: ChickState,
  target: ChickState,
  targetOffset: number,
  curvature: number,
): string {
  const dx = target.x - shooter.x;
  const dy = target.y + targetOffset - shooter.y;
  const slope = (dy - curvature * dx * dx) / dx;
  const localX = relativeX(shooter.x);
  const linear = `${formatNumber(Math.abs(slope))}*${localX}`;

  if (curvature === 0) {
    return slope < 0 ? `-${linear}` : linear;
  }

  const quadratic = `${formatNumber(curvature)}*${localX}^2`;
  return `${quadratic}${slope < 0 ? "-" : "+"}${linear}`;
}

function closestEnemyDistance(shot: ShotResult, enemies: ChickState[]): number {
  let closest = Number.POSITIVE_INFINITY;
  for (const point of shot.points) {
    for (const enemy of enemies) {
      closest = Math.min(closest, Math.hypot(point.x - enemy.x, point.y - enemy.y));
    }
  }
  return closest;
}

function fallbackMiss(state: GameState, botId: string): string {
  for (const expression of ["1000*x", "-1000*x"]) {
    const shot = traceShot(state, botId, expression);
    if (!shot.hitChickId) return expression;
  }
  return "1000*x";
}

export function chooseBotExpression(state: GameState, botId: string): string {
  if (state.status !== "active" || state.currentPlayerId !== botId) {
    throw new GameRuleError("The bot can only aim during its own active turn.");
  }

  const shooter = getActiveChicken(state, botId);
  if (!shooter) throw new GameRuleError("The bot has no chickens left.");
  const enemies = state.chickens.filter(
    (chicken) => chicken.ownerId !== botId && chicken.alive,
  );
  if (enemies.length === 0) throw new GameRuleError("The bot has no target.");

  const candidates: Candidate[] = [];
  const expressions = new Set<string>();
  for (const enemy of enemies) {
    for (const targetOffset of aimOffsets) {
      for (const curvature of curvatures) {
        expressions.add(expressionThrough(shooter, enemy, targetOffset, curvature));
      }
    }
  }

  for (const expression of expressions) {
    const shot = traceShot(state, botId, expression);
    const hit = shot.hitChickId
      ? state.chickens.find((chicken) => chicken.id === shot.hitChickId)
      : null;
    if (hit?.ownerId === botId) continue;
    candidates.push({
      expression,
      shot,
      distance: closestEnemyDistance(shot, enemies),
    });
  }

  const hits = candidates.filter((candidate) => {
    if (!candidate.shot.hitChickId) return false;
    return enemies.some((enemy) => enemy.id === candidate.shot.hitChickId);
  });
  const misses = candidates
    .filter((candidate) => !candidate.shot.hitChickId)
    .filter((candidate) => candidate.distance > CHICK_RADIUS * 1.08)
    .sort((left, right) => left.distance - right.distance);

  const botTurn = Math.floor(state.turnNumber / state.players.length);
  const takesAccurateShot = botTurn % 2 === 1;
  if (takesAccurateShot && hits.length > 0) {
    return hits[(state.seed + state.turnNumber) % hits.length].expression;
  }
  if (misses.length > 0) return misses[0].expression;
  if (hits.length > 0 && takesAccurateShot) return hits[0].expression;
  return fallbackMiss(state, botId);
}
