import { requireEnv } from "./config.ts";
import { hmacHex } from "./crypto.ts";
import { HttpError } from "./http.ts";
import { getAdminClient } from "./supabase.ts";

export async function requireAdmin(request: Request, action: string): Promise<string> {
  const match = /^Bearer ([A-Za-z0-9._~+/-]+)$/iu.exec(request.headers.get("authorization") ?? "");
  if (!match || match[1].startsWith("sb_")) {
    throw new HttpError(401, "authentication_required", "Admin sign-in is required");
  }

  const admin = getAdminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(match[1]);
  if (authError || !auth.user) {
    throw new HttpError(401, "invalid_session", "Admin session has expired");
  }
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("role").eq("id", auth.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin") {
    throw new HttpError(403, "admin_forbidden", "This account is not an admin");
  }

  const key = await hmacHex(requireEnv("TICKET_HASH_SECRET"), `admin|${action}|${auth.user.id}`);
  const { data: allowed, error: rateError } = await admin.rpc("check_checkout_rate_limit", {
    p_key_hash: key, p_limit: 30, p_window_seconds: 60, p_block_seconds: 60,
  });
  if (rateError) throw rateError;
  if (!allowed) throw new HttpError(429, "rate_limited", "Too many requests. Try again shortly");
  return auth.user.id;
}
