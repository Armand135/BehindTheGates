import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Demo-only password for every seeded account — never used outside local/dev seeding. */
const DEMO_PASSWORD_HASH = bcrypt.hashSync("password123", 10);

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@behindthegates.com" },
    update: { passwordHash: DEMO_PASSWORD_HASH, role: "platform_admin" },
    create: {
      email: "admin@behindthegates.com",
      name: "Platform Admin",
      role: "platform_admin",
      passwordHash: DEMO_PASSWORD_HASH,
    },
  });

  const hostUser = await prisma.user.upsert({
    where: { email: "host@meridianmotors.example" },
    update: { passwordHash: DEMO_PASSWORD_HASH, role: "host_admin" },
    create: {
      email: "host@meridianmotors.example",
      name: "Meridian Motors Ops",
      role: "host_admin",
      passwordHash: DEMO_PASSWORD_HASH,
    },
  });

  const host = await prisma.hostOrganization.upsert({
    where: { id: "seed-host-meridian" },
    update: {},
    create: {
      id: "seed-host-meridian",
      name: "Meridian Motors",
      description: "Electric vehicle assembly plant open for public tours.",
      industry: "Automotive manufacturing",
      verificationStatus: "verified",
      insuranceDocUrl: "https://example.com/docs/meridian-insurance.pdf",
      insuranceExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      payoutStatus: "active",
      members: {
        connectOrCreate: {
          where: { hostOrganizationId_userId: { hostOrganizationId: "seed-host-meridian", userId: hostUser.id } },
          create: { userId: hostUser.id, role: "owner" },
        },
      },
    },
  });

  const site = await prisma.site.upsert({
    where: { id: "seed-site-meridian-plant" },
    update: {},
    create: {
      id: "seed-site-meridian-plant",
      hostOrganizationId: host.id,
      name: "Meridian Motors Assembly Plant",
      address: "1 Meridian Way, Austin, TX",
      lat: 30.2672,
      lng: -97.7431,
      accessTier: "tier_1",
      safetyNotes: "Closed-toe shoes required. No loose jewelry on the factory floor.",
    },
  });

  const listing = await prisma.tourListing.upsert({
    where: { id: "seed-listing-meridian-floor-tour" },
    update: {},
    create: {
      id: "seed-listing-meridian-floor-tour",
      siteId: site.id,
      title: "Factory Floor Tour: From Battery to Rollout",
      description:
        "Walk the full assembly line of our flagship EV — from battery pack integration to final quality inspection. A great fit for career-exploration groups and manufacturing enthusiasts alike.",
      industryTags: ["automotive", "manufacturing", "engineering"],
      durationMinutes: 90,
      minAge: 10,
      maxGroupSize: 30,
      chaperoneRatio: 8,
      ppeRequired: ["safety_glasses", "closed_toe_shoes", "hi_vis_vest"],
      priceCents: 1500,
      currency: "USD",
      cancellationPolicy: "Full refund up to 48 hours before your visit.",
      status: "live",
    },
  });

  const now = new Date();
  for (let i = 1; i <= 4; i++) {
    const startTime = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + listing.durationMinutes * 60 * 1000);
    await prisma.availabilitySlot.upsert({
      where: { id: `seed-slot-meridian-${i}` },
      update: {},
      create: {
        id: `seed-slot-meridian-${i}`,
        tourListingId: listing.id,
        startTime,
        endTime,
        capacity: 30,
      },
    });
  }

  const portHost = await prisma.hostOrganization.upsert({
    where: { id: "seed-host-harborline" },
    update: {},
    create: {
      id: "seed-host-harborline",
      name: "Harborline Container Terminal",
      description: "Regional container port — security-restricted, virtual access only for now.",
      industry: "Logistics & shipping",
      verificationStatus: "verified",
      insuranceDocUrl: "https://example.com/docs/harborline-insurance.pdf",
      insuranceExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    },
  });

  const portSite = await prisma.site.upsert({
    where: { id: "seed-site-harborline" },
    update: {},
    create: {
      id: "seed-site-harborline",
      hostOrganizationId: portHost.id,
      name: "Harborline Terminal 3",
      address: "3 Harbor Blvd, Long Beach, CA",
      accessTier: "tier_3",
    },
  });

  await prisma.tourListing.upsert({
    where: { id: "seed-listing-harborline-virtual" },
    update: {},
    create: {
      id: "seed-listing-harborline-virtual",
      siteId: portSite.id,
      title: "Virtual Tour: Inside a Modern Container Port",
      description:
        "A 360-degree video walkthrough of crane operations, container yard logistics, and vessel loading — plus a waitlist for future in-person access.",
      industryTags: ["logistics", "shipping", "ports"],
      durationMinutes: 25,
      minAge: 0,
      maxGroupSize: 1,
      ppeRequired: [],
      priceCents: 0,
      isFreeRecruitingVisit: true,
      listingType: "virtual_only",
      status: "live",
    },
  });

  const visitor = await prisma.user.upsert({
    where: { email: "visitor@example.com" },
    update: { passwordHash: DEMO_PASSWORD_HASH },
    create: {
      email: "visitor@example.com",
      name: "Demo Visitor",
      role: "visitor",
      passwordHash: DEMO_PASSWORD_HASH,
    },
  });

  console.log("Seed complete:", { admin: admin.email, host: host.name, visitor: visitor.email, listing: listing.title });
  console.log("All seeded accounts use the password: password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
