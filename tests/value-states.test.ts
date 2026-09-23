import { describe, it, expect } from "vitest";
import { shoeDetails, isChoice, isAbsent, isFilled, normalizeFieldValue } from "@/domain/shoe";

const base = { silhouette: {}, upper: {}, outsole: {}, platform: {}, heel: {}, shaft: {}, construction: {}, sensory: {} };

describe("value states", () => {
  it("accepts unfilled (all sections empty)", () => {
    expect(shoeDetails.safeParse({}).success).toBe(true);
  });

  it("accepts single value", () => {
    expect(shoeDetails.safeParse({ heel: { type: "stiletto" } }).success).toBe(true);
  });

  it("accepts choice-set with two+ values", () => {
    const r = shoeDetails.safeParse({ heel: { type: ["stiletto", "wedge"] } });
    expect(r.success).toBe(true);
  });

  it("rejects single-element array as choice-set", () => {
    const r = shoeDetails.safeParse({ heel: { type: ["stiletto"] } });
    expect(r.success).toBe(false);
  });

  it("rejects numbers", () => {
    const r = shoeDetails.safeParse({ heel: { type: 5 } });
    expect(r.success).toBe(false);
  });

  it("accepts explicit absence on a field with an absence clause", () => {
    const r = shoeDetails.safeParse({ construction: { welt: { absent: true } } });
    expect(r.success).toBe(true);
  });

  it("rejects explicit absence on a field without an absence clause", () => {
    const r = shoeDetails.safeParse({ heel: { type: { absent: true } } });
    expect(r.success).toBe(false);
  });

  it("rejects absence inside nested top-piece objects", () => {
    const r = shoeDetails.safeParse({ heel: { topPiece: { material: { absent: true } } } });
    expect(r.success).toBe(false);
  });
});

describe("helpers", () => {
  it("classifies states", () => {
    expect(isFilled(null)).toBe(false);
    expect(isFilled("x")).toBe(true);
    expect(isChoice(["a", "b"])).toBe(true);
    expect(isChoice("a")).toBe(false);
    expect(isAbsent({ absent: true })).toBe(true);
    expect(isAbsent("a")).toBe(false);
  });

  it("collapses single-element arrays", () => {
    expect(normalizeFieldValue(["x"])).toBe("x");
    expect(normalizeFieldValue(["x", "y"])).toEqual(["x", "y"]);
    expect(normalizeFieldValue("x")).toBe("x");
  });
});
