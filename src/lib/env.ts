export function publicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }
  return {
    url,
    publishableKey,
  };
}

export function serverSupabaseEnv() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing SUPABASE_SECRET_KEY.");
  return {
    ...publicSupabaseEnv(),
    secretKey,
  };
}
