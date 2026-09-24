import { describe, it, expect } from "vitest";
import { filterTerms } from "@/domain/registry";
import { sectionCounts, EDITOR_SECTIONS, type SectionField } from "@/lib/field-specs";

const TERMS = [
  "Jet Black", "Black", "Metallic Gold", "Antique Metal Gold", "Dark Red Pearl",
  "Baby Pink", "Crimson Red", "Fuchsia", "Ivory", "custom-user-color",
];

describe("filterTerms", () => {
  it("empty query returns all terms", () => {
    expect(filterTerms(TERMS, "")).toEqual(TERMS);
    expect(filterTerms(TERMS, "   ")).toEqual(TERMS);
  });

  it("case-insensitive contains", () => {
    expect(filterTerms(TERMS, "metal")).toEqual(["Metallic Gold", "Antique Metal Gold"]);
    expect(filterTerms(TERMS, "JET")).toEqual(["Jet Black"]);
  });

  it("multi-word query requires every token", () => {
    expect(filterTerms(TERMS, "dark red")).toEqual(["Dark Red Pearl"]);
    expect(filterTerms(TERMS, "red dark")).toEqual(["Dark Red Pearl"]);
    expect(filterTerms(TERMS, "red gold")).toEqual([]);
  });

  it("custom terms filter like seeded ones", () => {
    expect(filterTerms(TERMS, "custom-user")).toEqual(["custom-user-color"]);
  });
});

const heelFields: SectionField[] = EDITOR_SECTIONS.find((s) => s.title === "Heel")!.fields;
const strapsFields: SectionField[] = EDITOR_SECTIONS.find((s) => s.title === "Straps")!.fields;

describe("sectionCounts", () => {
  it("empty sheet counts zero filled", () => {
    expect(sectionCounts({}, heelFields)).toEqual({ filled: 0, total: 12 });
  });

  it("counts filled fields, absent objects, and choice-sets as filled", () => {
    const counts = sectionCounts(
      {
        heel: {
          type: ["stiletto", "wedge"],
          heightStep: "shoes.heel_height:7",
          heelSeat: { absent: true },
        },
      },
      heelFields,
    );
    expect(counts).toEqual({ filled: 3, total: 12 });
  });

  it("empty strings do not count as filled", () => {
    const counts = sectionCounts({ heel: { liftExternal: "" } }, heelFields);
    expect(counts).toEqual({ filled: 0, total: 12 });
  });

  it("group counts once: filled only when a typed row exists", () => {
    expect(sectionCounts({}, strapsFields)).toEqual({ filled: 0, total: 1 });
    expect(sectionCounts({ straps: [{ type: "" }] }, strapsFields)).toEqual({ filled: 0, total: 1 });
    expect(sectionCounts({ straps: [{ type: "ankle-strap" }, { type: "" }] }, strapsFields)).toEqual({
      filled: 1,
      total: 1,
    });
  });

  it("every editor section reports a positive total (collapsed sections still count)", () => {
    for (const sec of EDITOR_SECTIONS) {
      const { filled, total } = sectionCounts({}, sec.fields);
      expect(total, sec.title).toBeGreaterThan(0);
      expect(filled, sec.title).toBe(0);
    }
  });
});
