import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPublishBlockers } from "@/lib/listings";
import { ApproveListingButton } from "@/components/admin/approve-listing-button";

export default async function AdminListingsPage() {
  const session = await auth();
  if (session?.user?.role !== "platform_admin") notFound();

  const listings = await prisma.tourListing.findMany({
    where: { status: "pending_review" },
    include: { site: { include: { hostOrganization: true } } },
    orderBy: { updatedAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">Moderation queue</h1>
      <p className="mt-1 text-sm text-brand-500">{listings.length} listing(s) awaiting review</p>

      <div className="mt-6 space-y-4">
        {listings.map((listing) => {
          const blockers = getPublishBlockers(listing.site.hostOrganization, listing);
          return (
            <div key={listing.id} className="rounded-lg border border-brand-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-brand-800">{listing.title}</p>
                  <p className="text-xs text-brand-500">{listing.site.hostOrganization.name}</p>
                </div>
                <ApproveListingButton listingId={listing.id} hasBlockers={blockers.length > 0} />
              </div>
              {blockers.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">Missing: {blockers.join(", ")}</p>
              )}
            </div>
          );
        })}
        {listings.length === 0 && <p className="text-sm text-brand-500">Nothing pending review.</p>}
      </div>
    </div>
  );
}
