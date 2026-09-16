export function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getSiteUrl(): string {
  const value = requireEnv("SITE_URL");
  try {
    return new URL(value).origin;
  } catch {
    throw new Error("SITE_URL must be a fully qualified URL");
  }
}

export function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  if (siteUrl) {
    try {
      origins.add(new URL(siteUrl).origin);
    } catch {
      // getSiteUrl() reports the configuration error from handlers that need it.
    }
  }

  for (const value of (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")) {
    const candidate = value.trim();
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      throw new Error(`Invalid ALLOWED_ORIGINS entry: ${candidate}`);
    }
  }

  return origins;
}
