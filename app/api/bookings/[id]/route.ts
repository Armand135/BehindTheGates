import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        attendees: { include: { waiver: true } },
        availabilitySlot: { include: { tourListing: { include: { site: { include: { hostOrganization: { include: { members: true } } } } } } } },
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const isBooker = booking.bookerUserId === session.user.id;
    const isHostMember = booking.availabilitySlot.tourListing.site.hostOrganization.members.some(
      (m) => m.userId === session.user.id,
    );
    const isPlatformAdmin = session.user.role === "platform_admin";

    if (!isBooker && !isHostMember && !isPlatformAdmin) {
      throw new AuthError("You do not have access to this booking.", 403);
    }

    return NextResponse.json({ booking });
  } catch (err) {
    return toErrorResponse(err);
  }
}
