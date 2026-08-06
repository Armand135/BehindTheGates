import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slots = await prisma.availabilitySlot.findMany({
    where: { tourListingId: id, cancelledAt: null, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ slots });
}
