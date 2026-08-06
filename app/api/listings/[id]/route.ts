import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { updateListingSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.tourListing.findUnique({
    where: { id },
    include: {
      site: { include: { hostOrganization: true } },
      availabilitySlots: {
        where: { cancelledAt: null, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
      },
    },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json({ listing });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.tourListing.findUniqueOrThrow({ where: { id }, include: { site: true } });
    await requireHostOrgMember(existing.site.hostOrganizationId);

    const body = updateListingSchema.parse(await req.json());
    const listing = await prisma.tourListing.update({ where: { id }, data: body });

    return NextResponse.json({ listing });
  } catch (err) {
    return toErrorResponse(err);
  }
}
