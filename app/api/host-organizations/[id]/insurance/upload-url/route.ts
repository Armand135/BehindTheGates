import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createInsuranceDocUploadUrl } from "@/lib/storage";

const requestUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
});

/**
 * Issues a signed Supabase Storage upload URL for a host's insurance
 * document. The client PUTs the file bytes directly to the returned URL,
 * then submits the resulting publicUrl to POST .../insurance to record
 * it (Section 4: insuranceDocUrl is a publish-gating field).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireHostOrgMember(id);
    const { fileName } = requestUploadSchema.parse(await req.json());

    const upload = await createInsuranceDocUploadUrl(id, fileName);

    return NextResponse.json(upload);
  } catch (err) {
    return toErrorResponse(err);
  }
}
