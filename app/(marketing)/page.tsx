import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
          See how a real business actually operates.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-700">
          Behind The Gates is a booking platform for guided visits inside real, working companies —
          factories, refineries, ports — giving students, career-explorers, and the curious a seat on
          tours that don&apos;t normally exist.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/listings"
            className="rounded-md bg-brand-600 px-6 py-3 text-white shadow-sm hover:bg-brand-700"
          >
            Browse visits
          </Link>
          <Link
            href="/host/onboarding"
            className="rounded-md border border-brand-300 px-6 py-3 text-brand-700 hover:bg-brand-100"
          >
            List your company
          </Link>
        </div>
      </section>

      <section className="border-t border-brand-100 bg-white py-16">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold text-brand-800">For visitors</h2>
            <p className="mt-2 text-sm text-brand-600">
              Book a seat on a guided tour of a working factory, refinery, or port — the closest thing
              to trying a career on before choosing one.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-brand-800">For students &amp; schools</h2>
            <p className="mt-2 text-sm text-brand-600">
              Group bookings with guardian waivers and chaperone-ratio checks built in, so career-day
              visits are safe and easy to organize.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-brand-800">For companies</h2>
            <p className="mt-2 text-sm text-brand-600">
              A low-effort recruiting and employer-branding channel — the platform handles booking,
              waivers, scheduling, and safety logistics.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
