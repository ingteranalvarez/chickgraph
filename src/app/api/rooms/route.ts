import { z } from "zod";

import { databaseError, requireUser, routeError } from "@/lib/api/errors";
import { getMatchForUser } from "@/lib/matches/service";

const roomRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({
    action: z.literal("join"),
    code: z.string().trim().length(6).transform((value) => value.toUpperCase()),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = roomRequestSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    const response =
      body.action === "create"
        ? await supabase.rpc("create_private_match")
        : await supabase.rpc("join_private_match", { requested_code: body.code });
    databaseError(response.error);
    const result = response.data as {
      status: string;
      matchId: string;
      inviteCode?: string;
    };
    const match = await getMatchForUser(result.matchId, user.id);
    return Response.json({ status: result.status, match });
  } catch (error) {
    return routeError(error);
  }
}
