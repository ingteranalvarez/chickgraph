import { requireUser, routeError } from "@/lib/api/errors";
import { skipExpiredTurn } from "@/lib/game/engine";
import { commitState, getMatchForUser } from "@/lib/matches/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();
    const match = await getMatchForUser(id, user.id);
    if (!match.state) throw new Error("The match has not started.");
    const state = skipExpiredTurn(match.state);
    return Response.json({
      match: await commitState(id, match.state.version, state, null),
    });
  } catch (error) {
    return routeError(error);
  }
}
