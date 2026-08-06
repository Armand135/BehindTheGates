import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BookingForm } from "@/components/booking-form";
import { WaitlistForm } from "@/components/waitlist-form";

export const revalidate = 60;

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.tourListing.findUnique({
    where: { id },
    include: {
      site: { include: { hostOrganization: true } },
      availabilitySlots: {
        where: { cancelledAt: null, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
      },
    },
  });

  if (!listing || listing.status !== "live") {
    notFound();
  }

  const reviews = await prisma.review.findMany({
    where: { booking: { availabilitySlot: { tourListingId: listing.id } } },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <p className="text-xs uppercase tracking-wide text-brand-500">{listing.site.hostOrganization.name}</p>
        <h1 className="mt-1 text-3xl font-semibold text-brand-900">{listing.title}</h1>
        <p className="mt-2 text-sm text-brand-500">
          {listing.site.name} · {listing.site.address}
          {averageRating && (
            <span className="ml-2 text-amber-600">
              ★ {averageRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
            </span>
          )}
        </p>

        <p className="mt-6 whitespace-pre-line text-brand-700">{listing.description}</p>

        <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-brand-500">Duration</dt>
            <dd className="font-medium text-brand-800">{listing.durationMinutes} min</dd>
          </div>
          <div>
            <dt className="text-brand-500">Minimum age</dt>
            <dd className="font-medium text-brand-800">{listing.minAge || "None"}</dd>
          </div>
          <div>
            <dt className="text-brand-500">Max group size</dt>
            <dd className="font-medium text-brand-800">{listing.maxGroupSize}</dd>
          </div>
          {listing.chaperoneRatio && (
            <div>
              <dt className="text-brand-500">Chaperone ratio</dt>
              <dd className="font-medium text-brand-800">1 : {listing.chaperoneRatio}</dd>
            </div>
          )}
          {listing.ppeRequired.length > 0 && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-brand-500">PPE required</dt>
              <dd className="font-medium text-brand-800">{listing.ppeRequired.join(", ")}</dd>
            </div>
          )}
        </dl>

        {listing.cancellationPolicy && (
          <div className="mt-8">
            <h2 className="font-semibold text-brand-800">Cancellation policy</h2>
            <p className="mt-1 text-sm text-brand-600">{listing.cancellationPolicy}</p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-8">
            <h2 className="font-semibold text-brand-800">Reviews</h2>
            <div className="mt-3 space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-md border border-brand-100 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-brand-800">{review.user.name ?? "Visitor"}</span>
                    <span className="text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                  </div>
                  {review.comment && <p className="mt-2 text-sm text-brand-600">{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="sticky top-6">
          <p className="mb-4 text-2xl font-semibold text-brand-900">
            {listing.isFreeRecruitingVisit ? "Free" : `${(listing.priceCents / 100).toFixed(2)} ${listing.currency}`}
            <span className="text-sm font-normal text-brand-500"> / attendee</span>
          </p>

          {listing.listingType === "virtual_only" ? (
            <WaitlistForm listingId={listing.id} />
          ) : (
            <BookingForm
              listingId={listing.id}
              chaperoneRatio={listing.chaperoneRatio}
              slots={listing.availabilitySlots.map((s) => ({
                id: s.id,
                startTime: s.startTime.toISOString(),
                capacity: s.capacity,
                seatsBooked: s.seatsBooked,
                isGroupOnly: s.isGroupOnly,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
