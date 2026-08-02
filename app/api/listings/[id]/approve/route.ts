import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { assertCanPublish, getPublishBlockers } from "@/lib/listings";
import { logAudit } from "@/lib/audit";

const approveSchema = z.object({
  /** platform_admin may force-publish over missing safety fields; must be explicitly logged (Section 4). */
  override: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("platform_admin");
    const { id } = await params;
    const { override } = approveSchema.parse(await req.json().catch(() => ({})));

    const listing = await prisma.tourListing.findUniqueOrThrow({
      where: { id },
      include: { site: { include: { hostOrganization: true } } },
    });

    if (listing.status !== "pending_review") {
      return NextResponse.json({ error: "Only listings pending review can be approved." }, { status: 409 });
    }

    const host = listing.site.hostOrganization;
    const blockers = getPublishBlockers(host, listing);

    if (blockers.length > 0 && !override) {
      assertCanPublish(host, listing); // throws ListingPublishError with the same blocker list
    }

    const updated = await prisma.tourListing.update({ where: { id }, data: { status: "live" } });

    await logAudit({
      actorUserId: session.user.id,
      action: override && blockers.length > 0 ? "listing.approved_with_admin_override" : "listing.approved",
      entityType: "TourListing",
      entityId: id,
      metadata: { overriddenBlockers: override ? blockers : undefined },
    });

    return NextResponse.json({ listing: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
