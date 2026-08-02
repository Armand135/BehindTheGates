import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { logAudit } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const listing = await prisma.tourListing.findUniqueOrThrow({ where: { id }, include: { site: true } });
    const session = await requireHostOrgMember(listing.site.hostOrganizationId);

    if (listing.status !== "draft") {
      return NextResponse.json({ error: "Only draft listings can be submitted for review." }, { status: 409 });
    }

    const updated = await prisma.tourListing.update({ where: { id }, data: { status: "pending_review" } });

    await logAudit({
      actorUserId: session.user.id,
      action: "listing.submitted_for_review",
      entityType: "TourListing",
      entityId: id,
    });

    return NextResponse.json({ listing: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
