import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createIncidentSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = createIncidentSchema.parse(await req.json());

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: body.bookingId },
      include: { availabilitySlot: { include: { tourListing: { include: { site: { include: { hostOrganization: { include: { members: true } } } } } } } } },
    });

    const isBooker = booking.bookerUserId === session.user.id;
    const isHostMember = booking.availabilitySlot.tourListing.site.hostOrganization.members.some(
      (m) => m.userId === session.user.id,
    );
    if (!isBooker && !isHostMember && session.user.role !== "platform_admin") {
      throw new AuthError("You are not associated with this booking.", 403);
    }

    const incident = await prisma.incident.create({
      data: {
        bookingId: body.bookingId,
        reportedByUserId: session.user.id,
        description: body.description,
        severity: body.severity,
      },
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "incident.reported",
      entityType: "Incident",
      entityId: incident.id,
      metadata: { bookingId: body.bookingId, severity: body.severity },
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
