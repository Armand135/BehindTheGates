import { describe, expect, it } from "vitest";
import { assertBookable, assertCanPublish, getPublishBlockers, ListingPublishError } from "@/lib/listings";

const verifiedHost = {
  verificationStatus: "verified" as const,
  insuranceDocUrl: "https://example.com/insurance.pdf",
  insuranceExpiresAt: new Date("2030-01-01T00:00:00Z"),
};

const completeListing = {
  ppeRequired: ["hard_hat", "safety_glasses"],
  minAge: 12,
  chaperoneRatio: 10,
  maxGroupSize: 30,
};

describe("getPublishBlockers", () => {
  it("returns no blockers for a fully-compliant host + listing", () => {
    expect(getPublishBlockers(verifiedHost, completeListing)).toEqual([]);
  });

  it("blocks on missing insurance doc", () => {
    expect(getPublishBlockers({ ...verifiedHost, insuranceDocUrl: null }, completeListing)).toContain(
      "insurance_doc_url",
    );
  });

  it("blocks on expired insurance", () => {
    expect(
      getPublishBlockers({ ...verifiedHost, insuranceExpiresAt: new Date("2020-01-01T00:00:00Z") }, completeListing),
    ).toContain("insurance_expired");
  });

  it("blocks an unverified host regardless of listing completeness", () => {
    expect(getPublishBlockers({ ...verifiedHost, verificationStatus: "pending" }, completeListing)).toContain(
      "host_not_verified",
    );
  });

  it("blocks on missing min_age, and on non-positive max_group_size", () => {
    const blockers = getPublishBlockers(verifiedHost, { ...completeListing, minAge: null, maxGroupSize: 0 });
    expect(blockers).toContain("min_age");
    expect(blockers).toContain("max_group_size");
  });
});

describe("assertCanPublish", () => {
  it("throws ListingPublishError listing every missing field", () => {
    expect(() =>
      assertCanPublish(
        { verificationStatus: "unclaimed", insuranceDocUrl: null, insuranceExpiresAt: null },
        { ppeRequired: [], minAge: null, chaperoneRatio: null, maxGroupSize: null },
      ),
    ).toThrow(ListingPublishError);
  });

  it("does not throw for a compliant host + listing", () => {
    expect(() => assertCanPublish(verifiedHost, completeListing)).not.toThrow();
  });
});

describe("assertBookable", () => {
  it("allows bookable listings", () => {
    expect(() => assertBookable("bookable")).not.toThrow();
  });

  it("rejects booking a virtual_only (Tier 3) listing", () => {
    expect(() => assertBookable("virtual_only")).toThrow(/waitlist/);
  });
});
