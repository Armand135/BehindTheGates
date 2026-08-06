import type { NextRequest } from "next/server";

/**
 * Resolves the app's public base URL without requiring NEXT_PUBLIC_APP_URL
 * to be set per-environment — Vercel Preview deployments get a fresh URL
 * every time, so a static env var can't track them. Preference order:
 * explicit NEXT_PUBLIC_APP_URL (stable custom domain, e.g. Production) >
 * Vercel's auto-provided VERCEL_URL (Preview/Production) > the incoming
 * request's own origin (local dev).
 */
export function resolveAppUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(req.url).origin;
}
