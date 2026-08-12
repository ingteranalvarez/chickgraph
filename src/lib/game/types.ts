export type MatchStatus = "waiting" | "active" | "finished" | "abandoned";

export type PlayerColor = "cyan" | "coral" | "lime" | "yellow";

export interface Point {
  x: number;
  y: number;
}

export interface CircleObstacle extends Point {
  id: string;
  radius: number;
}

export interface GamePlayer {
  id: string;
  username: string;
  countryCode: string;
  color: PlayerColor;
  seat: number;
}

export interface ChickState extends Point {
  id: string;
  ownerId: string;
  slot: number;
  alive: boolean;
}

export interface GameState {
  matchId: string;
  status: MatchStatus;
  version: number;
  seed: number;
  turnNumber: number;
  currentPlayerId: string | null;
  turnDeadline: string | null;
  winnerId: string | null;
  players: GamePlayer[];
  chickens: ChickState[];
  obstacles: CircleObstacle[];
}

export type ShotEndReason =
  | "chicken"
  | "obstacle"
  | "bounds"
  | "invalid-number"
  | "range";

export interface ShotResult {
  expression: string;
  shooterId: string;
  shooterChickId: string;
  turnNumber: number;
  points: Point[];
  endReason: ShotEndReason;
  hitChickId: string | null;
}

export interface FireCommand {
  playerId: string;
  expression: string;
  expectedVersion: number;
}

export interface FireOutcome {
  state: GameState;
  shot: ShotResult;
}
