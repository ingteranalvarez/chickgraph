import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase.database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, publishableKey } = publicSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }
  return browserClient;
}
