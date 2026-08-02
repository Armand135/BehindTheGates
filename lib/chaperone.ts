/**
 * Chaperone-ratio enforcement for group bookings (Technical Brief Section 7.3).
 *
 * A listing's `chaperoneRatio` is stored as the ratio denominator, e.g. a
 * listing requiring "1 chaperone per 10 attendees" stores chaperoneRatio = 10.
 * A listing with no chaperone requirement stores `null`.
 */

export class ChaperoneRatioError extends Error {
  constructor(
    message: string,
    public readonly requiredChaperones: number,
  ) {
    super(message);
    this.name = "ChaperoneRatioError";
  }
}

export function minimumChaperones(headcount: number, chaperoneRatio: number | null): number {
  if (!chaperoneRatio || chaperoneRatio <= 0) return 0;
  return Math.ceil(headcount / chaperoneRatio);
}

/**
 * Throws ChaperoneRatioError if the supplied chaperone_count does not meet
 * the listing's minimum ratio. Callers (API routes) should surface the
 * error message + requiredChaperones as a 422 response.
 */
export function assertChaperoneRatio(
  headcount: number,
  chaperoneCount: number,
  chaperoneRatio: number | null,
): void {
  const required = minimumChaperones(headcount, chaperoneRatio);
  if (chaperoneCount < required) {
    throw new ChaperoneRatioError(
      `This tour requires at least ${required} chaperone${required === 1 ? "" : "s"} for a group of ${headcount} (ratio 1:${chaperoneRatio}). Only ${chaperoneCount} supplied.`,
      required,
    );
  }
}
