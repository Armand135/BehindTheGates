import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export default async function AdminPayoutsPage() {
  const session = await auth();
  if (session?.user?.role !== "platform_admin") notFound();

  const payouts = await prisma.payout.findMany({
    include: {
      hostOrganization: true,
      booking: { include: { availabilitySlot: { include: { tourListing: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalsByOrg = new Map<string, { name: string; pending: number; paid: number }>();
  for (const payout of payouts) {
    const entry = totalsByOrg.get(payout.hostOrganizationId) ?? {
      name: payout.hostOrganization.name,
      pending: 0,
      paid: 0,
    };
    if (payout.status === "paid") entry.paid += payout.amountCents;
    else if (payout.status === "pending" || payout.status === "in_transit") entry.pending += payout.amountCents;
    totalsByOrg.set(payout.hostOrganizationId, entry);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">Payouts</h1>

      <section className="mt-6">
        <h2 className="font-semibold text-brand-800">By host organization</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Array.from(totalsByOrg.entries()).map(([orgId, entry]) => (
            <div key={orgId} className="rounded-md border border-brand-100 bg-white p-4 text-sm">
              <p className="font-medium text-brand-800">{entry.name}</p>
              <p className="mt-1 text-brand-600">Paid out: ${(entry.paid / 100).toFixed(2)}</p>
              <p className="text-amber-600">Pending: ${(entry.pending / 100).toFixed(2)}</p>
            </div>
          ))}
          {totalsByOrg.size === 0 && <p className="text-sm text-brand-500">No payouts yet.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-brand-800">All payouts</h2>
        <div className="mt-3 space-y-2">
          {payouts.map((payout) => (
            <div key={payout.id} className="flex items-center justify-between rounded-md border border-brand-100 bg-white p-3 text-sm">
              <div>
                <p className="font-medium text-brand-800">{payout.hostOrganization.name}</p>
                <p className="text-xs text-brand-500">
                  {payout.booking.availabilitySlot.tourListing.title} · {payout.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-brand-800">${(payout.amountCents / 100).toFixed(2)}</p>
                <p className="text-xs uppercase text-brand-500">{payout.status.replace("_", " ")}</p>
              </div>
            </div>
          ))}
          {payouts.length === 0 && <p className="text-sm text-brand-500">No payouts yet.</p>}
        </div>
      </section>
    </div>
  );
}
