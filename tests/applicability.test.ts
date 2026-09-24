import { describe, it, expect } from "vitest";
import { isApplicable, APPLICABILITY, BOOT_FAMILIES } from "@/domain/applicability";

describe("applicability table", () => {
  it("shaft paths are inapplicable for pump and sandal", () => {
    for (const family of ["pump", "sandal", "mary-jane"]) {
      expect(isApplicable(family, "shaft")).toBe(false);
      expect(isApplicable(family, "shaft.heightStep")).toBe(false);
      expect(isApplicable(family, "shaft.fit")).toBe(false);
    }
  });

  it("shaft paths are applicable for boot families", () => {
    for (const family of BOOT_FAMILIES) {
      expect(isApplicable(family, "shaft.heightStep")).toBe(true);
    }
  });

  it("ungated paths are applicable everywhere", () => {
    for (const family of ["pump", "sandal", "boot", "mule", null]) {
      expect(isApplicable(family, "straps")).toBe(true);
      expect(isApplicable(family, "heel.type")).toBe(true);
      expect(isApplicable(family, "heel.breastProfile")).toBe(true);
      expect(isApplicable(family, "transition.wrap")).toBe(true);
    }
  });

  it("table stays minimal: one rule, shaft gated to boot families only", () => {
    expect(APPLICABILITY).toHaveLength(1);
    expect(APPLICABILITY[0].paths).toEqual(["shaft"]);
  });
});
