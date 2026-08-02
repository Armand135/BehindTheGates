import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { submitWaiverSchema } from "@/lib/validation";
import { submitWaiver } from "@/lib/bookings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = submitWaiverSchema.parse(await req.json());

    const waiver = await submitWaiver({
      bookingId: id,
      attendeeId: body.attendeeId,
      signedByUserId: session.user.id,
      signaturePayload: body.signaturePayload,
      templateVersion: body.templateVersion,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    });

    return NextResponse.json({ waiver }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
