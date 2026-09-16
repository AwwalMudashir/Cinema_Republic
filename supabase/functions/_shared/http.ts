import { getAllowedOrigins } from "./config.ts";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function requestOrigin(request: Request): string | null {
  return request.headers.get("origin");
}

export function assertAllowedOrigin(request: Request): void {
  const origin = requestOrigin(request);
  if (origin && !getAllowedOrigins().has(origin)) {
    throw new HttpError(403, "origin_not_allowed", "Origin is not allowed");
  }
}

export function responseHeaders(request: Request): HeadersInit {
  const origin = requestOrigin(request);
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : null;
  const fallbackOrigin = allowedOrigins.values().next().value as string;

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? fallbackOrigin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, idempotency-key, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request),
  });
}

export function optionsResponse(request: Request): Response {
  assertAllowedOrigin(request);
  return new Response(null, { status: 204, headers: responseHeaders(request) });
}

export async function readJson(
  request: Request,
  maxBytes = 16_384,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Expected application/json");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, "request_too_large", "Request body is too large");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new HttpError(413, "request_too_large", "Request body is too large");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }
}

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
}

export function handleError(request: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(request, { error: error.code, message: error.message }, error.status);
  }

  const errorId = crypto.randomUUID();
  console.error("Unhandled function error", { errorId, error });
  return jsonResponse(
    request,
    { error: "internal_error", message: "The request could not be completed", error_id: errorId },
    500,
  );
}
