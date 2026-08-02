import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { availabilitySlot: { include: { tourListing: true } } },
  });
  if (!booking || booking.bookerUserId !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-brand-900">
        {booking.status === "confirmed" ? "You're booked!" : "Payment received — finalizing your booking..."}
      </h1>
      <p className="mt-3 text-brand-600">
        {booking.availabilitySlot.tourListing.title} ·{" "}
        {new Date(booking.availabilitySlot.startTime).toLocaleString()}
      </p>
      <p className="mt-6 text-sm text-brand-500">
        A confirmation email is on its way. You can review this booking any time from your account.
      </p>
      <Link href="/listings" className="mt-8 inline-block rounded-md bg-brand-600 px-6 py-3 text-white hover:bg-brand-700">
        Browse more visits
      </Link>
    </div>
  );
}
