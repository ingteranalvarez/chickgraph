import { databaseError, routeError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, country_code, rating, wins, losses, games_played")
      .order("rating", { ascending: false })
      .order("wins", { ascending: false })
      .limit(100);
    databaseError(error);
    return Response.json({ players: data ?? [] });
  } catch (error) {
    return routeError(error);
  }
}
