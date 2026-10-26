import QRCode from "npm:qrcode@1.5.4";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { getSiteUrl, requireEnv } from "./config.ts";

type FulfilledTicket = {
  public_id: string;
  ticket_type: string;
  valid_from: string;
  valid_until: string;
};

export type FulfilledOrder = {
  outcome: string;
  order_id: string;
  booking_public_id: string;
  reference: string;
  order_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount_kobo: number | string;
  currency: string;
  quantity: number | string;
  movie_title: string;
  starts_at: string;
  ends_at: string;
  valid_from: string;
  valid_until: string;
  venue_name: string;
  venue_address: string;
  venue_city: string;
  venue_timezone: string;
  email_delivery_id: string | null;
  email_delivery_status: string | null;
  tickets: FulfilledTicket[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function formatNaira(amountKobo: number | string): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(Number(amountKobo) / 100);
}

function textVersion(order: FulfilledOrder, siteUrl: string): string {
  const bookingUrl = `${siteUrl}/booking/${order.booking_public_id}`;

  return [
    `Hi ${order.customer_name},`,
    "",
    `Your full payment for ${order.movie_title} was successful.`,
    `Booking reference: ${order.reference}`,
    `Contact: ${order.customer_email} · ${order.customer_phone}`,
    `Guests: ${order.quantity}`,
    `Total paid: ${formatNaira(order.amount_kobo)}`,
    `Session: ${formatDateTime(order.starts_at, order.venue_timezone)}`,
    `Venue: ${order.venue_name}, ${order.venue_address}, ${order.venue_city}`,
    `Admission opens: ${formatDateTime(order.valid_from, order.venue_timezone)}`,
    `Booking expires: ${formatDateTime(order.valid_until, order.venue_timezone)}`,
    "",
    `Open booking: ${bookingUrl}`,
    "",
    "Arrive at least 15 minutes before the session. Reception will verify this booking and issue physical identification tags.",
    "The booking is valid only for this session. It is non-refundable and cannot be rescheduled.",
    "Keep the booking link and QR code private.",
  ].join("\n");
}

export async function sendTicketEmail(
  admin: SupabaseClient,
  order: FulfilledOrder,
): Promise<void> {
  if (!order.email_delivery_id || order.order_status !== "paid" || order.tickets.length === 0) {
    return;
  }
  if (order.email_delivery_status === "sent") return;

  const deliveryId = order.email_delivery_id;
  const { data: delivery } = await admin
    .from("email_deliveries")
    .select("attempts,status")
    .eq("id", deliveryId)
    .maybeSingle();

  if (delivery?.status === "sent") return;
  const attempts = Number(delivery?.attempts ?? 0) + 1;
  const { error: claimError } = await admin.from("email_deliveries").update({
    status: "sending",
    attempts,
    last_error: null,
  }).eq("id", deliveryId);
  if (claimError) throw new Error(`Could not update email delivery: ${claimError.message}`);

  const siteUrl = getSiteUrl();
  const bookingUrl = `${siteUrl}/booking/${order.booking_public_id}`;
  const dataUrl = await QRCode.toDataURL(bookingUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#121212", light: "#FFFFFF" },
  });
  const contentId = "hyperview-booking";
  const attachments: Array<Record<string, string>> = [{
    content: dataUrl.slice(dataUrl.indexOf(",") + 1),
    filename: `hyperview-${order.reference}.png`,
    content_id: contentId,
    content_type: "image/png",
  }];

  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#f5f1e8;font-family:Arial,sans-serif;color:#171612;">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="background:#171612;color:#fff;padding:22px 26px;border-radius:18px 18px 0 0;">
          <p style="margin:0;color:#d8ad62;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Cinema 57</p>
          <h1 style="margin:8px 0 0;font-size:28px;">Your HyperView session is booked</h1>
        </div>
        <div style="background:#fcfaf5;padding:26px;border-radius:0 0 18px 18px;">
          <p style="margin-top:0;">Hi ${escapeHtml(order.customer_name)},</p>
          <p>Your full payment was successful. Present this booking QR code at reception.</p>
          <div style="padding:18px;background:#efe8da;border-radius:12px;line-height:1.7;">
            <strong>${escapeHtml(order.movie_title)}</strong><br />
            ${escapeHtml(formatDateTime(order.starts_at, order.venue_timezone))}<br />
            ${escapeHtml(order.venue_name)}, ${escapeHtml(order.venue_address)}, ${escapeHtml(order.venue_city)}<br />
            Booking reference: ${escapeHtml(order.reference)}<br />
            Customer: ${escapeHtml(order.customer_name)}<br />
            Contact: ${escapeHtml(order.customer_email)} · ${escapeHtml(order.customer_phone)}<br />
            Guests: ${escapeHtml(order.quantity)}<br />
            Total paid: ${escapeHtml(formatNaira(order.amount_kobo))}
          </div>
          <div style="margin:20px 0;padding:22px;border:1px solid #e7e2d8;border-radius:16px;background:#fff;text-align:center;">
            <p style="margin:0 0 4px;color:#6b665d;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Booking QR</p>
            <img src="cid:${contentId}" width="240" height="240" alt="Booking QR code" style="display:block;width:240px;height:240px;margin:10px auto 14px;" />
            <p style="margin:0;font-family:monospace;color:#171612;">${escapeHtml(order.reference)}</p>
            <p style="margin:12px 0 0;"><a href="${escapeHtml(bookingUrl)}" style="color:#9b6b22;">Open booking confirmation</a></p>
          </div>
          <div style="padding:18px;border-left:4px solid #d89b4a;background:#fff7e8;line-height:1.7;font-size:13px;">
            <strong>Arrival instructions</strong><br />
            Arrive at least 15 minutes before the session. Reception will verify the booking and issue physical identification tags.<br />
            Admission opens ${escapeHtml(formatDateTime(order.valid_from, order.venue_timezone))}. The booking expires ${escapeHtml(formatDateTime(order.valid_until, order.venue_timezone))}.
          </div>
          <p style="margin:24px 0 0;color:#6b665d;font-size:13px;line-height:1.6;">This booking is valid only for the selected session. It is non-refundable and cannot be rescheduled. Keep this QR code private.</p>
        </div>
      </div>
    </body>
  </html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ticket-confirmation/${order.order_id}`,
        "User-Agent": "Cinema57-Ticketing/1.0",
      },
      body: JSON.stringify({
        from: requireEnv("EMAIL_FROM"),
        to: [order.customer_email],
        subject: `HyperView booking confirmed - ${order.reference}`,
        html,
        text: textVersion(order, siteUrl),
        attachments,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const result = await response.json().catch(() => ({})) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };

    if (!response.ok || !result.id) {
      throw new Error(result.message ?? result.error?.message ?? `Resend returned HTTP ${response.status}`);
    }

    const { error: sentUpdateError } = await admin.from("email_deliveries").update({
      provider_message_id: result.id,
      status: "sent",
      last_error: null,
      sent_at: new Date().toISOString(),
    }).eq("id", deliveryId);
    if (sentUpdateError) {
      throw new Error(`Could not record successful email delivery: ${sentUpdateError.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown email error";
    await admin.from("email_deliveries").update({
      status: "failed",
      last_error: message,
    }).eq("id", deliveryId);
    throw error;
  }
}
