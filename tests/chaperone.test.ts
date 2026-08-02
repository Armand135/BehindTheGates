import { describe, expect, it } from "vitest";
import { assertChaperoneRatio, ChaperoneRatioError, minimumChaperones } from "@/lib/chaperone";

describe("minimumChaperones", () => {
  it("returns 0 when the listing has no ratio requirement", () => {
    expect(minimumChaperones(40, null)).toBe(0);
  });

  it("rounds up to the nearest whole chaperone", () => {
    expect(minimumChaperones(25, 10)).toBe(3); // 2.5 -> 3
    expect(minimumChaperones(20, 10)).toBe(2);
    expect(minimumChaperones(1, 10)).toBe(1);
  });
});

describe("assertChaperoneRatio", () => {
  it("passes when chaperone count meets the ratio", () => {
    expect(() => assertChaperoneRatio(30, 3, 10)).not.toThrow();
  });

  it("rejects a group with too few chaperones", () => {
    expect(() => assertChaperoneRatio(30, 2, 10)).toThrow(ChaperoneRatioError);
    try {
      assertChaperoneRatio(30, 2, 10);
    } catch (err) {
      expect(err).toBeInstanceOf(ChaperoneRatioError);
      expect((err as ChaperoneRatioError).requiredChaperones).toBe(3);
    }
  });

  it("allows any chaperone count when the listing has no ratio", () => {
    expect(() => assertChaperoneRatio(100, 0, null)).not.toThrow();
  });

  it("rejects zero chaperones for a group booking with a ratio", () => {
    expect(() => assertChaperoneRatio(15, 0, 10)).toThrow(/at least 2/);
  });
});
