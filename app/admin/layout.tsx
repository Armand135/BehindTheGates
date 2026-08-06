import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-brand-100 bg-white">
        <nav className="mx-auto flex max-w-5xl gap-6 px-4 py-3 text-sm text-brand-600">
          <Link href="/admin/listings" className="hover:text-brand-900">
            Moderation queue
          </Link>
          <Link href="/admin/incidents" className="hover:text-brand-900">
            Incidents
          </Link>
          <Link href="/admin/bookings" className="hover:text-brand-900">
            Bookings &amp; refunds
          </Link>
          <Link href="/admin/payouts" className="hover:text-brand-900">
            Payouts
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
