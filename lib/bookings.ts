import { prisma } from "@/lib/db";
import { assertBookable } from "@/lib/listings";
import { assertChaperoneRatio } from "@/lib/chaperone";
import { assertGuardiansProvided, assertAllWaiversSigned, assertSignerIsNotTheMinorThemself, type AttendeeInput } from "@/lib/waivers";
import { calculateApplicationFeeCents, getStripe } from "@/lib/stripe";
import { sendBookingConfirmation, sendSlotCancellationNotice, sendWaiverRequest } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

export class BookingError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 422 = 400,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export interface CreateBookingInput {
  availabilitySlotId: string;
  bookerUserId: string;
  bookingType: "individual" | "group";
  headcount: number;
  chaperoneCount: number;
  attendees: AttendeeInput[];
}

export async function createBooking(input: CreateBookingInput) {
  return prisma.$transaction(async (tx) => {
    const slot = await tx.availabilitySlot.findUnique({
      where: { id: input.availabilitySlotId },
      include: { tourListing: true },
    });
    if (!slot || slot.cancelledAt) {
      throw new BookingError("Availability slot not found or has been cancelled.", 404);
    }

    const listing = slot.tourListing;
    assertBookable(listing.listingType);

    if (listing.status !== "live") {
      throw new BookingError("This listing is not currently bookable.", 409);
    }

    if (input.bookingType === "individual" && slot.isGroupOnly) {
      throw new BookingError("This slot only accepts group bookings.", 422);
    }

    const remainingCapacity = slot.capacity - slot.seatsBooked;
    if (input.headcount > remainingCapacity) {
      throw new BookingError(`Only ${remainingCapacity} seat(s) remaining on this slot.`, 409);
    }

    if (input.headcount !== input.attendees.length) {
      throw new BookingError("Attendee list must match headcount.", 400);
    }

    if (input.bookingType === "group") {
      assertChaperoneRatio(input.headcount, input.chaperoneCount, listing.chaperoneRatio);
    }

    assertGuardiansProvided(input.attendees, listing.minAge);

    const totalPriceCents = listing.isFreeRecruitingVisit ? 0 : listing.priceCents * input.headcount;

    await tx.availabilitySlot.update({
      where: { id: slot.id },
      data: { seatsBooked: { increment: input.headcount } },
    });

    const booking = await tx.booking.create({
      data: {
        availabilitySlotId: slot.id,
        bookerUserId: input.bookerUserId,
        bookingType: input.bookingType,
        headcount: input.headcount,
        chaperoneCount: input.chaperoneCount,
        totalPriceCents,
        status: "pending_payment",
        attendees: {
          create: input.attendees.map((a) => ({
            name: a.name,
            dateOfBirth: a.dateOfBirth,
            guardianUserId: a.guardianUserId ?? null,
            guardianEmail: a.guardianEmail ?? null,
          })),
        },
      },
      include: { attendees: true },
    });

    return booking;
  });
}

/**
 * Sends (or re-sends) the waiver request to whoever must sign for each
 * attendee: the guardian's email for minors, the attendee's own contact
 * for adults. Section 7.1: this happens before payment is attempted.
 */
export async function sendWaiverRequestsForBooking(bookingId: string, bookingUrl: string, fallbackEmail: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { attendees: true },
  });

  for (const attendee of booking.attendees) {
    const to = attendee.guardianEmail ?? fallbackEmail;
    await sendWaiverRequest({ to, attendeeName: attendee.name, bookingUrl });
  }
}

export interface SubmitWaiverInput {
  bookingId: string;
  attendeeId: string;
  signedByUserId: string;
  signaturePayload: string;
  ipAddress: string | null;
  templateVersion: string;
}

export async function submitWaiver(input: SubmitWaiverInput) {
  return prisma.$transaction(async (tx) => {
    const attendee = await tx.attendee.findUnique({
      where: { id: input.attendeeId },
      include: { booking: { include: { availabilitySlot: { include: { tourListing: true } } } } },
    });
    if (!attendee || attendee.bookingId !== input.bookingId) {
      throw new BookingError("Attendee not found on this booking.", 404);
    }
    if (attendee.booking.status !== "pending_payment") {
      throw new BookingError("Waivers can only be submitted while a booking is awaiting payment.", 409);
    }

    const listingMinAge = attendee.booking.availabilitySlot.tourListing.minAge;
    assertSignerIsNotTheMinorThemself(
      { name: attendee.name, dateOfBirth: attendee.dateOfBirth, guardianUserId: attendee.guardianUserId },
      listingMinAge,
      input.signedByUserId,
    );

    const waiver = await tx.waiver.create({
      data: {
        templateVersion: input.templateVersion,
        status: "signed",
        signedByUserId: input.signedByUserId,
        signaturePayload: input.signaturePayload,
        ipAddress: input.ipAddress,
        signedAt: new Date(),
      },
    });

    await tx.attendee.update({
      where: { id: attendee.id },
      data: { waiverId: waiver.id },
    });

    await logAudit({
      actorUserId: input.signedByUserId,
      action: "waiver.signed",
      entityType: "Attendee",
      entityId: attendee.id,
      metadata: { bookingId: input.bookingId, waiverId: waiver.id },
    });

    return waiver;
  });
}

async function loadBookingWithWaiverState(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      attendees: { include: { waiver: true } },
      availabilitySlot: { include: { tourListing: { include: { site: { include: { hostOrganization: true } } } } } },
      bookerUser: true,
    },
  });
  if (!booking) throw new BookingError("Booking not found.", 404);
  return booking;
}

/**
 * Creates a Stripe Checkout Session for a booking. Blocks (422) unless
 * every attendee already has a signed waiver — Section 7.1: "the booking
 * flow must block checkout completion until every attendee has a signed
 * waiver on file," enforced server-side here, not just in the UI.
 */
export async function createCheckoutSession(bookingId: string, successUrl: string, cancelUrl: string) {
  const booking = await loadBookingWithWaiverState(bookingId);

  if (booking.status !== "pending_payment") {
    throw new BookingError("This booking is not awaiting payment.", 409);
  }

  assertAllWaiversSigned(
    booking.attendees.map((a) => ({ name: a.name, waiverStatus: a.waiver?.status ?? null })),
  );

  if (booking.totalPriceCents === 0) {
    await confirmBooking(bookingId, null);
    return { free: true as const, url: successUrl };
  }

  const stripe = getStripe();
  const listing = booking.availabilitySlot.tourListing;
  const hostAccountId = listing.site.hostOrganization.stripeConnectAccountId;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: listing.currency.toLowerCase(),
          product_data: { name: listing.title },
          unit_amount: Math.round(booking.totalPriceCents / booking.headcount),
        },
        quantity: booking.headcount,
      },
    ],
    payment_intent_data: hostAccountId
      ? {
          application_fee_amount: calculateApplicationFeeCents(booking.totalPriceCents),
          transfer_data: { destination: hostAccountId },
        }
      : undefined,
    metadata: { bookingId },
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: booking.bookerUser.email,
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { stripePaymentIntentId: (session.payment_intent as string) ?? session.id },
  });

  return { free: false as const, url: session.url! };
}

/**
 * Confirms a booking after successful payment (or immediately, for free
 * recruiting visits). Re-asserts waivers are complete as defense in
 * depth, then flips status, schedules a payout, and notifies attendees.
 */
export async function confirmBooking(bookingId: string, stripePaymentIntentId: string | null) {
  const booking = await loadBookingWithWaiverState(bookingId);

  if (booking.status === "confirmed") return booking; // idempotent for webhook retries

  assertAllWaiversSigned(
    booking.attendees.map((a) => ({ name: a.name, waiverStatus: a.waiver?.status ?? null })),
  );

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "confirmed",
      stripePaymentIntentId: stripePaymentIntentId ?? booking.stripePaymentIntentId,
    },
  });

  if (booking.totalPriceCents > 0) {
    await prisma.payout.create({
      data: {
        hostOrganizationId: booking.availabilitySlot.tourListing.site.hostOrganizationId,
        bookingId: booking.id,
        amountCents: booking.totalPriceCents - calculateApplicationFeeCents(booking.totalPriceCents),
        status: "pending",
      },
    });
  }

  await sendBookingConfirmation({
    to: booking.bookerUser.email,
    listingTitle: booking.availabilitySlot.tourListing.title,
    startTime: booking.availabilitySlot.startTime,
  });

  await logAudit({
    actorUserId: null,
    action: "booking.confirmed",
    entityType: "Booking",
    entityId: booking.id,
    metadata: { stripePaymentIntentId },
  });

  return updated;
}

export async function cancelBooking(params: {
  bookingId: string;
  reason: string;
  actorUserId: string | null;
  refund: boolean;
}) {
  const booking = await loadBookingWithWaiverState(params.bookingId);
  if (booking.status === "cancelled") return booking;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { seatsBooked: { decrement: booking.headcount } },
    });
    return tx.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: params.reason },
    });
  });

  if (params.refund && booking.status === "confirmed" && booking.stripePaymentIntentId && booking.totalPriceCents > 0) {
    const stripe = getStripe();
    await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });
  }

  await sendSlotCancellationNotice({
    to: booking.bookerUser.email,
    listingTitle: booking.availabilitySlot.tourListing.title,
    startTime: booking.availabilitySlot.startTime,
    reason: params.reason,
  });

  await logAudit({
    actorUserId: params.actorUserId,
    action: "booking.cancelled",
    entityType: "Booking",
    entityId: booking.id,
    metadata: { reason: params.reason, refunded: params.refund },
  });

  return updated;
}

/**
 * Host-initiated operational hold on a slot (Section 7.5): industrial
 * sites can halt visitor access on short notice. Cancels + auto-refunds
 * every booking on the slot and notifies all booked visitors.
 */
export async function hostCancelSlot(params: { availabilitySlotId: string; reason: string; actorUserId: string }) {
  await prisma.availabilitySlot.update({
    where: { id: params.availabilitySlotId },
    data: { cancelledAt: new Date() },
  });

  const bookings = await prisma.booking.findMany({
    where: { availabilitySlotId: params.availabilitySlotId, status: { in: ["pending_payment", "confirmed"] } },
  });

  for (const booking of bookings) {
    await cancelBooking({
      bookingId: booking.id,
      reason: params.reason,
      actorUserId: params.actorUserId,
      refund: true,
    });
  }

  await logAudit({
    actorUserId: params.actorUserId,
    action: "slot.host_cancelled",
    entityType: "AvailabilitySlot",
    entityId: params.availabilitySlotId,
    metadata: { reason: params.reason, bookingsCancelled: bookings.length },
  });
}
