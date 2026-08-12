import { AppShell } from "@/components/app-shell";
import { AuthScreen } from "@/components/auth/auth-screen";
import { Onboarding } from "@/components/auth/onboarding";
import { findCurrentMatch } from "@/lib/matches/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { authError } = await searchParams;
    return <AuthScreen confirmationError={Boolean(authError)} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, country_code, rating, wins, losses, games_played")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return <Onboarding userId={user.id} email={user.email ?? ""} />;

  const initialMatch = await findCurrentMatch(user.id);
  return (
    <AppShell
      profile={profile}
      initialMatch={initialMatch}
      userId={user.id}
    />
  );
}
