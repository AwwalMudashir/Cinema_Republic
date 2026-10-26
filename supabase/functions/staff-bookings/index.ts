import "@supabase/functions-js/edge-runtime.d.ts";
import { requireEnv } from "../_shared/config.ts";
import { hmacHex } from "../_shared/crypto.ts";
import {
  assertAllowedOrigin, handleError, HttpError, jsonResponse, optionsResponse, readJson,
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_ROLES = new Set(["cashier", "supervisor", "check_in_staff", "admin"]);

async function staffActor(request: Request, action: string): Promise<{ id: string; role: string }> {
  const match = /^Bearer ([A-Za-z0-9._~+/-]+)$/iu.exec(request.headers.get("authorization") ?? "");
  if (!match || match[1].startsWith("sb_")) {
    throw new HttpError(401, "authentication_required", "Staff sign-in is required");
  }
  const admin = getAdminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(match[1]);
  if (authError || !auth.user) throw new HttpError(401, "invalid_session", "Staff session has expired");
  const { data: profile, error } = await admin.from("profiles")
    .select("role").eq("id", auth.user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
    throw new HttpError(403, "operations_forbidden", "This account cannot access bookings");
  }
  const key = await hmacHex(requireEnv("TICKET_HASH_SECRET"), `staff|${action}|${auth.user.id}`);
  const { data: allowed, error: rateError } = await admin.rpc("check_checkout_rate_limit", {
    p_key_hash: key, p_limit: 60, p_window_seconds: 60, p_block_seconds: 60,
  });
  if (rateError) throw rateError;
  if (!allowed) throw new HttpError(429, "rate_limited", "Too many requests. Try again shortly");
  return { id: auth.user.id, role: profile.role };
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
      assertAllowedOrigin(request);
      const body = await readJson(request, 4_096);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "invalid_request", "Invalid booking request");
      }
      const input = body as Record<string, unknown>;
      const action = input.action;
      if (action !== "search" && action !== "register_arrival") {
        throw new HttpError(400, "invalid_action", "Unknown booking action");
      }
      const actor = await staffActor(request, String(action));
      const admin = getAdminClient();

      if (action === "search") {
        const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
        const { data, error } = await admin.rpc("staff_search_bookings", {
          p_actor: actor.id, p_query: query, p_limit: 40,
        });
        if (error?.message.includes("OPERATIONS_FORBIDDEN")) {
          throw new HttpError(403, "operations_forbidden", "This account cannot access bookings");
        }
        if (error) throw error;
        return jsonResponse(request, { bookings: data ?? [], role: actor.role });
      }

      if (actor.role !== "cashier" && actor.role !== "admin") {
        throw new HttpError(403, "reception_forbidden", "Only reception staff can register arrivals");
      }
      const orderId = input.order_id;
      const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 300) : null;
      if (typeof orderId !== "string" || !UUID.test(orderId)) {
        throw new HttpError(400, "invalid_order", "Select a valid booking");
      }
      const { data, error } = await admin.rpc("register_booking_arrival", {
        p_actor: actor.id, p_order_id: orderId, p_notes: notes,
      });
      if (error?.message.includes("ORDER_NOT_PAID")) {
        throw new HttpError(409, "order_not_paid", "Payment has not been confirmed for this booking");
      }
      if (error?.message.includes("BOOKING_NOT_ARRIVABLE")) {
        throw new HttpError(409, "booking_not_arrivable", "This booking is cancelled, completed or expired");
      }
      if (error) throw error;
      return jsonResponse(request, data);
    } catch (error) {
      return handleError(request, error);
    }
  },
};
