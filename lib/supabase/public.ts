
import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/env";

export function createSupabasePublicClient() {
  return createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("nextPublicSupabaseAnonKey"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
