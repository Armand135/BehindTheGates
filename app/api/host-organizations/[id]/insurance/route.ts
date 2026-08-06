import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { uploadInsuranceSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

/**
 * Registers the URL of an already-uploaded insurance document (uploaded
 * client-side directly to S3/Supabase Storage via a signed URL — file
 * bytes never transit this API route).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireHostOrgMember(id);
    const body = uploadInsuranceSchema.parse(await req.json());

    const hostOrganization = await prisma.hostOrganization.update({
      where: { id },
      data: { insuranceDocUrl: body.insuranceDocUrl, insuranceExpiresAt: body.insuranceExpiresAt },
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "host_organization.insurance_uploaded",
      entityType: "HostOrganization",
      entityId: id,
    });

    return NextResponse.json({ hostOrganization });
  } catch (err) {
    return toErrorResponse(err);
  }
}
