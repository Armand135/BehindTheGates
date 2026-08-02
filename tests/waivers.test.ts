import { describe, expect, it } from "vitest";
import {
  assertAllWaiversSigned,
  assertGuardiansProvided,
  assertSignerIsNotTheMinorThemself,
  attendeeRequiresGuardian,
  WaiverError,
} from "@/lib/waivers";

const ASOF = new Date("2026-08-02T00:00:00Z");
const ADULT_DOB = new Date("1990-01-01T00:00:00Z");
const MINOR_DOB = new Date("2012-01-01T00:00:00Z"); // 14 as of ASOF

describe("attendeeRequiresGuardian", () => {
  it("is false for an adult", () => {
    expect(attendeeRequiresGuardian({ name: "A", dateOfBirth: ADULT_DOB }, 0)).toBe(false);
  });

  it("is true for a minor", () => {
    expect(attendeeRequiresGuardian({ name: "Kid", dateOfBirth: MINOR_DOB }, 0)).toBe(true);
  });

  it("is false when DOB is unknown (adult self-attestation)", () => {
    expect(attendeeRequiresGuardian({ name: "Unknown", dateOfBirth: null }, 0)).toBe(false);
  });
});

describe("assertGuardiansProvided", () => {
  it("passes when every minor has a guardian email or account", () => {
    expect(() =>
      assertGuardiansProvided(
        [
          { name: "Adult", dateOfBirth: ADULT_DOB },
          { name: "Kid", dateOfBirth: MINOR_DOB, guardianEmail: "parent@example.com" },
        ],
        0,
      ),
    ).not.toThrow();
  });

  it("rejects a minor attendee with no guardian contact", () => {
    expect(() => assertGuardiansProvided([{ name: "Kid", dateOfBirth: MINOR_DOB }], 0)).toThrow(WaiverError);
    try {
      assertGuardiansProvided([{ name: "Kid", dateOfBirth: MINOR_DOB }], 0);
    } catch (err) {
      expect((err as WaiverError).code).toBe("GUARDIAN_REQUIRED");
    }
  });
});

describe("assertSignerIsNotTheMinorThemself", () => {
  it("allows the registered guardian to sign", () => {
    expect(() =>
      assertSignerIsNotTheMinorThemself(
        { name: "Kid", dateOfBirth: MINOR_DOB, guardianUserId: "guardian-1" },
        0,
        "guardian-1",
      ),
    ).not.toThrow();
  });

  it("rejects anyone other than the guardian signing for a minor", () => {
    expect(() =>
      assertSignerIsNotTheMinorThemself(
        { name: "Kid", dateOfBirth: MINOR_DOB, guardianUserId: "guardian-1" },
        0,
        "kid-account",
      ),
    ).toThrow(/must be signed by their parent\/guardian/);
  });

  it("allows an adult to sign their own waiver", () => {
    expect(() => assertSignerIsNotTheMinorThemself({ name: "Adult", dateOfBirth: ADULT_DOB }, 0, "adult-1")).not.toThrow();
  });
});

describe("assertAllWaiversSigned", () => {
  it("passes when every attendee has a signed waiver", () => {
    expect(() =>
      assertAllWaiversSigned([
        { name: "A", waiverStatus: "signed" },
        { name: "B", waiverStatus: "signed" },
      ]),
    ).not.toThrow();
  });

  it("blocks confirmation when any attendee lacks a signed waiver", () => {
    expect(() =>
      assertAllWaiversSigned([
        { name: "A", waiverStatus: "signed" },
        { name: "B", waiverStatus: "pending" },
        { name: "C", waiverStatus: null },
      ]),
    ).toThrow(/B, C/);
  });
});
