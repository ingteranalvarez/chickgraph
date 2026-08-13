"use client";

import { CHICK_RADIUS, WORLD } from "@/lib/game/constants";
import { getActiveChicken } from "@/lib/game/engine";
import type { GameState, ShotResult } from "@/lib/game/types";

const BOARD_WIDTH = 1_000;
const BOARD_HEIGHT = 600;
const GRID_STEP = 5;
const xTicks = Array.from(
  { length: (WORLD.maxX - WORLD.minX) / GRID_STEP + 1 },
  (_, index) => WORLD.minX + index * GRID_STEP,
);
const yTicks = Array.from(
  { length: (WORLD.maxY - WORLD.minY) / GRID_STEP + 1 },
  (_, index) => WORLD.minY + index * GRID_STEP,
);

const screenX = (x: number) =>
  ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * BOARD_WIDTH;
const screenY = (y: number) =>
  BOARD_HEIGHT - ((y - WORLD.minY) / (WORLD.maxY - WORLD.minY)) * BOARD_HEIGHT;

export function GameBoard({
  state,
  shot,
  userId,
  targetChickId,
  preview = false,
}: {
  state: GameState;
  shot: ShotResult | null;
  userId: string;
  targetChickId?: string;
  preview?: boolean;
}) {
  const curve = shot?.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${screenX(point.x).toFixed(2)} ${screenY(point.y).toFixed(2)}`)
    .join(" ");
  const hitChick = shot?.hitChickId
    ? state.chickens.find((chicken) => chicken.id === shot.hitChickId)
    : null;
  const activeShooter =
    state.status === "active" && state.currentPlayerId
      ? getActiveChicken(state, state.currentPlayerId)
      : null;

  return (
    <div className="board-wrap">
      <svg
        className="game-board"
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        role="img"
        aria-label="Mathematical battle arena"
      >
        <defs>
          <clipPath id="arena-clip"><rect width={BOARD_WIDTH} height={BOARD_HEIGHT} /></clipPath>
          <filter id="chick-shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#171817" floodOpacity=".2" />
          </filter>
          <pattern id="obstacle-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="9" height="9" fill="#303231" />
            <rect width="3" height="9" fill="#3f4240" />
          </pattern>
        </defs>

        <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} className="board-background" />
        <g className="board-grid">
          {xTicks.map((value) => (
            <line key={`grid-x-${value}`} x1={screenX(value)} x2={screenX(value)} y1="0" y2={BOARD_HEIGHT} />
          ))}
          {yTicks.map((value) => (
            <line key={`grid-y-${value}`} x1="0" x2={BOARD_WIDTH} y1={screenY(value)} y2={screenY(value)} />
          ))}
        </g>
        <g className="board-axes">
          <line x1={screenX(0)} x2={screenX(0)} y1="0" y2={BOARD_HEIGHT} />
          <line x1="0" x2={BOARD_WIDTH} y1={screenY(0)} y2={screenY(0)} />
        </g>

        <g clipPath="url(#arena-clip)">
          {state.obstacles.map((obstacle) => (
            <g key={obstacle.id} className="obstacle">
              <circle
                cx={screenX(obstacle.x)}
                cy={screenY(obstacle.y)}
                r={(obstacle.radius / (WORLD.maxX - WORLD.minX)) * BOARD_WIDTH}
                fill="url(#obstacle-hatch)"
              />
              <circle
                cx={screenX(obstacle.x) - obstacle.radius * 5}
                cy={screenY(obstacle.y) - obstacle.radius * 5}
                r={obstacle.radius * 2.5}
                className="obstacle-highlight"
              />
            </g>
          ))}

          {curve && (
            <path
              key={`${shot?.turnNumber}-${shot?.expression}`}
              d={curve}
              pathLength="1"
              className={`shot-path shot-${state.players.find((player) => player.id === shot?.shooterId)?.color ?? "cyan"} ${preview ? "shot-preview" : ""}`}
            />
          )}

          {state.chickens.map((chicken) => {
            const player = state.players.find((candidate) => candidate.id === chicken.ownerId);
            if (!player) return null;
            const diameter = (CHICK_RADIUS * 2 * BOARD_WIDTH) / (WORLD.maxX - WORLD.minX);
            const imageSize = diameter * 1.24;
            const isActiveShooter = activeShooter?.id === chicken.id;
            const isTarget = targetChickId === chicken.id;
            return (
              <g
                key={chicken.id}
                className={`board-chicken ${chicken.alive ? "alive" : "dead"} ${chicken.ownerId === userId ? "owned" : ""} ${isActiveShooter ? "active-shooter" : ""}`}
                data-chick-id={chicken.id}
              >
                {isActiveShooter && (
                  <circle
                    cx={screenX(chicken.x)}
                    cy={screenY(chicken.y)}
                    r={diameter / 2 + 9}
                    className={`active-shooter-halo halo-${player.color}`}
                  />
                )}
                {isTarget && (
                  <circle
                    cx={screenX(chicken.x)}
                    cy={screenY(chicken.y)}
                    r={diameter / 2 + 11}
                    className="tutorial-target-halo"
                  />
                )}
                <circle
                  cx={screenX(chicken.x)}
                  cy={screenY(chicken.y)}
                  r={diameter / 2}
                  className="chicken-hitbox"
                />
                <image
                  href={`/chickens/${player.color}.png`}
                  x={screenX(chicken.x) - imageSize / 2}
                  y={screenY(chicken.y) - imageSize / 2}
                  width={imageSize}
                  height={imageSize}
                  filter="url(#chick-shadow)"
                />
              </g>
            );
          })}

          {hitChick && (
            <circle
              key={`hit-${shot?.turnNumber}`}
              cx={screenX(hitChick.x)}
              cy={screenY(hitChick.y)}
              r="22"
              className="impact-ring"
            />
          )}
        </g>

        <g className="axis-labels axis-labels-x" aria-hidden="true">
          {xTicks.map((value) => (
            <text
              key={`label-x-${value}`}
              x={Math.min(BOARD_WIDTH - 7, Math.max(7, screenX(value)))}
              y={screenY(0) + 19}
              textAnchor={value === WORLD.minX ? "start" : value === WORLD.maxX ? "end" : "middle"}
            >
              {value}
            </text>
          ))}
        </g>
        <g className="axis-labels axis-labels-y" aria-hidden="true">
          {yTicks.filter((value) => value !== 0).map((value) => (
            <text
              key={`label-y-${value}`}
              x={screenX(0) + 8}
              y={Math.min(BOARD_HEIGHT - 9, Math.max(14, screenY(value) - 7))}
            >
              {value}
            </text>
          ))}
        </g>
      </svg>
      <div className="board-corner-label">{preview ? "LIVE PREVIEW" : "NORMAL MODE"}</div>
    </div>
  );
}
