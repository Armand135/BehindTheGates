import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createSiteSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = createSiteSchema.parse(await req.json());
    await requireHostOrgMember(body.hostOrganizationId);

    const site = await prisma.site.create({ data: body });
    return NextResponse.json({ site }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
