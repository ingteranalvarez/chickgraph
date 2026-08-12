import type { Tables } from "@/lib/supabase.database.types";

export type PublicProfile = Pick<
  Tables<"profiles">,
  | "id"
  | "username"
  | "country_code"
  | "rating"
  | "wins"
  | "losses"
  | "games_played"
>;
