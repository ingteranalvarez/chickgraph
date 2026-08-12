import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("value")?.trim() ?? "";
  if (!/^[A-Za-z0-9_]{3,18}$/.test(username)) {
    return Response.json({ available: false });
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username_key", username.toLowerCase());
  return Response.json({ available: count === 0 });
}
