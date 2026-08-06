import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createReviewSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = createReviewSchema.parse(await req.json());

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: body.bookingId } });
    if (booking.bookerUserId !== session.user.id) {
      throw new AuthError("You can only review bookings you made.", 403);
    }
    if (booking.status !== "completed") {
      return NextResponse.json({ error: "You can only review a completed visit." }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: { bookingId: body.bookingId, userId: session.user.id, rating: body.rating, comment: body.comment },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
