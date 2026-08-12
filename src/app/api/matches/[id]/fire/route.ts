import { z } from "zod";

import { requireUser, routeError } from "@/lib/api/errors";
import { fireShot } from "@/lib/game/engine";
import {
  commitState,
  compactShot,
  getMatchForUser,
} from "@/lib/matches/service";

const fireRequestSchema = z.object({
  expression: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().nonnegative(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = fireRequestSchema.parse(await request.json());
    const { user } = await requireUser();
    const match = await getMatchForUser(id, user.id);
    if (!match.state) throw new Error("The match has not started.");

    const outcome = fireShot(match.state, {
      playerId: user.id,
      expression: body.expression,
      expectedVersion: body.expectedVersion,
    });
    const shot = compactShot(outcome.shot);
    const committed = await commitState(
      id,
      body.expectedVersion,
      outcome.state,
      shot,
    );
    return Response.json({ match: committed, shot });
  } catch (error) {
    return routeError(error);
  }
}
