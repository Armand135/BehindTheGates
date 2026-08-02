import { z } from "zod";

export const attendeeSchema = z.object({
  name: z.string().min(1).max(200),
  dateOfBirth: z.coerce.date().optional().nullable(),
  guardianEmail: z.string().email().optional().nullable(),
  guardianUserId: z.string().min(1).optional().nullable(),
});

export const createSiteSchema = z.object({
  hostOrganizationId: z.string().min(1),
  name: z.string().min(1).max(200),
  address: z.string().min(1),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  accessTier: z.enum(["tier_1", "tier_2", "tier_3"]).default("tier_1"),
  safetyNotes: z.string().optional().nullable(),
  accessibilityNotes: z.string().optional().nullable(),
});

export const createListingSchema = z.object({
  siteId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  industryTags: z.array(z.string()).default([]),
  durationMinutes: z.number().int().positive(),
  minAge: z.number().int().min(0).default(0),
  maxGroupSize: z.number().int().positive(),
  chaperoneRatio: z.number().int().positive().optional().nullable(),
  ppeRequired: z.array(z.string()).default([]),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  isFreeRecruitingVisit: z.boolean().default(false),
  cancellationPolicy: z.string().optional().nullable(),
  listingType: z.enum(["bookable", "virtual_only"]).default("bookable"),
});

export const updateListingSchema = createListingSchema.partial().omit({ siteId: true });

export const createAvailabilitySchema = z.object({
  tourListingId: z.string().min(1),
  slots: z
    .array(
      z.object({
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        capacity: z.number().int().positive(),
        isGroupOnly: z.boolean().default(false),
      }),
    )
    .min(1),
});

export const createBookingSchema = z.object({
  availabilitySlotId: z.string().min(1),
  bookingType: z.enum(["individual", "group"]).default("individual"),
  chaperoneCount: z.number().int().min(0).default(0),
  attendees: z.array(attendeeSchema).min(1),
});

export const submitWaiverSchema = z.object({
  attendeeId: z.string().min(1),
  signaturePayload: z.string().min(1),
  templateVersion: z.string().min(1).default("v1"),
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(1),
});

export const createHostOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
});

export const uploadInsuranceSchema = z.object({
  insuranceDocUrl: z.string().url(),
  insuranceExpiresAt: z.coerce.date(),
});

export const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export const createIncidentSchema = z.object({
  bookingId: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).default("low"),
});
