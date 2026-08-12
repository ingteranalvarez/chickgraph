import { HttpError, databaseError, requireUser, routeError } from "@/lib/api/errors";
import { resignMatch } from "@/lib/game/engine";
import { commitState, getMatchForUser } from "@/lib/matches/service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();
    return Response.json({ match: await getMatchForUser(id, user.id) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();
    const match = await getMatchForUser(id, user.id);

    if (match.status === "waiting") {
      const admin = createAdminClient();
      const { data: row, error: readError } = await admin
        .from("matches")
        .select("created_by")
        .eq("id", id)
        .single();
      databaseError(readError);
      if (!row) throw new HttpError("Match not found.", 404);
      if (row.created_by !== user.id) {
        throw new HttpError("Only the room creator can cancel it.", 403);
      }
      const { error } = await admin
        .from("matches")
        .update({ status: "abandoned" })
        .eq("id", id)
        .eq("status", "waiting");
      databaseError(error);
      return Response.json({ status: "abandoned" });
    }

    if (match.state?.status === "active") {
      const state = resignMatch(match.state, user.id);
      return Response.json({ match: await commitState(id, match.state.version, state, null) });
    }

    return Response.json({ status: match.status });
  } catch (error) {
    return routeError(error);
  }
}
