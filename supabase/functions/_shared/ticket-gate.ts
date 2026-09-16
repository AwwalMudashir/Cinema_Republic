import { requireEnv } from "./config.ts";
import { hmacHex } from "./crypto.ts";
import {
  assertAllowedOrigin,
  handleError,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJson,
} from "./http.ts";
import { getAdminClient } from "./supabase.ts";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type GateAction = "verify" | "redeem";

function ticketId(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "invalid_ticket_id", "A ticket ID is required");
  }
  const value = (body as Record<string, unknown>).ticket_id;
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new HttpError(400, "invalid_ticket_id", "Enter a valid ticket ID");
  }
  return value.trim().toLowerCase();
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~+/-]+)$/iu.exec(authorization);
  if (!match || match[1].startsWith("sb_")) {
    throw new HttpError(401, "authentication_required", "Staff sign-in is required");
  }
  return match[1];
}

export function posterUrl(path: unknown): string | null {
  if (typeof path !== "string" || !path.trim()) return null;
  return getAdminClient().storage.from("movie-posters").getPublicUrl(path).data.publicUrl;
}

export async function handleStaffGate(request: Request, action: GateAction): Promise<Response> {
  try {
    if (request.method === "OPTIONS") return optionsResponse(request);
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
    }
    assertAllowedOrigin(request);

    const token = bearerToken(request);
    const admin = getAdminClient();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) {
      throw new HttpError(401, "invalid_session", "Staff session has expired");
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "check_in_staff" && profile?.role !== "admin") {
      throw new HttpError(403, "check_in_forbidden", "This account cannot check in guests");
    }

    const id = ticketId(await readJson(request, 2_048));
    const keyHash = await hmacHex(
      requireEnv("TICKET_HASH_SECRET"),
      `gate|${action}|${auth.user.id}`,
    );
    const { data: allowed, error: limitError } = await admin.rpc(
      "check_checkout_rate_limit",
      {
        p_key_hash: keyHash,
        p_limit: 90,
        p_window_seconds: 60,
        p_block_seconds: 60,
      },
    );
    if (limitError) throw limitError;
    if (!allowed) {
      throw new HttpError(429, "rate_limited", "Too many scans. Please wait a minute");
    }

    const rpc = action === "verify" ? "verify_ticket_staff" : "redeem_ticket_staff";
    const { data, error } = await admin.rpc(rpc, {
      p_public_id: id,
      p_staff_user_id: auth.user.id,
    });
    if (error) {
      if (error.message.includes("CHECK_IN_FORBIDDEN")) {
        throw new HttpError(403, "check_in_forbidden", "This account cannot check in guests");
      }
      throw error;
    }

    const result = data as Record<string, unknown>;
    if (result?.movie && typeof result.movie === "object") {
      const movie = result.movie as Record<string, unknown>;
      result.movie = { ...movie, poster_url: posterUrl(movie.poster_path) };
      delete (result.movie as Record<string, unknown>).poster_path;
    }
    return jsonResponse(request, result, result?.reason === "not_found" ? 404 : 200);
  } catch (error) {
    return handleError(request, error);
  }
}
