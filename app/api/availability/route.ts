import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createAvailabilitySchema } from "@/lib/validation";
import { assertBookable } from "@/lib/listings";

export async function POST(req: NextRequest) {
  try {
    const body = createAvailabilitySchema.parse(await req.json());

    const listing = await prisma.tourListing.findUniqueOrThrow({
      where: { id: body.tourListingId },
      include: { site: true },
    });
    await requireHostOrgMember(listing.site.hostOrganizationId);
    assertBookable(listing.listingType);

    const slots = await prisma.availabilitySlot.createManyAndReturn({
      data: body.slots.map((s) => ({
        tourListingId: listing.id,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        isGroupOnly: s.isGroupOnly,
      })),
    });

    return NextResponse.json({ slots }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
