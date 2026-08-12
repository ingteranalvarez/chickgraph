import "server-only";

import { createInitialState } from "@/lib/game/engine";
import type { GamePlayer, GameState, ShotResult } from "@/lib/game/types";
import { HttpError, databaseError } from "@/lib/api/errors";
import { serializeMatch } from "@/lib/matches/serialize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase.database.types";

const playerColors = ["cyan", "coral", "lime", "yellow"] as const;
const openStatuses = ["waiting", "starting", "active"];

async function matchRowForUser(matchId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("match_players")
    .select("matches(*)")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(error);
  if (!data?.matches) throw new HttpError("You are not part of this match.", 403);
  return data.matches;
}

async function initializeMatch(current: Tables<"matches">) {
  const admin = createAdminClient();
  if (current.status !== "starting" || current.state) return serializeMatch(current);

  const { data: seats, error: seatsError } = await admin
    .from("match_players")
    .select("user_id, seat, profiles!match_players_user_id_fkey(id, username, country_code)")
    .eq("match_id", current.id)
    .order("seat");
  databaseError(seatsError);
  if (!seats || seats.length < 2) return serializeMatch(current);

  const players: GamePlayer[] = seats.map((seat) => {
    const profile = seat.profiles;
    if (!profile) throw new HttpError("A player profile is missing.", 409);
    return {
      id: profile.id,
      username: profile.username,
      countryCode: profile.country_code,
      seat: seat.seat,
      color: playerColors[seat.seat],
    };
  });
  const state = createInitialState({
    matchId: current.id,
    players,
    seed: current.seed,
  });

  const { data, error } = await admin.rpc("initialize_match", {
    match_id_to_initialize: current.id,
    initial_state: state as unknown as Json,
  });
  databaseError(error);
  return serializeMatch(data);
}

export async function assertParticipant(matchId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("match_players")
    .select("match_id")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(error);
  if (!data) throw new HttpError("You are not part of this match.", 403);
}

export async function getMatchForUser(matchId: string, userId: string) {
  const row = await matchRowForUser(matchId, userId);
  return row.status === "starting" && !row.state
    ? initializeMatch(row)
    : serializeMatch(row);
}

export async function findCurrentMatch(userId: string) {
  const admin = createAdminClient();
  const { data: seats, error: seatsError } = await admin
    .from("match_players")
    .select("joined_at, matches(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(12);
  databaseError(seatsError);
  if (!seats?.length) return null;

  const row = seats
    .map((seat) => seat.matches)
    .find((candidate) => candidate && openStatuses.includes(candidate.status));
  if (!row) return null;

  return row.status === "starting" && !row.state
    ? initializeMatch(row)
    : serializeMatch(row);
}

export async function commitState(
  matchId: string,
  expectedVersion: number,
  state: GameState,
  shot: ShotResult | null,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("commit_match_state", {
    target_match_id: matchId,
    expected_version: expectedVersion,
    next_state: state as unknown as Json,
    shot_result: shot ? (shot as unknown as Json) : undefined,
  });
  databaseError(error);
  return getMatchForUser(matchId, state.players[0].id);
}

export function compactShot(shot: ShotResult, maxPoints = 520): ShotResult {
  if (shot.points.length <= maxPoints) return shot;
  const stride = Math.ceil(shot.points.length / maxPoints);
  const points = shot.points.filter((_, index) => index % stride === 0);
  const lastPoint = shot.points.at(-1);
  if (lastPoint && points.at(-1) !== lastPoint) points.push(lastPoint);
  return { ...shot, points };
}
