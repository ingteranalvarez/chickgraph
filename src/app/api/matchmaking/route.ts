import { databaseError, requireUser, routeError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { findCurrentMatch, getMatchForUser } from "@/lib/matches/service";

export async function GET() {
  try {
    const { user } = await requireUser();
    const match = await findCurrentMatch(user.id);
    if (match) return Response.json({ status: "matched", match });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("matchmaking_queue")
      .select("joined_at")
      .eq("user_id", user.id)
      .maybeSingle();
    databaseError(error);
    return Response.json({
      status: data ? "waiting" : "idle",
      joinedAt: data?.joined_at ?? null,
      match: null,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.rpc("join_public_queue");
    databaseError(error);
    const result = data as { status: string; matchId: string | null };
    const match = result.matchId
      ? await getMatchForUser(result.matchId, user.id)
      : null;
    return Response.json({ status: result.status, match });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE() {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("leave_public_queue");
    databaseError(error);
    return Response.json({ status: "idle" });
  } catch (error) {
    return routeError(error);
  }
}
