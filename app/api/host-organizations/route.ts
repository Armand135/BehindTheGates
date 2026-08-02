import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createHostOrganizationSchema } from "@/lib/validation";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = createHostOrganizationSchema.parse(await req.json());

    const hostOrganization = await prisma.hostOrganization.create({
      data: {
        ...body,
        verificationStatus: "pending",
        members: { create: { userId: session.user.id, role: "owner" } },
      },
    });

    if (session.user.role === "visitor") {
      await prisma.user.update({ where: { id: session.user.id }, data: { role: "host_admin" } });
    }

    let onboardingUrl: string | null = null;
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      const account = await stripe.accounts.create({ type: "express", email: session.user.email ?? undefined });
      await prisma.hostOrganization.update({
        where: { id: hostOrganization.id },
        data: { stripeConnectAccountId: account.id, payoutStatus: "onboarding" },
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
      const link = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${appUrl}/host/onboarding`,
        return_url: `${appUrl}/host/dashboard`,
        type: "account_onboarding",
      });
      onboardingUrl = link.url;
    }

    return NextResponse.json({ hostOrganization, onboardingUrl }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
