/**
 * Listing publish-gating and Tier 3 restrictions (Technical Brief Section
 * 7.4 and 7.7). A HostOrganization/TourListing pair must satisfy these
 * checks server-side before a listing may move pending_review -> live,
 * and before it may be surfaced as bookable.
 */

export class ListingPublishError extends Error {
  constructor(
    message: string,
    public readonly missingFields: string[],
  ) {
    super(message);
    this.name = "ListingPublishError";
  }
}

export interface HostForPublishCheck {
  verificationStatus: "unclaimed" | "pending" | "verified";
  insuranceDocUrl: string | null;
  insuranceExpiresAt: Date | null;
}

export interface ListingForPublishCheck {
  insuranceDocUrl?: string | null; // inherited from host unless overridden per-listing
  ppeRequired: string[];
  minAge: number | null;
  chaperoneRatio: number | null;
  maxGroupSize: number | null;
}

/**
 * Returns the list of missing/invalid safety fields that block a listing
 * from going live. An empty array means the listing may be published.
 * `platform_admin` may still force-publish despite failures, but that
 * override must be explicitly logged to the audit trail by the caller.
 */
export function getPublishBlockers(host: HostForPublishCheck, listing: ListingForPublishCheck): string[] {
  const blockers: string[] = [];

  if (host.verificationStatus !== "verified") {
    blockers.push("host_not_verified");
  }
  if (!host.insuranceDocUrl) {
    blockers.push("insurance_doc_url");
  }
  if (host.insuranceExpiresAt && host.insuranceExpiresAt.getTime() <= Date.now()) {
    blockers.push("insurance_expired");
  }
  if (!listing.ppeRequired) {
    blockers.push("ppe_required");
  }
  if (listing.minAge === null || listing.minAge === undefined) {
    blockers.push("min_age");
  }
  if (!listing.maxGroupSize || listing.maxGroupSize <= 0) {
    blockers.push("max_group_size");
  }

  return blockers;
}

export function assertCanPublish(host: HostForPublishCheck, listing: ListingForPublishCheck): void {
  const blockers = getPublishBlockers(host, listing);
  if (blockers.length > 0) {
    throw new ListingPublishError(
      `Listing cannot go live until these safety fields are complete: ${blockers.join(", ")}.`,
      blockers,
    );
  }
}

/**
 * Tier 3 (security-restricted) sites never support physical booking —
 * only virtual-tour content and an interest waitlist (Section 7.7).
 */
export function assertBookable(listingType: "bookable" | "virtual_only"): void {
  if (listingType !== "bookable") {
    throw new ListingPublishError(
      "This listing is virtual-tour only and does not support ticketed bookings. Join the interest waitlist instead.",
      ["listing_type"],
    );
  }
}
