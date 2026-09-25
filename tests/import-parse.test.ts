import { describe, it, expect } from "vitest";
import { extractJsonBlock, normalizeTerm, parsePassResponse } from "@/domain/import/parse";
import { emptyRegistry, type Registry, type StepRec } from "@/domain/registry";
import { registryFromSeed } from "./seed-registry";

const reg = registryFromSeed();

function miniRegistry(): Registry {
  const r = emptyRegistry();
  const steps: StepRec[] = [1, 2, 3].map((i) => ({
    id: `shoes.heel_height:${i}`,
    scaleId: "shoes.heel_height",
    rank: i,
    zone: "low" as const,
    phrases: [`p${i}`],
    adjectives: [`p${i}`],
    nuance: null,
    anchors: [`a${i}`],
  }));
  steps.forEach((s) => r.steps.set(s.id, s));
  r.stepsByScale.set("shoes.heel_height", steps);
  r.vocabTerms.set("heel_type", ["stiletto", "kitten"]);
  r.vocabTerms.set("toe_shape", ["sharp-point", "almond"]);
  return r;
}

describe("extractJsonBlock", () => {
  it("extracts fenced JSON from prose", () => {
    const raw = 'Here you go:\n```json\n{"heel.type": "stiletto"}\n```\nHope that helps.';
    expect(extractJsonBlock(raw)).toEqual({ "heel.type": "stiletto" });
  });
  it("returns null when no object exists", () => {
    expect(extractJsonBlock("no json here")).toBeNull();
  });
});

describe("normalizeTerm", () => {
  it("kebab-cases free text", () => {
    expect(normalizeTerm("Kitten Heel")).toBe("kitten-heel");
    expect(normalizeTerm("  extra   spaces ")).toBe("extra-spaces");
  });
  it("resolves canonical vocabulary terms without fuzzy snapping", () => {
    expect(normalizeTerm("stiletto", ["stiletto", "kitten"])).toBe("stiletto");
    expect(normalizeTerm("Kitten Heel", ["kitten-heel"])).toBe("kitten-heel");
    // case-insensitive exact match resolves to canonical casing (color vocabs are Title Case)
    expect(normalizeTerm("black", ["Black", "Off-Black"])).toBe("Black");
    // kebab-insensitive match (multi-word vocab terms keep spaces)
    expect(normalizeTerm("dark-gray", ["Dark Gray"])).toBe("Dark Gray");
    // no nearest-term snapping: unknown stays custom kebab
    expect(normalizeTerm("stilleto", ["stiletto"])).toBe("stilleto");
  });
});

describe("parsePassResponse value-state mapping", () => {
  it("single string becomes a value", () => {
    const out = parsePassResponse("heel", '{"heel.type": "stiletto"}', reg);
    expect(out.proposals).toEqual([{ path: "heel.type", value: "stiletto" }]);
  });

  it("hedged answer becomes a choice-set", () => {
    const out = parsePassResponse("silhouette", '{"silhouette.toeShape": ["pointed", "possibly almond"]}', miniRegistry());
    // "possibly almond" keeps its word — hedging phrases are part of the hedge
    expect(out.proposals).toEqual([{ path: "silhouette.toeShape", value: ["pointed", "possibly-almond"] }]);
  });

  it("not-present becomes absence only on absence-legal paths", () => {
    const legal = parsePassResponse("silhouette", '{"silhouette.fastening": "not-present"}', reg);
    expect(legal.proposals).toEqual([{ path: "silhouette.fastening", value: { absent: true } }]);
    const illegal = parsePassResponse("silhouette", '{"silhouette.toeShape": "not present"}', reg);
    expect(illegal.proposals).toEqual([]);
    expect(illegal.notes[0].note).toContain("absence not defined");
  });

  it("cannot-discern leaves the field unfilled with a note", () => {
    const out = parsePassResponse("heel", '{"heel.type": "cannot tell from this image"}', reg);
    expect(out.proposals).toEqual([]);
    expect(out.notes[0]).toMatchObject({ path: "heel.type" });
    expect(out.notes[0].note).toContain("cannot-discern");
  });

  it("terms containing a sentinel word are ordinary answers", () => {
    const welt = parsePassResponse("construction", '{"construction.welt": "none-cemented"}', reg);
    expect(welt.proposals).toEqual([{ path: "construction.welt", value: "none-cemented" }]);
    const toe = parsePassResponse("silhouette", '{"silhouette.toeShape": "no-show"}', reg);
    expect(toe.proposals).toEqual([{ path: "silhouette.toeShape", value: "no-show" }]);
    const mat = parsePassResponse("upper", '{"upper.primaryMaterial": "unclear-coated leather"}', reg);
    expect(mat.proposals).toEqual([{ path: "upper.primaryMaterial", value: "unclear-coated-leather" }]);
  });

  it("a leading standalone 'no' reads as not-present on absence-legal paths", () => {
    const out = parsePassResponse("construction", '{"construction.welt": "no visible welt or stitching"}', reg);
    expect(out.proposals).toEqual([{ path: "construction.welt", value: { absent: true } }]);
  });

  it("whole-answer sentinels tolerate case and trailing punctuation", () => {
    const out = parsePassResponse("heel", '{"heel.type": "Cannot discern."}', reg);
    expect(out.proposals).toEqual([]);
    expect(out.notes[0].note).toContain("cannot-discern");
  });

  it("digit-bearing answers are rejected to unfilled with a note", () => {
    const out = parsePassResponse("heel", '{"heel.heightStep": "about 12 centimeters"}', reg);
    expect(out.proposals).toEqual([]);
    expect(out.notes[0].note).toContain("digit-bearing value rejected");
  });

  it("valid scale step ids are accepted verbatim", () => {
    const out = parsePassResponse("heel", '{"heel.heightStep": "shoes.heel_height:7"}', reg);
    expect(out.proposals).toEqual([{ path: "heel.heightStep", value: "shoes.heel_height:7" }]);
  });

  it("decorated step references are extracted", () => {
    const gloss = parsePassResponse("upper", '{"outsole.lacquerGloss": "general.smoothness:9 (high)"}', reg);
    expect(gloss.proposals).toEqual([{ path: "outsole.lacquerGloss", value: "general.smoothness:9" }]);
    expect(gloss.notes).toEqual([]);
    const heel = parsePassResponse("heel", '{"heel.heightStep": "step shoes.heel_height:7, I think"}', reg);
    expect(heel.proposals).toEqual([{ path: "heel.heightStep", value: "shoes.heel_height:7" }]);
  });

  it("a step reference from another scale is rejected with a wrong-scale note", () => {
    const out = parsePassResponse("heel", '{"heel.heightStep": "shoes.platform_height:4"}', reg);
    expect(out.proposals).toEqual([]);
    expect(out.notes[0].note).toContain("wrong scale");
  });

  it("two distinct valid step ids in one answer propose nothing", () => {
    const out = parsePassResponse("heel", '{"heel.heightStep": "shoes.heel_height:6 or shoes.heel_height:7"}', reg);
    expect(out.proposals).toEqual([]);
    expect(out.notes[0].note).toContain("re-ask");
  });

  it("hedged scale answers stay unfilled (sheet scale fields hold one step id)", () => {
    const out = parsePassResponse(
      "heel",
      '{"heel.heightStep": ["shoes.heel_height:6", "shoes.heel_height:7"]}',
      reg,
    );
    expect(out.proposals).toEqual([]);
    expect(out.notes[0].note).toContain("re-ask");
  });

  it("unparseable responses record themselves and propose nothing", () => {
    const out = parsePassResponse("heel", "the shoe is nice but I refuse JSON", reg);
    expect(out.proposals).toEqual([]);
    expect(out.notes[0].note).toContain("unparseable");
  });

  it("unknown keys are ignored", () => {
    const out = parsePassResponse("heel", '{"heel.type": "stiletto", "vibes": "immaculate"}', reg);
    expect(out.proposals).toHaveLength(1);
  });

  it("nested answer objects flatten to dotted paths", () => {
    const out = parsePassResponse(
      "silhouette",
      '{"silhouette": {"toeShape": "almond", "fastening": "not-present"}}',
      reg,
    );
    expect(out.proposals).toEqual([
      { path: "silhouette.toeShape", value: "almond" },
      { path: "silhouette.fastening", value: { absent: true } },
    ]);
  });

  it("family pass parses the upperFamily proposal", () => {
    const out = parsePassResponse("family", '{"upperFamily": "pump"}', reg);
    expect(out.proposals).toEqual([{ path: "upperFamily", value: "pump" }]);
  });

  it("re-ask parses a single field answer", () => {
    const out = parsePassResponse("re-ask:silhouette.toeShape", '{"silhouette.toeShape": "almond"}', reg);
    expect(out.proposals).toEqual([{ path: "silhouette.toeShape", value: "almond" }]);
  });

  it("strap rows parse with normalized row fields", () => {
    const out = parsePassResponse(
      "straps",
      '{"straps": [{"type": "Ankle Strap", "widthStep": "general.width:5"}, {"type": ""}]}',
      reg,
    );
    expect(out.proposals).toHaveLength(1);
    const rows = out.proposals[0].value as Record<string, unknown>[];
    expect(rows).toEqual([{ type: "ankle-strap", widthStep: "general.width:5" }]);
  });
});
