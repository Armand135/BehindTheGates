import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createBookingSchema } from "@/lib/validation";
import { createBooking, sendWaiverRequestsForBooking } from "@/lib/bookings";
import { resolveAppUrl } from "@/lib/app-url";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = createBookingSchema.parse(await req.json());

    const booking = await createBooking({
      availabilitySlotId: body.availabilitySlotId,
      bookerUserId: session.user.id,
      bookingType: body.bookingType,
      headcount: body.attendees.length,
      chaperoneCount: body.chaperoneCount,
      attendees: body.attendees,
    });

    const bookingUrl = `${resolveAppUrl(req)}/booking/${booking.id}`;
    await sendWaiverRequestsForBooking(booking.id, bookingUrl, session.user.email!);

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
