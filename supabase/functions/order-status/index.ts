import "@supabase/functions-js/edge-runtime.d.ts";
import { getSiteUrl, requireEnv } from "../_shared/config.ts";
import { hmacHex } from "../_shared/crypto.ts";
import {
  assertAllowedOrigin,
  clientAddress,
  handleError,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJson,
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const REFERENCE_PATTERN = /^C57-[A-Z0-9]{16,40}$/u;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/u;

type TicketSummary = {
  public_id: string;
  status: string;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  ticket_type: string;
};

type OrderStatusResult = {
  booking_public_id: string;
  reference: string;
  status: string;
  amount_kobo: number | string;
  currency: string;
  expires_at: string;
  paid_at: string | null;
  customer_name: string;
  quantity: number | string;
  movie_title: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  venue_city: string;
  venue_timezone: string;
  tickets: TicketSummary[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
      }

      assertAllowedOrigin(request);
      const body = await readJson(request, 4_096);
      if (!isRecord(body)) {
        throw new HttpError(400, "invalid_request", "Order reference and access token are required");
      }

      const reference = typeof body.reference === "string"
        ? body.reference.trim().toUpperCase()
        : "";
      const accessToken = typeof body.order_access_token === "string"
        ? body.order_access_token.trim()
        : "";

      if (!REFERENCE_PATTERN.test(reference) || !ACCESS_TOKEN_PATTERN.test(accessToken)) {
        throw new HttpError(404, "order_not_found", "Order not found");
      }

      const hashSecret = requireEnv("TICKET_HASH_SECRET");
      const admin = getAdminClient();
      const rateLimitKey = await hmacHex(
        hashSecret,
        `order-status|${clientAddress(request)}|${reference}`,
      );
      const { data: allowed, error: rateLimitError } = await admin.rpc(
        "check_checkout_rate_limit",
        {
          p_key_hash: rateLimitKey,
          p_limit: 30,
          p_window_seconds: 600,
          p_block_seconds: 900,
        },
      );

      if (rateLimitError) throw rateLimitError;
      if (!allowed) {
        throw new HttpError(429, "rate_limited", "Too many status checks. Please try again later");
      }

      const accessTokenHash = await hmacHex(hashSecret, accessToken);
      const { data, error } = await admin.rpc("get_order_status_by_token", {
        p_reference: reference,
        p_access_token_hash: accessTokenHash,
      });

      if (error) throw error;
      if (!data) {
        throw new HttpError(404, "order_not_found", "Order not found");
      }

      const result = data as OrderStatusResult;
      const siteUrl = getSiteUrl();
      const tickets = Array.isArray(result.tickets)
        ? result.tickets.map((ticket) => ({
          public_id: ticket.public_id,
          status: ticket.status,
          is_active: ticket.is_active,
          valid_from: ticket.valid_from,
          valid_until: ticket.valid_until,
          ticket_type: ticket.ticket_type,
          ticket_url: `${siteUrl}/ticket/${ticket.public_id}`,
        }))
        : [];

      return jsonResponse(request, {
        booking_public_id: result.booking_public_id,
        booking_url: `${siteUrl}/booking/${result.booking_public_id}`,
        reference: result.reference,
        status: result.status,
        amount_kobo: Number(result.amount_kobo),
        currency: result.currency,
        expires_at: result.expires_at,
        paid_at: result.paid_at,
        customer_name: result.customer_name,
        quantity: Number(result.quantity),
        movie_title: result.movie_title,
        starts_at: result.starts_at,
        ends_at: result.ends_at,
        venue_name: result.venue_name,
        venue_city: result.venue_city,
        venue_timezone: result.venue_timezone,
        tickets,
        requires_support: result.status === "payment_review",
      });
    } catch (error) {
      return handleError(request, error);
    }
  },
};
