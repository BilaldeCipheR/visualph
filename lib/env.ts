import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function readEnv(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

export const env = {
  nextPublicSupabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  nextPublicSupabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  productHuntApiToken: readEnv("PH_API_TOKEN"),
  syncSecret: readEnv("SYNC_SECRET")
};

export function requireEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable for ${name}.`);
  }

  return value;
}
