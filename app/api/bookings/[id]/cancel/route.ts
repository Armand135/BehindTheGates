import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { cancelBookingSchema } from "@/lib/validation";
import { cancelBooking } from "@/lib/bookings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { reason } = cancelBookingSchema.parse(await req.json());

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { availabilitySlot: { include: { tourListing: { include: { site: true } } } } },
    });

    const isBooker = booking.bookerUserId === session.user.id;
    const isPlatformAdmin = session.user.role === "platform_admin";
    let isHostMember = false;
    if (!isBooker && !isPlatformAdmin) {
      const membership = await prisma.hostOrganizationMember.findUnique({
        where: {
          hostOrganizationId_userId: {
            hostOrganizationId: booking.availabilitySlot.tourListing.site.hostOrganizationId,
            userId: session.user.id,
          },
        },
      });
      isHostMember = !!membership;
    }
    if (!isBooker && !isHostMember && !isPlatformAdmin) {
      throw new AuthError("You are not authorized to cancel this booking.", 403);
    }

    // Refund policy: host- or admin-initiated cancellations always auto-refund
    // (Section 7.5); self-cancellation by the booker also refunds in the MVP —
    // cancellation-window/fee enforcement per listing policy is Phase 2 scope.
    const updated = await cancelBooking({ bookingId: id, reason, actorUserId: session.user.id, refund: true });

    return NextResponse.json({ booking: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
