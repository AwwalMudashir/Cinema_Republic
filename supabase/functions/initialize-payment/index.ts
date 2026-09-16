import "@supabase/functions-js/edge-runtime.d.ts";
import { requireEnv, getSiteUrl } from "../_shared/config.ts";
import { hmacHex, randomToken } from "../_shared/crypto.ts";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

type CheckoutItem = {
  ticket_type_id: string;
  quantity: number;
};

type CheckoutRequest = {
  screening_id: string;
  items: CheckoutItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
  };
};

type PendingOrder = {
  order_id: string;
  reference: string;
  amount_kobo: number | string;
  currency: "NGN";
  expires_at: string;
};

type PaystackInitializeResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNigerianPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/gu, "");
  const international = compact.startsWith("0")
    ? `+234${compact.slice(1)}`
    : compact.startsWith("234")
    ? `+${compact}`
    : compact;

  return /^\+234[789][01]\d{8}$/u.test(international) ? international : null;
}

function validateRequest(input: unknown): CheckoutRequest {
  if (!isRecord(input) || !isRecord(input.customer) || !Array.isArray(input.items)) {
    throw new HttpError(400, "invalid_request", "Checkout details are incomplete");
  }

  const screeningId = typeof input.screening_id === "string"
    ? input.screening_id.trim()
    : "";
  if (!UUID_PATTERN.test(screeningId)) {
    throw new HttpError(400, "invalid_screening", "Select a valid screening");
  }

  if (input.items.length < 1 || input.items.length > 8) {
    throw new HttpError(400, "invalid_items", "Select between one and eight ticket types");
  }

  const seenTicketTypes = new Set<string>();
  let totalQuantity = 0;
  const items = input.items.map((value) => {
    if (!isRecord(value)) {
      throw new HttpError(400, "invalid_items", "A ticket selection is invalid");
    }

    const ticketTypeId = typeof value.ticket_type_id === "string"
      ? value.ticket_type_id.trim()
      : "";
    const quantity = value.quantity;

    if (!UUID_PATTERN.test(ticketTypeId) || !Number.isInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 8) {
      throw new HttpError(400, "invalid_items", "A ticket selection is invalid");
    }
    if (seenTicketTypes.has(ticketTypeId)) {
      throw new HttpError(400, "duplicate_ticket_type", "Combine duplicate ticket types");
    }

    seenTicketTypes.add(ticketTypeId);
    totalQuantity += Number(quantity);
    return { ticket_type_id: ticketTypeId, quantity: Number(quantity) };
  });

  if (totalQuantity > 8) {
    throw new HttpError(400, "too_many_tickets", "A maximum of eight tickets is allowed per order");
  }

  const name = typeof input.customer.name === "string" ? input.customer.name.trim() : "";
  const email = typeof input.customer.email === "string"
    ? input.customer.email.trim().toLowerCase()
    : "";
  const rawPhone = typeof input.customer.phone === "string" ? input.customer.phone.trim() : "";
  const phone = normalizeNigerianPhone(rawPhone);

  if (name.length < 2 || name.length > 120) {
    throw new HttpError(400, "invalid_name", "Enter a valid customer name");
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, "invalid_email", "Enter a valid email address");
  }
  if (!phone) {
    throw new HttpError(400, "invalid_phone", "Enter a valid Nigerian phone number");
  }

  return {
    screening_id: screeningId,
    items,
    customer: { name, email, phone },
  };
}

function databaseError(error: { message?: string } | null): HttpError {
  const message = error?.message ?? "";
  if (message.includes("SCREENING_NOT_FOUND")) {
    return new HttpError(404, "screening_not_found", "The screening was not found");
  }
  if (message.includes("SCREENING_NOT_ON_SALE") || message.includes("SALES_CLOSED")) {
    return new HttpError(409, "sales_closed", "Tickets are not currently on sale for this screening");
  }
  if (message.includes("TICKET_TYPE_NOT_AVAILABLE")) {
    return new HttpError(409, "ticket_unavailable", "A selected ticket type is no longer available");
  }
  if (message.includes("INSUFFICIENT_CAPACITY")) {
    return new HttpError(409, "insufficient_capacity", "There are not enough tickets remaining");
  }
  if (message.includes("INVALID_")) {
    return new HttpError(400, "invalid_checkout", "The checkout details are invalid");
  }
  return new HttpError(500, "order_creation_failed", "The order could not be created");
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
      }

      assertAllowedOrigin(request);
      const checkout = validateRequest(await readJson(request));
      const admin = getAdminClient();
      const hashSecret = requireEnv("TICKET_HASH_SECRET");

      const rateLimitKey = await hmacHex(
        hashSecret,
        `checkout|${clientAddress(request)}|${checkout.customer.email}`,
      );
      const { data: allowed, error: rateLimitError } = await admin.rpc(
        "check_checkout_rate_limit",
        {
          p_key_hash: rateLimitKey,
          p_limit: 5,
          p_window_seconds: 600,
          p_block_seconds: 900,
        },
      );

      if (rateLimitError) throw databaseError(rateLimitError);
      if (!allowed) {
        throw new HttpError(429, "rate_limited", "Too many checkout attempts. Please try again later");
      }

      const orderAccessToken = randomToken();
      const accessTokenHash = await hmacHex(hashSecret, orderAccessToken);
      const { data, error } = await admin.rpc("create_pending_order", {
        p_screening_id: checkout.screening_id,
        p_items: checkout.items,
        p_customer_name: checkout.customer.name,
        p_customer_email: checkout.customer.email,
        p_customer_phone: checkout.customer.phone,
        p_access_token_hash: accessTokenHash,
        p_user_id: null,
      });

      if (error || !data) throw databaseError(error);
      const order = data as PendingOrder;
      const amount = Number(order.amount_kobo);
      if (!Number.isSafeInteger(amount) || amount <= 0 || order.currency !== "NGN") {
        throw new HttpError(500, "invalid_order_amount", "The calculated order amount is invalid");
      }

      let paystackResponse: Response;
      try {
        paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: checkout.customer.email,
            amount: String(amount),
            currency: "NGN",
            reference: order.reference,
            callback_url: `${getSiteUrl()}/payment/callback`,
            metadata: {
              order_id: order.order_id,
              product: "movie_ticket",
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        await admin.from("orders").update({
          status: "failed",
          updated_at: new Date().toISOString(),
        }).eq("id", order.order_id).eq("status", "pending");
        console.error("Paystack initialization request failed", { orderId: order.order_id, error });
        throw new HttpError(502, "payment_provider_unavailable", "Payment could not be started. Please try again");
      }

      const paystack = await paystackResponse.json().catch(() => ({})) as PaystackInitializeResponse;
      const authorizationUrl = paystack.data?.authorization_url;
      const accessCode = paystack.data?.access_code;
      const returnedReference = paystack.data?.reference;
      let validAuthorizationUrl = false;
      if (authorizationUrl) {
        try {
          const parsedAuthorizationUrl = new URL(authorizationUrl);
          validAuthorizationUrl = parsedAuthorizationUrl.protocol === "https:"
            && parsedAuthorizationUrl.hostname === "checkout.paystack.com";
        } catch {
          validAuthorizationUrl = false;
        }
      }

      if (
        !paystackResponse.ok
        || paystack.status !== true
        || !validAuthorizationUrl
        || !accessCode
        || returnedReference !== order.reference
      ) {
        await admin.from("orders").update({
          status: "failed",
          updated_at: new Date().toISOString(),
        }).eq("id", order.order_id).eq("status", "pending");
        console.error("Paystack rejected transaction initialization", {
          orderId: order.order_id,
          httpStatus: paystackResponse.status,
          providerMessage: paystack.message,
        });
        throw new HttpError(502, "payment_initialization_failed", "Payment could not be started. Please try again");
      }

      return jsonResponse(request, {
        authorization_url: authorizationUrl,
        access_code: accessCode,
        reference: order.reference,
        order_access_token: orderAccessToken,
        expires_at: order.expires_at,
      }, 201);
    } catch (error) {
      return handleError(request, error);
    }
  },
};
