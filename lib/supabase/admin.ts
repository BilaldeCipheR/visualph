import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("supabaseServiceRoleKey"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
