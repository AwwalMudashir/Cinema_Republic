import "@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";
import {
  assertAllowedOrigin, handleError, HttpError, jsonResponse, optionsResponse, readJson,
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { sendTicketEmail, type FulfilledOrder } from "../_shared/ticket-email.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
      assertAllowedOrigin(request);
      const body = await readJson(request, 2_048);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "invalid_request", "Invalid order request");
      }
      const input = body as Record<string, unknown>;
      const action = input.action;
      if (action !== "search" && action !== "retry_email") {
        throw new HttpError(400, "invalid_action", "Unknown order action");
      }
      const actor = await requireAdmin(request, `orders:${action}`);
      const admin = getAdminClient();
      if (action === "search") {
        const query = typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
        const { data, error } = await admin.rpc("admin_search_orders", {
          p_actor: actor, p_query: query, p_limit: 30,
        });
        if (error) throw error;
        const orders = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
        if (orders.length === 0) return jsonResponse(request, { orders });
        const { data: refunds, error: refundError } = await admin.from("refund_events")
          .select("order_id,status,amount_kobo,received_at")
          .in("order_id", orders.map((order) => String(order.id)))
          .order("received_at", { ascending: false });
        if (refundError) throw refundError;
        const latest = new Map<string, Record<string, unknown>>();
        for (const refund of refunds ?? []) {
          if (!latest.has(refund.order_id)) latest.set(refund.order_id, refund);
        }
        return jsonResponse(request, {
          orders: orders.map((order) => ({ ...order, refund: latest.get(String(order.id)) ?? null })),
        });
      }

      const orderId = input.order_id;
      if (typeof orderId !== "string" || !UUID.test(orderId)) {
        throw new HttpError(400, "invalid_order", "Select a valid order");
      }
      const { data, error } = await admin.rpc("payment_order_payload", {
        p_order_id: orderId, p_outcome: "paid",
      });
      if (error) throw error;
      const order = data as FulfilledOrder | null;
      if (!order) throw new HttpError(404, "order_not_found", "Order not found");
      if (order.order_status !== "paid" || !order.email_delivery_id) {
        throw new HttpError(409, "email_unavailable", "Only paid orders with tickets can be emailed");
      }
      if (order.email_delivery_status === "sent") {
        throw new HttpError(409, "email_already_sent", "This ticket email was already sent");
      }
      await sendTicketEmail(admin, order);
      return jsonResponse(request, { sent: true });
    } catch (error) {
      return handleError(request, error);
    }
  },
};
