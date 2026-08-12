import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase.database.types";

let adminClient: ReturnType<typeof createClient<Database>> | undefined;

export function createAdminClient() {
  if (!adminClient) {
    const { url, secretKey } = serverSupabaseEnv();
    adminClient = createClient<Database>(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
