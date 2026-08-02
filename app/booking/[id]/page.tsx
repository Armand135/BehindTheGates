import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { WaiverFlow } from "@/components/waiver-flow";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      attendees: { include: { waiver: true } },
      availabilitySlot: { include: { tourListing: { include: { site: { include: { hostOrganization: true } } } } } },
    },
  });

  if (!booking || booking.bookerUserId !== session.user.id) notFound();

  const listing = booking.availabilitySlot.tourListing;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">{listing.title}</h1>
      <p className="mt-1 text-sm text-brand-500">
        {new Date(booking.availabilitySlot.startTime).toLocaleString()} · {booking.headcount} attendee(s)
      </p>

      <div className="mt-8 rounded-lg border border-brand-100 bg-white p-6">
        <h2 className="font-semibold text-brand-800">Status: {booking.status.replace("_", " ")}</h2>
        <p className="mt-1 text-sm text-brand-600">
          Total: {booking.totalPriceCents === 0 ? "Free" : `${(booking.totalPriceCents / 100).toFixed(2)} ${listing.currency}`}
        </p>
      </div>

      {booking.status === "pending_payment" && (
        <div className="mt-6">
          <WaiverFlow
            bookingId={booking.id}
            attendees={booking.attendees.map((a) => ({
              id: a.id,
              name: a.name,
              waiverStatus: a.waiver?.status ?? null,
            }))}
          />
        </div>
      )}

      {booking.status === "confirmed" && (
        <p className="mt-6 rounded-md border border-brand-100 bg-white p-4 text-sm text-brand-700">
          Your visit is confirmed. A confirmation email has been sent with arrival instructions.
        </p>
      )}

      {booking.status === "cancelled" && (
        <p className="mt-6 rounded-md border border-brand-100 bg-white p-4 text-sm text-brand-700">
          This booking was cancelled{booking.cancellationReason ? `: ${booking.cancellationReason}` : "."}
        </p>
      )}
    </div>
  );
}
