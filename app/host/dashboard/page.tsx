import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CreateSiteForm } from "@/components/host/create-site-form";
import { CreateListingForm } from "@/components/host/create-listing-form";
import { InsuranceForm } from "@/components/host/insurance-form";
import { SubmitListingButton } from "@/components/host/submit-listing-button";

export default async function HostDashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const memberships = await prisma.hostOrganizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      hostOrganization: {
        include: {
          sites: { include: { tourListings: { include: { availabilitySlots: true } } } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-brand-600">You don&apos;t manage a host organization yet.</p>
        <Link href="/host/onboarding" className="mt-4 inline-block rounded-md bg-brand-600 px-6 py-3 text-white">
          Set one up
        </Link>
      </div>
    );
  }

  const org = memberships[0].hostOrganization;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">{org.name}</h1>
          <p className="mt-1 text-sm text-brand-500">
            Verification: <span className="font-medium">{org.verificationStatus}</span> · Payouts:{" "}
            <span className="font-medium">{org.payoutStatus}</span>
          </p>
        </div>
      </div>

      {!org.insuranceDocUrl && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Upload proof of insurance before any listing can go live.
          </p>
          <div className="mt-3">
            <InsuranceForm hostOrganizationId={org.id} />
          </div>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-semibold text-brand-800">Sites</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {org.sites.map((site) => (
            <div key={site.id} className="rounded-lg border border-brand-100 bg-white p-4">
              <p className="font-medium text-brand-800">{site.name}</p>
              <p className="text-xs text-brand-500">{site.address}</p>
              <p className="mt-2 text-xs uppercase text-brand-400">{site.accessTier.replace("_", " ")}</p>

              <div className="mt-3 space-y-2">
                {site.tourListings.map((listing) => (
                  <div key={listing.id} className="rounded-md border border-brand-100 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{listing.title}</span>
                      <span className="text-xs text-brand-500">{listing.status}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      {listing.status === "draft" && <SubmitListingButton listingId={listing.id} />}
                      <Link href={`/host/listings/${listing.id}`} className="text-xs text-brand-600 underline">
                        Manage availability
                      </Link>
                    </div>
                  </div>
                ))}
                <CreateListingForm siteId={site.id} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 max-w-md">
          <h3 className="text-sm font-medium text-brand-700">Add a site</h3>
          <CreateSiteForm hostOrganizationId={org.id} />
        </div>
      </section>
    </div>
  );
}
