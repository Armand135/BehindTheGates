import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHostOrgMember } from "@/lib/authz";
import { toErrorResponse } from "@/lib/api-errors";
import { createListingSchema } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const industry = params.get("industry");
  const tier = params.get("tier"); // "1" | "2" | "3"
  const minAge = params.get("age");
  const q = params.get("q");

  const where: Prisma.TourListingWhereInput = {
    status: "live",
    ...(industry ? { industryTags: { has: industry } } : {}),
    ...(minAge ? { minAge: { lte: Number(minAge) } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(tier
      ? {
          site: {
            accessTier: (tier === "1" ? "tier_1" : tier === "2" ? "tier_2" : "tier_3") as Prisma.EnumAccessTierFilter["equals"],
          },
        }
      : {}),
  };

  const listings = await prisma.tourListing.findMany({
    where,
    include: {
      site: { include: { hostOrganization: true } },
      availabilitySlots: {
        where: { cancelledAt: null, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  try {
    const body = createListingSchema.parse(await req.json());

    const site = await prisma.site.findUniqueOrThrow({ where: { id: body.siteId } });
    await requireHostOrgMember(site.hostOrganizationId);

    const listingType = site.accessTier === "tier_3" ? "virtual_only" : body.listingType;

    const listing = await prisma.tourListing.create({
      data: { ...body, listingType, status: "draft" },
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
