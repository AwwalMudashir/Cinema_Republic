import "@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";
import {
  assertAllowedOrigin, handleError, HttpError, jsonResponse, optionsResponse, readJson,
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type DeleteResult = {
  deleted: boolean;
  reason?: string;
  title?: string;
  starts_at?: string;
  session_count?: number;
  order_count?: number;
  customer_booking_count?: number;
  ticket_count?: number;
};

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function blockedMessage(action: string, result: DeleteResult): string {
  const title = result.title ? `“${result.title}”` : "This item";
  const sessions = Number(result.session_count ?? 0);
  const orders = Number(result.order_count ?? 0);
  const bookings = Number(result.customer_booking_count ?? 0);
  const tickets = Number(result.ticket_count ?? 0);

  if (result.reason === "sessions_exist") {
    return `${title} cannot be deleted because it still has ${plural(sessions, "session")}. `
      + "Open Sessions and delete each unused session first. If a session has any checkout or booking history, archive the movie instead.";
  }
  if (result.reason === "booking_history_exists") {
    const scope = action === "delete_movie" && sessions > 0
      ? ` across ${plural(sessions, "session")}`
      : "";
    return `${title} cannot be deleted because ${plural(bookings, "customer booking")} and ${plural(tickets, "issued admission")} depend on it${scope}. `
      + "Archive the movie or cancel a future session instead. Handle any approved refunds in Paystack; payment and admission history must be retained.";
  }
  if (result.reason === "checkout_history_exists") {
    return `${title} cannot be deleted because ${plural(orders, "checkout record")} already depends on it. `
      + "Archive it instead, or ask technical support to review test-only data. Order history is never removed from this dashboard.";
  }
  return `${title} could not be deleted safely. Archive it and ask technical support to review its history.`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
      assertAllowedOrigin(request);

      const body = await readJson(request, 2_048);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "invalid_request", "Invalid catalogue request");
      }
      const input = body as Record<string, unknown>;
      const action = input.action;
      if (action !== "delete_movie" && action !== "delete_screening") {
        throw new HttpError(400, "invalid_action", "Unknown catalogue action");
      }

      const entityId = action === "delete_movie" ? input.movie_id : input.screening_id;
      if (typeof entityId !== "string" || !UUID.test(entityId)) {
        throw new HttpError(400, "invalid_entity", "Select a valid movie or session");
      }

      const actor = await requireAdmin(request, `catalogue:${action}`);
      const admin = getAdminClient();
      const rpc = action === "delete_movie" ? "admin_delete_movie" : "admin_delete_screening";
      const parameters = action === "delete_movie"
        ? { p_actor: actor, p_movie_id: entityId }
        : { p_actor: actor, p_screening_id: entityId };
      const { data, error } = await admin.rpc(rpc, parameters);

      if (error?.message.includes("MOVIE_NOT_FOUND") || error?.message.includes("SCREENING_NOT_FOUND")) {
        throw new HttpError(404, "not_found", "This item no longer exists");
      }
      if (error?.message.includes("ADMIN_FORBIDDEN")) {
        throw new HttpError(403, "admin_forbidden", "Only an admin can permanently delete catalogue records");
      }
      if (error) throw error;

      const result = data as DeleteResult | null;
      if (!result) throw new Error("Catalogue deletion returned no result");
      if (!result.deleted) {
        throw new HttpError(409, result.reason ?? "delete_blocked", blockedMessage(action, result));
      }
      return jsonResponse(request, result);
    } catch (error) {
      return handleError(request, error);
    }
  },
};
