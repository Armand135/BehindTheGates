import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { markBookingOutcome } from "@/lib/bookings";

const completeSchema = z.object({
  outcome: z.enum(["completed", "no_show"]),
});

/**
 * Day-of check-in by a guide/host (Technical Brief Section 2). Not part
 * of the Section 6 route table verbatim, but required to let bookings
 * ever reach a terminal state so reviews (which require status =
 * completed) become possible.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { outcome } = completeSchema.parse(await req.json());

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        availabilitySlot: {
          include: { tourListing: { include: { site: { include: { hostOrganization: { include: { members: true } } } } } } },
        },
      },
    });

    const isHostMember = booking.availabilitySlot.tourListing.site.hostOrganization.members.some(
      (m) => m.userId === session.user.id,
    );
    if (!isHostMember && session.user.role !== "platform_admin") {
      throw new AuthError("You are not authorized to check in this booking.", 403);
    }

    const updated = await markBookingOutcome({ bookingId: id, outcome, actorUserId: session.user.id });

    return NextResponse.json({ booking: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
