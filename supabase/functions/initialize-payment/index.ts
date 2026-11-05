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

type CheckoutRequest = {
  venue_id: string;
  booking_type: "individual" | "group";
  quantity: number;
  policy: {
    version: string;
    accepted: boolean;
  };
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
  valid_until: string;
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
  if (!isRecord(input) || !isRecord(input.customer) || !isRecord(input.policy)) {
    throw new HttpError(400, "invalid_request", "Checkout details are incomplete");
  }

  const venueId = typeof input.venue_id === "string"
    ? input.venue_id.trim()
    : "";
  if (!UUID_PATTERN.test(venueId)) {
    throw new HttpError(400, "invalid_venue", "Select a valid venue");
  }
  const bookingType = input.booking_type;
  const quantity = input.quantity;
  if ((bookingType !== "individual" && bookingType !== "group")
    || !Number.isInteger(quantity)
    || (bookingType === "group" ? quantity !== 15 : Number(quantity) < 1 || Number(quantity) > 15)) {
    throw new HttpError(400, "invalid_ticket_selection", bookingType === "group"
      ? "The group package is for exactly 15 guests"
      : "Choose between 1 and 15 individual admissions");
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
  if (input.policy.accepted !== true || input.policy.version !== "hyperview-flex-pass-v1") {
    throw new HttpError(400, "policy_not_accepted", "Accept the booking policy before payment");
  }

  return {
    venue_id: venueId,
    booking_type: bookingType,
    quantity: Number(quantity),
    policy: { version: "hyperview-flex-pass-v1", accepted: true },
    customer: { name, email, phone },
  };
}

function databaseError(error: { message?: string } | null): HttpError {
  const message = error?.message ?? "";
  if (message.includes("SCREENING_NOT_FOUND")) {
    return new HttpError(404, "screening_not_found", "The session was not found");
  }
  if (message.includes("VENUE_NOT_ACTIVE")) {
    return new HttpError(409, "venue_unavailable", "This venue is not currently accepting online admission");
  }
  if (message.includes("ADMISSION_WINDOW_CLOSED")) {
    return new HttpError(409, "window_closed", "This admission window has just closed. Refresh to see the new validity period");
  }
  if (message.includes("SCREENING_NOT_ON_SALE") || message.includes("SALES_CLOSED")) {
    return new HttpError(409, "sales_closed", "Bookings are not currently open for this session");
  }
  if (message.includes("TICKET_TYPE_NOT_AVAILABLE")) {
    return new HttpError(409, "ticket_unavailable", "A selected ticket type is no longer available");
  }
  if (message.includes("INSUFFICIENT_CAPACITY")) {
    return new HttpError(409, "insufficient_capacity", "There are not enough tickets remaining");
  }
  if (message.includes("PRICE_RULE_NOT_FOUND")) {
    return new HttpError(409, "price_unavailable", "Admission pricing has not been configured for this venue");
  }
  if (message.includes("GROUP_PRICE_NOT_CONFIGURED")) {
    return new HttpError(409, "group_price_unavailable", "Group pricing has not been configured for this venue");
  }
  if (message.includes("INVALID_GROUP_SIZE") || message.includes("INVALID_GROUP_CAPACITY")) {
    return new HttpError(409, "invalid_group_session", "This group session must be reserved for exactly 15 guests");
  }
  if (message.includes("POLICY_NOT_ACCEPTED")) {
    return new HttpError(400, "policy_not_accepted", "Accept the booking policy before payment");
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
      const policyAcceptedAt = new Date().toISOString();
      const { data, error } = await admin.rpc("create_hyperview_flex_order", {
        p_venue_id: checkout.venue_id,
        p_booking_type: checkout.booking_type,
        p_quantity: checkout.quantity,
        p_customer_name: checkout.customer.name,
        p_customer_email: checkout.customer.email,
        p_customer_phone: checkout.customer.phone,
        p_access_token_hash: accessTokenHash,
        p_policy_version: checkout.policy.version,
        p_policy_accepted_at: policyAcceptedAt,
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
              product: "hyperview_flexible_admission",
              policy_version: checkout.policy.version,
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
        valid_until: order.valid_until,
      }, 201);
    } catch (error) {
      return handleError(request, error);
    }
  },
};
