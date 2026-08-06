import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null; // dev/test: log instead of sending
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Set true for anything derived from a minor's record — see Section 7.6: never send marketing to minors' guardians without separate explicit consent. */
  transactionalOnly?: boolean;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const resend = getResend();
  const from = process.env.NOTIFICATIONS_FROM_EMAIL ?? "bookings@behindthegates.com";

  if (!resend) {
    console.info(`[notifications] (dev, no RESEND_API_KEY) would send "${subject}" to ${to}`);
    return;
  }

  await resend.emails.send({ from, to, subject, html });
}

export async function sendBookingConfirmation(params: {
  to: string;
  listingTitle: string;
  startTime: Date;
  meetingPoint?: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `Booking confirmed: ${params.listingTitle}`,
    html: `<p>Your booking for <strong>${params.listingTitle}</strong> on ${params.startTime.toLocaleString()} is confirmed.</p>${
      params.meetingPoint ? `<p>Meeting point: ${params.meetingPoint}</p>` : ""
    }`,
    transactionalOnly: true,
  });
}

export async function sendWaiverRequest(params: { to: string; attendeeName: string; bookingUrl: string }): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `Waiver required for ${params.attendeeName}`,
    html: `<p>Please review and sign the waiver for <strong>${params.attendeeName}</strong> before this booking can be confirmed:</p><p><a href="${params.bookingUrl}">${params.bookingUrl}</a></p>`,
    transactionalOnly: true,
  });
}

export async function sendSlotCancellationNotice(params: {
  to: string;
  listingTitle: string;
  startTime: Date;
  reason: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `Your visit "${params.listingTitle}" has been cancelled by the host`,
    html: `<p>The host cancelled the ${params.startTime.toLocaleString()} visit to <strong>${params.listingTitle}</strong>.</p><p>Reason: ${params.reason}</p><p>Your payment is being fully refunded automatically.</p>`,
    transactionalOnly: true,
  });
}
