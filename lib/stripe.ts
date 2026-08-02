import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazily-constructed singleton so builds/tests without STRIPE_SECRET_KEY don't crash at import time. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-07-29.dahlia",
    });
  }
  return _stripe;
}

/** Percentage of each paid booking the platform keeps as commission, applied via Stripe Connect application_fee_amount. */
export function getPlatformCommissionPct(): number {
  const raw = process.env.PLATFORM_COMMISSION_PCT;
  const pct = raw ? Number(raw) : 15;
  return Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 15;
}

export function calculateApplicationFeeCents(totalPriceCents: number): number {
  return Math.round((totalPriceCents * getPlatformCommissionPct()) / 100);
}
