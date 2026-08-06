/**
 * Age calculation shared by the waiver and listing-eligibility logic.
 * All dates are compared in UTC to keep results deterministic across
 * server locales/timezones.
 */
export function calculateAge(dateOfBirth: Date, asOf: Date = new Date()): number {
  let age = asOf.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDiff = asOf.getUTCDate() - dateOfBirth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

export const LEGAL_ADULT_AGE = 18;

/**
 * An attendee is a minor (and therefore cannot sign their own waiver) if
 * they are under 18, OR under the host's stated minimum age for the tour —
 * whichever threshold is stricter. See Technical Brief Section 7.2.
 */
export function isMinor(dateOfBirth: Date, listingMinAge: number, asOf: Date = new Date()): boolean {
  const threshold = Math.max(LEGAL_ADULT_AGE, listingMinAge);
  return calculateAge(dateOfBirth, asOf) < threshold;
}

export function meetsMinimumAge(dateOfBirth: Date, listingMinAge: number, asOf: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, asOf) >= listingMinAge;
}
