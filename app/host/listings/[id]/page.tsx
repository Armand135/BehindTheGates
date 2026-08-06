import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CreateAvailabilityForm } from "@/components/host/create-availability-form";
import { CheckInRow } from "@/components/host/check-in-row";

export default async function HostListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const listing = await prisma.tourListing.findUnique({
    where: { id },
    include: {
      site: { include: { hostOrganization: { include: { members: true } } } },
      availabilitySlots: {
        orderBy: { startTime: "asc" },
        include: {
          bookings: {
            where: { status: { in: ["confirmed", "completed", "no_show"] } },
            include: { bookerUser: true },
          },
        },
      },
    },
  });

  if (!listing) notFound();
  const isMember = listing.site.hostOrganization.members.some((m) => m.userId === session.user.id);
  if (!isMember && session.user.role !== "platform_admin") notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">{listing.title}</h1>
      <p className="mt-1 text-sm text-brand-500">Status: {listing.status}</p>

      <section className="mt-8">
        <h2 className="font-semibold text-brand-800">Availability</h2>
        <div className="mt-3 space-y-2">
          {listing.availabilitySlots.map((slot) => (
            <div key={slot.id} className="rounded-md border border-brand-100 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{new Date(slot.startTime).toLocaleString()}</span>
                <span className="text-brand-500">
                  {slot.seatsBooked}/{slot.capacity} booked {slot.cancelledAt ? "· cancelled" : ""}
                </span>
              </div>
              {slot.bookings.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-brand-50 pt-3">
                  {slot.bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between text-xs">
                      <span>
                        {booking.bookerUser.name ?? booking.bookerUser.email} — {booking.headcount} attendee(s)
                      </span>
                      <CheckInRow bookingId={booking.id} status={booking.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {listing.availabilitySlots.length === 0 && (
            <p className="text-sm text-brand-500">No availability yet.</p>
          )}
        </div>

        <div className="mt-6 max-w-sm">
          <CreateAvailabilityForm tourListingId={listing.id} />
        </div>
      </section>
    </div>
  );
}
