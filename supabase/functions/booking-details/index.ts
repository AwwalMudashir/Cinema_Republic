import "@supabase/functions-js/edge-runtime.d.ts";
import QRCode from "npm:qrcode@1.5.4";
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
import { posterUrl, UUID_PATTERN } from "../_shared/ticket-gate.ts";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint");
      }
      assertAllowedOrigin(request);
      const body = await readJson(request, 2_048);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(404, "booking_not_found", "Booking not found");
      }
      const value = (body as Record<string, unknown>).booking_id;
      if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
        throw new HttpError(404, "booking_not_found", "Booking not found");
      }
      const id = value.trim().toLowerCase();
      const admin = getAdminClient();
      const keyHash = await hmacHex(
        requireEnv("TICKET_HASH_SECRET"),
        `booking-details|${clientAddress(request)}`,
      );
      const { data: allowed, error: limitError } = await admin.rpc(
        "check_checkout_rate_limit",
        { p_key_hash: keyHash, p_limit: 30, p_window_seconds: 600, p_block_seconds: 900 },
      );
      if (limitError) throw limitError;
      if (!allowed) throw new HttpError(429, "rate_limited", "Too many booking requests. Try again later");

      const { data, error } = await admin.rpc("get_public_booking_details", {
        p_public_id: id,
      });
      if (error) throw error;
      if (!data) throw new HttpError(404, "booking_not_found", "Booking not found");

      const result = data as Record<string, unknown>;
      const movie = result.movie as Record<string, unknown>;
      const bookingUrl = `${getSiteUrl()}/booking/${id}`;
      const qrDataUrl = await QRCode.toDataURL(bookingUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: { dark: "#102231", light: "#FFFFFF" },
      });
      return jsonResponse(request, {
        ...result,
        movie: { ...movie, poster_url: posterUrl(movie.poster_path), poster_path: undefined },
        qr_data_url: qrDataUrl,
      });
    } catch (error) {
      return handleError(request, error);
    }
  },
};
