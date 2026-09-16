import "@supabase/functions-js/edge-runtime.d.ts";
import { requireEnv } from "../_shared/config.ts";
import { hmacHex, timingSafeEqualHex } from "../_shared/crypto.ts";
import { sendTicketEmail, type FulfilledOrder } from "../_shared/ticket-email.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const MAX_WEBHOOK_BYTES = 1_048_576;
const REFERENCE_PATTERN = /^C57-[A-Z0-9]{16,40}$/u;
const REFUND_EVENTS = new Set([
  "refund.pending", "refund.processing", "refund.needs-attention",
  "refund.failed", "refund.processed",
]);

type PaystackEvent = {
  event?: unknown;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safePaystackPayload(event: string, data: Record<string, unknown>): Record<string, unknown> {
  const customer = isRecord(data.customer) ? data.customer : {};
  return {
    event,
    data: {
      id: data.id,
      domain: data.domain,
      status: data.status,
      reference: data.reference,
      amount: data.amount,
      currency: data.currency,
      paid_at: data.paid_at,
      channel: data.channel,
      gateway_response: data.gateway_response,
      fees: data.fees,
      customer: {
        customer_code: customer.customer_code,
        email: customer.email,
      },
    },
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return response({ error: "method_not_allowed" }, 405);
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
      return response({ error: "request_too_large" }, 413);
    }

    try {
      const rawBody = await request.arrayBuffer();
      if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
        return response({ error: "request_too_large" }, 413);
      }

      const receivedSignature = request.headers.get("x-paystack-signature")?.trim().toLowerCase() ?? "";
      const expectedSignature = await hmacHex(
        requireEnv("PAYSTACK_SECRET_KEY"),
        rawBody,
        "SHA-512",
      );

      if (!timingSafeEqualHex(receivedSignature, expectedSignature)) {
        console.warn("Rejected Paystack webhook with an invalid signature");
        return response({ error: "invalid_signature" }, 401);
      }

      let payload: PaystackEvent;
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBody)) as PaystackEvent;
      } catch {
        return response({ error: "invalid_json" }, 400);
      }

      if (typeof payload.event === "string" && REFUND_EVENTS.has(payload.event)) {
        if (!isRecord(payload.data)) return response({ error: "invalid_event" }, 400);
        const refund = payload.data;
        const reference = typeof refund.transaction_reference === "string"
          ? refund.transaction_reference.trim().toUpperCase() : "";
        const status = payload.event.slice("refund.".length);
        const amount = Number(refund.amount);
        const currency = typeof refund.currency === "string" ? refund.currency.trim().toUpperCase() : "";
        if (!REFERENCE_PATTERN.test(reference) || refund.status !== status
          || !Number.isSafeInteger(amount) || amount <= 0 || currency !== "NGN") {
          return response({ error: "invalid_event" }, 400);
        }
        const providerId = String(refund.id ?? refund.refund_reference ?? reference);
        const admin = getAdminClient();
        const { data: result, error } = await admin.rpc("process_paystack_refund_event", {
          p_event_key: `paystack:${payload.event}:${providerId}`,
          p_provider_reference: reference,
          p_status: status,
          p_amount_kobo: amount,
          p_currency: currency,
          p_payload: { event: payload.event, data: {
            id: refund.id, transaction_reference: reference,
            refund_reference: refund.refund_reference, status, amount, currency,
          } },
        });
        if (error) {
          console.error("Paystack refund processing failed", { reference, databaseCode: error.code, databaseMessage: error.message });
          return response({ error: "processing_failed" }, 500);
        }
        if (result?.outcome === "partial_review") {
          console.warn("Partial refund requires admin review", { reference });
        }
        return response({ received: true });
      }
      if (payload.event !== "charge.success") {
        return response({ received: true, ignored: true });
      }
      if (!isRecord(payload.data)) {
        return response({ error: "invalid_event" }, 400);
      }

      const data = payload.data;
      const reference = typeof data.reference === "string"
        ? data.reference.trim().toUpperCase()
        : "";
      const currency = typeof data.currency === "string"
        ? data.currency.trim().toUpperCase()
        : "";
      const amount = Number(data.amount);
      if (
        data.status !== "success"
        || !REFERENCE_PATTERN.test(reference)
        || !Number.isSafeInteger(amount)
        || amount <= 0
        || currency !== "NGN"
      ) {
        console.warn("Rejected malformed Paystack charge.success event", { reference });
        return response({ error: "invalid_event" }, 400);
      }

      const sanitizedPayload = safePaystackPayload("charge.success", data);
      const admin = getAdminClient();
      const { data: result, error } = await admin.rpc("process_paystack_charge_success", {
        p_event_key: `paystack:charge.success:${reference}`,
        p_order_reference: reference,
        p_provider_reference: reference,
        p_amount_kobo: amount,
        p_currency: currency,
        p_payload: sanitizedPayload,
      });

      if (error || !result) {
        console.error("Paystack payment processing failed", {
          reference,
          databaseCode: error?.code,
          databaseMessage: error?.message,
        });
        return response({ error: "processing_failed" }, 500);
      }

      const fulfilledOrder = result as FulfilledOrder;
      if (fulfilledOrder.order_status === "paid") {
        try {
          await sendTicketEmail(admin, fulfilledOrder);
        } catch (error) {
          console.error("Ticket email delivery failed", {
            orderId: fulfilledOrder.order_id,
            error,
          });
          // Payment and tickets have already committed. Email is retryable from
          // the admin Orders screen, so do not ask Paystack to replay payment.
          return response({ received: true, email_delivery: "failed" });
        }
      }

      if (fulfilledOrder.order_status === "payment_review") {
        console.error("Successful payment requires manual review", {
          orderId: fulfilledOrder.order_id,
          reference: fulfilledOrder.reference,
          outcome: fulfilledOrder.outcome,
        });
      }

      return response({ received: true });
    } catch (error) {
      const errorId = crypto.randomUUID();
      console.error("Unhandled Paystack webhook error", { errorId, error });
      return response({ error: "internal_error", error_id: errorId }, 500);
    }
  },
};
