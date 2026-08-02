import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";

/**
 * Interest-list signup for Tier 3 (virtual_only) listings — Section 7.7:
 * these sites never take physical bookings, only waitlist interest.
 */
const waitlistSchema = z.object({
  tourListingId: z.string().min(1),
  note: z.string().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = waitlistSchema.parse(await req.json());

    const listing = await prisma.tourListing.findUniqueOrThrow({ where: { id: body.tourListingId } });
    if (listing.listingType !== "virtual_only") {
      return NextResponse.json({ error: "This listing supports direct booking; use /api/bookings instead." }, { status: 409 });
    }

    const entry = await prisma.waitlistEntry.upsert({
      where: { tourListingId_userId: { tourListingId: body.tourListingId, userId: session.user.id } },
      create: { tourListingId: body.tourListingId, userId: session.user.id, note: body.note },
      update: { note: body.note },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
