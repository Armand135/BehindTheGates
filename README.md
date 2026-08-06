# BehindTheGates
Behind The Gates is a booking platform for guided visits inside real, working companies — factories, refineries, ports — giving students, career-explorers, and the curious a seat on tours that don't normally exist.

There's no way to book a visit to see how a real business actually operates — a car plant, an oil refinery, a container port — the way you'd book a museum ticket. Behind The Gates fixes that: a GetYourGuide-style marketplace where companies open their doors for guided tours, and visitors — especially students deciding on a career — book a seat online. For companies, it's a low-effort recruiting and employer-branding channel; for visitors, it's the closest thing to trying a career on before choosing one.

Behind The Gates is an online marketplace for booking guided visits to real operating companies — manufacturing plants, energy facilities, logistics hubs, and other sites people are curious about but can't normally access. Think GetYourGuide, but instead of museums and city tours, the inventory is working businesses: a Porsche assembly line, an oil refinery, a container port. The primary audience is students and career-explorers who want to see an industry from the inside before choosing where to study or work, alongside general enthusiasts and families. For host companies, participating isn't about ticket revenue — it's a recruiting pipeline, an employer-branding tool, and a community/CSR touchpoint, with the platform handling booking, waivers, scheduling, and safety logistics so it doesn't disrupt their operations.

## Status

This is the Phase 1 MVP scaffold (see the technical brief) — a working, tested implementation of the aggregation marketplace, host self-service dashboard, and platform-admin moderation queue, built on the data model and API surface below. It's meant as a build-ready foundation, not a finished product: file storage is stubbed to direct URLs, email is stubbed to console logging without a `RESEND_API_KEY`, and there's no live Stripe account wired up.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind · PostgreSQL + Prisma · Auth.js v5 (Credentials + optional Google OAuth) · Stripe Checkout + Connect · Zod · Vitest

## Getting started

```bash
npm install

# Start a local Postgres and point DATABASE_URL at it (see .env.example),
# then:
npm run db:migrate   # applies prisma/migrations and generates the client
npm run db:seed      # creates demo accounts + two sample listings

npm run dev           # http://localhost:3000
```

Copy `.env.example` to `.env` and fill in `DATABASE_URL` at minimum. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are needed to exercise the paid-checkout path; without them, free/recruiting-visit bookings still confirm end-to-end.

Seeded demo accounts (password `password123` for all): `admin@behindthegates.com` (platform_admin), `host@meridianmotors.example` (host_admin, owns the seeded "Meridian Motors" org), `visitor@example.com` (visitor).

Other scripts: `npm test` (Vitest unit tests for the Section 7 safety rules), `npm run typecheck`, `npm run lint`, `npm run build`.

## Architecture

- `prisma/schema.prisma` — the full data model (users, host orgs, sites, listings, availability, bookings, attendees, waivers, payouts, reviews, incidents, audit log, Tier‑3 waitlist).
- `lib/` — domain logic, enforced server-side and unit-tested independently of any HTTP framework:
  - `age.ts` / `waivers.ts` — minor detection and guardian-waiver enforcement (a minor can never sign their own waiver; a booking can't be confirmed until every attendee has a signed waiver on file).
  - `chaperone.ts` — chaperone-ratio validation for group/school bookings.
  - `listings.ts` — publish-gating (insurance, PPE, min age, chaperone ratio required before a listing can go live) and the Tier‑3 "virtual-only, no physical booking" rule.
  - `bookings.ts` — the booking lifecycle (create → waivers → Stripe Checkout → confirm/payout → cancel, including host-initiated slot cancellation with auto-refund).
  - `authz.ts` / `auth.ts` / `auth.config.ts` — Auth.js session handling and role checks; `auth.config.ts` is the Edge-safe subset used by `middleware.ts` so Prisma/bcrypt never get bundled into the Edge runtime.
- `app/api/**` — REST routes per the brief's Section 6, thin wrappers around `lib/`.
- `app/(marketing)`, `app/listings`, `app/booking` — public marketing/search/booking flow (server-rendered, ISR on listing pages).
- `app/host`, `app/admin` — auth-gated host dashboard and platform-admin moderation queue.
- `tests/` — Vitest coverage for the Section 7 safety-critical rules (minors/guardians, chaperone ratios, publish gating).
