import { isMinor } from "./age";

/**
 * Guardian/minor and waiver-completeness enforcement (Technical Brief
 * Section 7.1 and 7.2). These rules are enforced server-side wherever a
 * booking transitions state (creation, waiver submission, payment
 * confirmation) — never only in the UI.
 */

export class WaiverError extends Error {
  constructor(
    message: string,
    public readonly code: "GUARDIAN_REQUIRED" | "WAIVERS_INCOMPLETE" | "MINOR_CANNOT_SELF_SIGN",
  ) {
    super(message);
    this.name = "WaiverError";
  }
}

export interface AttendeeInput {
  name: string;
  dateOfBirth?: Date | null;
  guardianEmail?: string | null;
  guardianUserId?: string | null;
}

/**
 * Determines whether an attendee requires a guardian to sign on their
 * behalf. Attendees with no date_of_birth on file are treated as adults
 * self-attesting; the listing's min_age check (see listings.ts) is what
 * actually blocks underage solo bookings when DOB is unknown.
 */
export function attendeeRequiresGuardian(attendee: AttendeeInput, listingMinAge: number): boolean {
  if (!attendee.dateOfBirth) return false;
  return isMinor(attendee.dateOfBirth, listingMinAge);
}

/**
 * Validates that every minor attendee has a guardian contact on file
 * (email or an existing guardian user). Throws GUARDIAN_REQUIRED
 * otherwise. Call this when attendees are first submitted for a booking,
 * before any waiver-signing links are generated.
 */
export function assertGuardiansProvided(attendees: AttendeeInput[], listingMinAge: number): void {
  attendees.forEach((attendee, index) => {
    if (attendeeRequiresGuardian(attendee, listingMinAge) && !attendee.guardianEmail && !attendee.guardianUserId) {
      throw new WaiverError(
        `Attendee "${attendee.name || `#${index + 1}`}" is a minor and requires a parent/guardian email before a waiver can be sent.`,
        "GUARDIAN_REQUIRED",
      );
    }
  });
}

/**
 * A minor can never be the signer of their own waiver, even if they
 * technically hold an account. Call this before accepting a waiver
 * submission.
 */
export function assertSignerIsNotTheMinorThemself(
  attendee: AttendeeInput,
  listingMinAge: number,
  signerUserId: string,
): void {
  if (
    attendeeRequiresGuardian(attendee, listingMinAge) &&
    attendee.guardianUserId &&
    signerUserId === attendee.guardianUserId
  ) {
    return;
  }
  if (attendeeRequiresGuardian(attendee, listingMinAge) && signerUserId !== attendee.guardianUserId) {
    throw new WaiverError(
      "This attendee is a minor; the waiver must be signed by their parent/guardian, not the attendee.",
      "MINOR_CANNOT_SELF_SIGN",
    );
  }
}

export interface AttendeeWaiverState {
  name: string;
  waiverStatus: "pending" | "signed" | null;
}

/**
 * Gate for booking confirmation / payment completion: every attendee on
 * the booking must have a signed waiver on file. This must run
 * server-side immediately before a booking is allowed to move out of
 * pending_payment — see /api/bookings/:id/confirm.
 */
export function assertAllWaiversSigned(attendees: AttendeeWaiverState[]): void {
  const unsigned = attendees.filter((a) => a.waiverStatus !== "signed");
  if (unsigned.length > 0) {
    throw new WaiverError(
      `${unsigned.length} attendee${unsigned.length === 1 ? "" : "s"} still need${unsigned.length === 1 ? "s" : ""} a signed waiver before this booking can be confirmed: ${unsigned.map((a) => a.name).join(", ")}.`,
      "WAIVERS_INCOMPLETE",
    );
  }
}
