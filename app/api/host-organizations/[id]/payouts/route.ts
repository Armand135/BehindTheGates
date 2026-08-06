import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireHostOrgMember(id);

    const payouts = await prisma.payout.findMany({
      where: { hostOrganizationId: id },
      orderBy: { createdAt: "desc" },
      include: { booking: { include: { availabilitySlot: { include: { tourListing: true } } } } },
    });

    return NextResponse.json({ payouts });
  } catch (err) {
    return toErrorResponse(err);
  }
}
