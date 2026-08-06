import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { confirmBooking } from "@/lib/bookings";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature/secret." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid webhook signature: ${(err as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        await confirmBooking(bookingId, (session.payment_intent as string) ?? session.id);
      }
      break;
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const status = account.charges_enabled && account.payouts_enabled ? "active" : "onboarding";
      await prisma.hostOrganization.updateMany({
        where: { stripeConnectAccountId: account.id },
        data: { payoutStatus: status },
      });
      break;
    }
    case "transfer.created":
    case "transfer.reversed": {
      const transfer = event.data.object as Stripe.Transfer;
      const bookingId = (transfer.metadata as Record<string, string> | null)?.bookingId;
      if (bookingId) {
        await prisma.payout.updateMany({
          where: { bookingId },
          data: {
            stripeTransferId: transfer.id,
            status: event.type === "transfer.reversed" ? "failed" : "paid",
          },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
