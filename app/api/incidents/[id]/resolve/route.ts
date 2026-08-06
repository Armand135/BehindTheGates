import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { logAudit } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("platform_admin");
    const { id } = await params;

    const incident = await prisma.incident.update({
      where: { id },
      data: { status: "resolved", resolvedAt: new Date() },
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "incident.resolved",
      entityType: "Incident",
      entityId: id,
    });

    return NextResponse.json({ incident });
  } catch (err) {
    return toErrorResponse(err);
  }
}
