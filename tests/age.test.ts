import { describe, expect, it } from "vitest";
import { calculateAge, isMinor, meetsMinimumAge } from "@/lib/age";

const ASOF = new Date("2026-08-02T00:00:00Z");

describe("calculateAge", () => {
  it("computes exact age as of a reference date", () => {
    expect(calculateAge(new Date("2008-08-02T00:00:00Z"), ASOF)).toBe(18);
    expect(calculateAge(new Date("2008-08-03T00:00:00Z"), ASOF)).toBe(17); // birthday is tomorrow
    expect(calculateAge(new Date("2008-01-01T00:00:00Z"), ASOF)).toBe(18);
  });
});

describe("isMinor", () => {
  it("treats under-18 as a minor when the listing has no stricter min_age", () => {
    expect(isMinor(new Date("2010-01-01T00:00:00Z"), 0, ASOF)).toBe(true);
    expect(isMinor(new Date("2000-01-01T00:00:00Z"), 0, ASOF)).toBe(false);
  });

  it("uses the host's min_age when it is stricter than 18", () => {
    // 20 years old, but listing requires min_age 21 -> still routes through guardian
    expect(isMinor(new Date("2006-08-01T00:00:00Z"), 21, ASOF)).toBe(true);
  });

  it("does not let a low min_age override the 18-year floor", () => {
    // 16 years old, listing min_age is only 12 -> still a minor (18 floor wins)
    expect(isMinor(new Date("2010-08-01T00:00:00Z"), 12, ASOF)).toBe(true);
  });
});

describe("meetsMinimumAge", () => {
  it("checks eligibility against the listing's min_age directly", () => {
    expect(meetsMinimumAge(new Date("2010-01-01T00:00:00Z"), 14, ASOF)).toBe(true);
    expect(meetsMinimumAge(new Date("2015-01-01T00:00:00Z"), 14, ASOF)).toBe(false);
  });
});
