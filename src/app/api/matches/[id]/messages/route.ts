import { z } from "zod";

import {
  databaseError,
  requireUser,
  routeError,
} from "@/lib/api/errors";
import { assertParticipant } from "@/lib/matches/service";
import { createAdminClient } from "@/lib/supabase/admin";

const messageSchema = z.object({ body: z.string().trim().min(1).max(240) });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user } = await requireUser();
    await assertParticipant(id, user.id);
    const admin = createAdminClient();
    const { data: messages, error } = await admin
      .from("messages")
      .select("id, user_id, body, created_at")
      .eq("match_id", id)
      .order("created_at", { ascending: true })
      .limit(100);
    databaseError(error);
    const userIds = [...new Set((messages ?? []).map((message) => message.user_id))];
    const { data: profiles, error: profileError } = userIds.length
      ? await admin.from("profiles").select("id, username").in("id", userIds)
      : { data: [], error: null };
    databaseError(profileError);
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));
    return Response.json({
      messages: (messages ?? []).map((message) => ({
        ...message,
        username: names.get(message.user_id) ?? "Unknown",
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { body } = messageSchema.parse(await request.json());
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("send_match_message", {
      target_match_id: id,
      message_body: body,
    });
    databaseError(error);
    return Response.json({ message: data });
  } catch (error) {
    return routeError(error);
  }
}
