import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { confirmBooking } from "@/lib/bookings";

/**
 * Section 6: "triggered by Stripe webhook on payment success." The
 * webhook handler (app/api/webhooks/stripe) calls confirmBooking()
 * directly; this HTTP route exists for platform-admin manual confirmation
 * (e.g. support resolving a stuck free/recruiting booking) and is
 * intentionally not reachable by visitors.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("platform_admin");
    const { id } = await params;
    const booking = await confirmBooking(id, null);
    return NextResponse.json({ booking });
  } catch (err) {
    return toErrorResponse(err);
  }
}
