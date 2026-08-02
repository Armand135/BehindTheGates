import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const revalidate = 60;

interface SearchParams {
  industry?: string;
  tier?: string;
  q?: string;
}

export default async function ListingsSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { industry, tier, q } = await searchParams;

  const where: Prisma.TourListingWhereInput = {
    status: "live",
    ...(industry ? { industryTags: { has: industry } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(tier ? { site: { accessTier: tier === "1" ? "tier_1" : tier === "2" ? "tier_2" : "tier_3" } } : {}),
  };

  const listings = await prisma.tourListing.findMany({
    where,
    include: {
      site: { include: { hostOrganization: true } },
      availabilitySlots: {
        where: { cancelledAt: null, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">Guided visits</h1>
      <p className="mt-1 text-sm text-brand-600">{listings.length} live listing(s)</p>

      <form className="mt-6 flex flex-wrap gap-3" action="/listings">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by title..."
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <select name="tier" defaultValue={tier ?? ""} className="rounded-md border border-brand-200 px-3 py-2 text-sm">
          <option value="">All access tiers</option>
          <option value="1">Bookable now</option>
          <option value="2">Partnership sites</option>
          <option value="3">Virtual / waitlist only</option>
        </select>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">Search</button>
      </form>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="rounded-lg border border-brand-100 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wide text-brand-500">{listing.site.hostOrganization.name}</p>
            <h2 className="mt-1 font-semibold text-brand-900">{listing.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-brand-600">{listing.description}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-brand-500">{listing.durationMinutes} min</span>
              <span className="font-medium text-brand-800">
                {listing.isFreeRecruitingVisit
                  ? "Free"
                  : `${(listing.priceCents / 100).toFixed(2)} ${listing.currency}`}
              </span>
            </div>
          </Link>
        ))}
        {listings.length === 0 && (
          <p className="text-sm text-brand-500">No listings match your search yet.</p>
        )}
      </div>
    </div>
  );
}
