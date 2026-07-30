import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("nextPublicSupabaseAnonKey")
  );
}
