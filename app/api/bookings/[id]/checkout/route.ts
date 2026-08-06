import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createCheckoutSession } from "@/lib/bookings";
import { resolveAppUrl } from "@/lib/app-url";

/**
 * Creates the Stripe Checkout Session for a booking. Not part of the
 * Section 6 route table verbatim, but required to implement the flow
 * described in Section 3.1 (waiver before payment): lib/bookings.ts
 * blocks this call with a 422 until every attendee has a signed waiver.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const appUrl = resolveAppUrl(req);

    const result = await createCheckoutSession(
      id,
      `${appUrl}/booking/${id}/confirmation`,
      `${appUrl}/booking/${id}`,
    );

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
