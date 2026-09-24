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

describe("deep sheet fields", () => {
  it.each([
    ["heel breast profile", { heel: { breastProfile: "concave" } }],
    ["lift internal", { heel: { liftInternal: "steel-reinforced" } }],
    ["counter rigidity", { counter: { rigidity: "rigid-stiff" } }],
    ["counter grip", { counter: { grip: "suede-lined" } }],
    ["hardware type", { hardware: { type: "pin-buckle" } }],
    ["hardware finish", { hardware: { finish: "polished-gold" } }],
    ["outsole style", { construction: { outsoleStyle: "diamond-pattern" } }],
    ["outsole finish", { construction: { outsoleFinish: "lacquered-glossy" } }],
    ["insole cushioning", { construction: { cushioning: "gel-zone" } }],
    ["welt visibility", { construction: { weltVisibility: "hidden-flush" } }],
    ["transition wrap", { transition: { wrap: "monolithic-seamless-wrap" } }],
    ["transition edge", { transition: { edge: "knife-edge" } }],
  ])("parses %s", (_name, details) => {
    expect(shoeDetails.safeParse(details).success).toBe(true);
  });

  it.each([
    ["counter rigidity", { counter: { rigidity: { absent: true } } }],
    ["transition wrap", { transition: { wrap: { absent: true } } }],
    ["hardware type", { hardware: { type: { absent: true } } }],
    ["heel breast profile", { heel: { breastProfile: { absent: true } } }],
  ])("rejects explicit absence on unknown path: %s", (_name, details) => {
    expect(shoeDetails.safeParse(details).success).toBe(false);
  });
});

describe("straps sub-entity", () => {
  it("parses a full strap row", () => {
    const r = shoeDetails.parse({
      straps: [
        {
          type: "slingback",
          widthStep: "general.width:6",
          material: "patent leather",
          hardwareFinish: "polished gold",
          anchor: "heel-collar",
          closure: "buckle",
          note: "elastic insert",
        },
      ],
    });
    expect(r.straps?.[0].anchor).toBe("heel-collar");
    expect(r.straps?.[0].widthStep).toBe("general.width:6");
  });

  it("drops an empty straps array (and adornments alike)", () => {
    const r = shoeDetails.parse({ straps: [], adornments: [] });
    expect(r.straps).toBeUndefined();
    expect(r.adornments).toBeUndefined();
  });

  it("rejects a type-less strap row", () => {
    const r = shoeDetails.safeParse({ straps: [{ material: "suede" }] });
    expect(r.success).toBe(false);
  });

  it("keeps sheet order", () => {
    const r = shoeDetails.parse({ straps: [{ type: "ankle-strap" }, { type: "mary-jane" }] });
    expect(r.straps?.map((s) => s.type)).toEqual(["ankle-strap", "mary-jane"]);
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
