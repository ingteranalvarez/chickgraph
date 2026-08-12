"use client";

import { CHICK_RADIUS, WORLD } from "@/lib/game/constants";
import type { GameState, ShotResult } from "@/lib/game/types";

const BOARD_WIDTH = 1_000;
const BOARD_HEIGHT = 600;

const screenX = (x: number) =>
  ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * BOARD_WIDTH;
const screenY = (y: number) =>
  BOARD_HEIGHT - ((y - WORLD.minY) / (WORLD.maxY - WORLD.minY)) * BOARD_HEIGHT;

export function GameBoard({
  state,
  shot,
  userId,
}: {
  state: GameState;
  shot: ShotResult | null;
  userId: string;
}) {
  const curve = shot?.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${screenX(point.x).toFixed(2)} ${screenY(point.y).toFixed(2)}`)
    .join(" ");
  const hitChick = shot?.hitChickId
    ? state.chickens.find((chicken) => chicken.id === shot.hitChickId)
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
          {Array.from({ length: 11 }, (_, index) => {
            const x = index * 100;
            return <line key={`grid-x-${x}`} x1={x} x2={x} y1="0" y2={BOARD_HEIGHT} />;
          })}
          {Array.from({ length: 7 }, (_, index) => {
            const y = index * 100;
            return <line key={`grid-y-${y}`} x1="0" x2={BOARD_WIDTH} y1={y} y2={y} />;
          })}
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
              className={`shot-path shot-${state.players.find((player) => player.id === shot?.shooterId)?.color ?? "cyan"}`}
            />
          )}

          {state.chickens.map((chicken) => {
            const player = state.players.find((candidate) => candidate.id === chicken.ownerId);
            if (!player) return null;
            const diameter = (CHICK_RADIUS * 2 * BOARD_WIDTH) / (WORLD.maxX - WORLD.minX);
            const imageSize = diameter * 1.24;
            return (
              <g
                key={chicken.id}
                className={`board-chicken ${chicken.alive ? "alive" : "dead"} ${chicken.ownerId === userId ? "owned" : ""}`}
              >
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

        <g className="axis-labels" aria-hidden="true">
          <text x="10" y={screenY(0) - 8}>-25</text>
          <text x={BOARD_WIDTH - 34} y={screenY(0) - 8}>25</text>
          <text x={screenX(0) + 8} y="18">15</text>
          <text x={screenX(0) + 8} y={BOARD_HEIGHT - 10}>-15</text>
        </g>
      </svg>
      <div className="board-corner-label">NORMAL MODE</div>
    </div>
  );
}
