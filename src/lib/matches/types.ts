import type { GameState, ShotResult } from "@/lib/game/types";

export interface MatchSnapshot {
  id: string;
  kind: string;
  status: string;
  inviteCode: string | null;
  version: number;
  state: GameState | null;
  lastShot: ShotResult | null;
}

export interface ChatMessage {
  id: number;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
}
