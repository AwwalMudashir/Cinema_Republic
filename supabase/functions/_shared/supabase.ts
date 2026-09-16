import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { requireEnv } from "./config.ts";

function secretKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const defaultKey = parsed.default ?? Object.values(parsed)[0];
      if (defaultKey) return defaultKey;
    } catch {
      throw new Error("SUPABASE_SECRET_KEYS is not valid JSON");
    }
  }

  // Local stacks and older projects may still provide only the legacy key.
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyKey) return legacyKey;

  throw new Error("No Supabase secret/service-role key is available");
}

let client: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  client ??= createClient(requireEnv("SUPABASE_URL"), secretKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return client;
}
