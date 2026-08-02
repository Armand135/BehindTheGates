/**
 * Data-retention policy for minors' PII (Technical Brief Section 7.6).
 *
 * Guardian/minor PII (attendee name, date_of_birth, waiver signature) is
 * held under a stricter retention window than adult visitor data, and is
 * never used for marketing without separate, explicit guardian consent
 * (notifications.ts always sends minor-related email as transactional
 * only — see `transactionalOnly`).
 *
 * This module defines the policy as data; wiring it to a scheduled job
 * (e.g. a cron route calling `findExpiredMinorAttendees`) is an
 * infra-level task left for deployment configuration.
 */

/** Minor PII is retained for 2 years post-visit, then anonymized. */
export const MINOR_PII_RETENTION_DAYS = 730;

export function isPastMinorRetentionWindow(bookingCompletedAt: Date, asOf: Date = new Date()): boolean {
  const msElapsed = asOf.getTime() - bookingCompletedAt.getTime();
  const msRetention = MINOR_PII_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return msElapsed > msRetention;
}
