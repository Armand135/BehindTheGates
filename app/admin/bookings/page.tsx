import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AdminCancelBookingButton } from "@/components/admin/admin-cancel-booking-button";

interface SearchParams {
  q?: string;
  status?: string;
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (session?.user?.role !== "platform_admin") notFound();

  const { q, status } = await searchParams;

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status ? { status: status as "pending_payment" | "confirmed" | "cancelled" | "completed" | "no_show" } : {}),
      ...(q
        ? {
            OR: [
              { bookerUser: { email: { contains: q, mode: "insensitive" } } },
              { availabilitySlot: { tourListing: { title: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      bookerUser: true,
      availabilitySlot: { include: { tourListing: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">Bookings &amp; refunds</h1>

      <form className="mt-6 flex flex-wrap gap-3" action="/admin/bookings">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by visitor email or listing title..."
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-brand-200 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="pending_payment">Pending payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="no_show">No-show</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">Search</button>
      </form>

      <div className="mt-6 space-y-2">
        {bookings.map((booking) => (
          <div key={booking.id} className="flex items-center justify-between rounded-md border border-brand-100 bg-white p-4 text-sm">
            <div>
              <p className="font-medium text-brand-800">{booking.availabilitySlot.tourListing.title}</p>
              <p className="text-xs text-brand-500">
                {booking.bookerUser.email} · {booking.headcount} attendee(s) ·{" "}
                {new Date(booking.availabilitySlot.startTime).toLocaleDateString()} ·{" "}
                {booking.totalPriceCents === 0 ? "Free" : `$${(booking.totalPriceCents / 100).toFixed(2)}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase text-brand-500">{booking.status.replace("_", " ")}</span>
              {(booking.status === "confirmed" || booking.status === "pending_payment") && (
                <AdminCancelBookingButton bookingId={booking.id} />
              )}
            </div>
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-brand-500">No bookings match.</p>}
      </div>
    </div>
  );
}
