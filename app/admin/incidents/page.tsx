import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ResolveIncidentButton } from "@/components/admin/resolve-incident-button";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export default async function AdminIncidentsPage() {
  const session = await auth();
  if (session?.user?.role !== "platform_admin") notFound();

  const incidents = await prisma.incident.findMany({
    include: {
      booking: { include: { availabilitySlot: { include: { tourListing: true } } } },
      reportedByUser: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const open = incidents
    .filter((i) => i.status === "open")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const resolved = incidents.filter((i) => i.status === "resolved");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-900">Incidents</h1>
      <p className="mt-1 text-sm text-brand-500">{open.length} open</p>

      <div className="mt-6 space-y-3">
        {open.map((incident) => (
          <div key={incident.id} className="rounded-lg border border-brand-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold uppercase ${
                  incident.severity === "critical" || incident.severity === "high" ? "text-red-600" : "text-amber-600"
                }`}
              >
                {incident.severity}
              </span>
              <ResolveIncidentButton incidentId={incident.id} />
            </div>
            <p className="mt-2 text-sm text-brand-800">{incident.description}</p>
            <p className="mt-2 text-xs text-brand-500">
              {incident.booking.availabilitySlot.tourListing.title} · reported by{" "}
              {incident.reportedByUser.name ?? incident.reportedByUser.email} on{" "}
              {incident.createdAt.toLocaleString()}
            </p>
          </div>
        ))}
        {open.length === 0 && <p className="text-sm text-brand-500">No open incidents.</p>}
      </div>

      {resolved.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold text-brand-800">Resolved</h2>
          <div className="mt-3 space-y-2">
            {resolved.map((incident) => (
              <div key={incident.id} className="rounded-md border border-brand-50 bg-white p-3 text-sm text-brand-500">
                {incident.description} — resolved {incident.resolvedAt?.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
