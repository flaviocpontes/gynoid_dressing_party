import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { compileShoePrompt, containsDigits, PREAMBLE, SIGNATURE_PHRASE } from "@/domain/compile";
import { emptyRegistry } from "@/domain/registry";
import type { StepRec, Registry } from "@/domain/registry";
import type { CompileSheet } from "@/domain/compile";
import type { ShoeDetails } from "@/domain/shoe";

function registryFromSeed(): Registry {
  const reg = emptyRegistry();
  const seed = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../seed/scales.json"), "utf-8"),
  );
  for (const s of seed.scales) {
    const steps: StepRec[] = s.steps.map(
      (st: Record<string, unknown>, i: number) => ({
        id: `${s.id}:${i + 1}`,
        scaleId: s.id,
        rank: i + 1,
        zone: st.zone as StepRec["zone"],
        phrases: st.phrases as string[],
        adjectives: (st.adjectives as string[]) ?? (st.phrases as string[]),
        nuance: (st.nuance as string) || null,
        anchors: (st.anchors as string[]) ?? [],
      }),
    );
    for (const st of steps) reg.steps.set(st.id, st);
    reg.stepsByScale.set(s.id, steps);
  }
  return reg;
}

const reg = registryFromSeed();

// Decomposed fields from the five corpus sheets used during exploration.
const fixtures: { name: string; sheet: CompileSheet; expect: string[] }[] = [
  {
    name: "extreme mary janes glossy black metallic red (slingback pumps)",
    sheet: {
      upperFamily: "pump",
      details: {
        silhouette: { toeShape: "peep-toe", fastening: "slingback-strap" },
        upper: { primaryMaterial: "patent leather", upperPrimaryColor: "Jet Black" },
        heel: { type: "stiletto", heightStep: "shoes.heel_height:7", liftExternal: "metallic gold" },
        platform: {
          heightStep: "shoes.platform_height:7",
          shape: "block",
          material: "patent leather",
          edgeProfile: "straight-vertical",
          toeSpringStep: "shoes.toe_spring:6",
        },
        outsole: { lacquerColor: "metallic gold", lacquerGloss: "general.smoothness:9" },
      },
    },
    expect: [
      "A pair of towering jet-black patent leather pumps",
      "an extreme, sky-high stiletto heel",
      "an extremely towering, colossal mega, block-shaped patent leather platform",
      "extremely steep toe spring",
      "The metallic gold stiletto heel is ultra-long and needle-thin, rising far above the platform height",
      "metallic gold lacquer",
      SIGNATURE_PHRASE,
    ],
  },
  {
    name: "black patent closedtoe extreme platform pumps (disjunctive heel)",
    sheet: {
      upperFamily: "pump",
      details: {
        silhouette: { vampCoverage: "full-coverage" },
        upper: { primaryMaterial: "spectator patent leather", upperPrimaryColor: "Black" },
        heel: { type: ["stiletto", "wedge"], heightStep: "shoes.heel_height:7" },
        platform: { heightStep: "shoes.platform_height:7", toeSpringStep: "shoes.toe_spring:6" },
        outsole: { lacquerColor: "candy-apple red" },
      },
    },
    expect: [
      "A pair of towering black spectator patent leather pumps",
      "an extreme, sky-high stiletto or wedge heel",
      "extremely steep toe spring",
      "candy-apple red lacquer",
      SIGNATURE_PHRASE,
    ],
  },
  {
    name: "extreme seifuku black patent loafer pumps (gold stem, crimson outsole)",
    sheet: {
      upperFamily: "loafer",
      details: {
        silhouette: { fastening: "penny loafer slot strap with a gold coin insert" },
        upper: { primaryMaterial: "patent leather", upperPrimaryColor: "Black" },
        heel: { type: "stiletto", heightStep: "shoes.heel_height:7", liftExternal: "polished gold", breastFinish: "crimson red" },
        platform: { heightStep: "shoes.platform_height:7", material: "patent leather" },
        outsole: { lacquerColor: "crimson red", lacquerGloss: "general.smoothness:8" },
        construction: { welt: { absent: true }, ornamentation: { absent: true } },
        sensory: { lightBehavior: "sharp, high-specular reflections" },
      },
    },
    expect: [
      "A pair of towering black patent leather loafers",
      "an extreme, sky-high stiletto heel",
      "The polished gold stiletto heel is ultra-long and needle-thin, rising far above the platform height",
      "No visible welt, stitching, or ornamentation",
      "monolithic and sculptural",
      "crimson red lacquer",
      "sharp, high-specular reflections under studio lighting",
    ],
  },
  {
    name: "extreme towering black mary janes (baby pink lacquer)",
    sheet: {
      upperFamily: "mary-jane",
      details: {
        silhouette: { fastening: "mary-jane-strap" },
        upper: { primaryMaterial: "patent leather", upperPrimaryColor: "Jet Black" },
        heel: { type: "stiletto", heightStep: "shoes.heel_height:7", breastFinish: "baby pink" },
        platform: { heightStep: "shoes.platform_height:7", shape: "block", edgeProfile: "straight-vertical", toeSpringStep: "shoes.toe_spring:6" },
        outsole: { lacquerColor: "baby pink" },
        construction: { welt: { absent: true }, ornamentation: { absent: true } },
        sensory: { lightBehavior: "sharp, high-specular reflections" },
      },
    },
    expect: [
      "A pair of towering jet-black patent leather mary janes",
      "an extreme, sky-high stiletto heel",
      "an extremely towering, colossal mega, block-shaped platform",
      "Fastened with a mary jane strap",
      "baby pink lacquer",
      "No visible welt, stitching, or ornamentation",
      "sharp, high-specular reflections under studio lighting",
    ],
  },
  {
    name: "cream spectator patent oxford platform pumps (description-only sheet)",
    sheet: {
      upperFamily: "oxford",
      details: {
        silhouette: { fastening: "front-lace-up" },
        upper: { primaryMaterial: "spectator patent leather", upperPrimaryColor: "Cream" },
        heel: { type: "stiletto", heightStep: "shoes.heel_height:6" },
        platform: { heightStep: "shoes.platform_height:7" },
        outsole: { lacquerColor: "fuchsia" },
      },
    },
    expect: [
      "A pair of towering cream spectator patent leather oxfords",
      "a sky-high stiletto heel",
      "an extremely towering, colossal mega platform",
      "fuchsia lacquer",
      SIGNATURE_PHRASE,
    ],
  },
];

describe("compiler: corpus fixtures", () => {
  for (const f of fixtures) {
    it(`compiles ${f.name}`, () => {
      const text = compileShoePrompt(f.sheet, reg);
      expect(text.startsWith(PREAMBLE)).toBe(true);
      for (const sub of f.expect) {
        expect(text).toContain(sub);
      }
      // clause ordering: preamble < opening < upper < signature
      const opening = text.indexOf("A pair of");
      const upper = text.indexOf("The upper");
      const signature = text.indexOf(SIGNATURE_PHRASE);
      if (upper !== -1 && opening !== -1) expect(upper).toBeGreaterThan(opening);
      if (signature !== -1) expect(signature).toBeGreaterThan(opening);
      expect(containsDigits(text.slice(PREAMBLE.length))).toBe(false); // ban covers the body; preamble shot directives are fixed
    });
  }

  it("minimal sheet compiles minimal prompt (identity + heel + platform only)", () => {
    const text = compileShoePrompt(
      {
        upperFamily: "pump",
        details: {
          heel: { type: "stiletto", heightStep: "shoes.heel_height:6" },
          platform: { heightStep: "shoes.platform_height:5" },
        },
      },
      reg,
    );
    expect(text).toContain("A pair of towering pumps with a sky-high stiletto heel and a chunky platform.");
    expect(text).not.toContain("The upper");
    expect(text).not.toContain("Adorned");
    expect(text).not.toContain("Fastened");
    expect(text).not.toContain("No visible");
  });

  it("unfilled sections are omitted entirely", () => {
    const text = compileShoePrompt({ upperFamily: "mule", details: {} }, reg);
    expect(text).toBe(PREAMBLE + "\n\nA pair of mules.");
  });

  it("absence-only welt emits weld absence without ornamentation", () => {
    const text = compileShoePrompt(
      { upperFamily: "boot", details: { construction: { welt: { absent: true } } } },
      reg,
    );
    expect(text).toContain("No visible welt or stitching.");
    expect(text).not.toContain("ornamentation");
  });
});

describe("compiler: numeric ban and anchor exclusion", () => {
  it("contains no digits across fixtures", () => {
    for (const f of fixtures) {
      expect(containsDigits(compileShoePrompt(f.sheet, reg).slice(PREAMBLE.length))).toBe(false);
    }
  });

  it("anchors never leak into compiled prompts", () => {
    const sheet: CompileSheet = {
      upperFamily: "sandal",
      details: {
        heel: { type: "stiletto", heightStep: "shoes.heel_height:6" },
        platform: { heightStep: "shoes.platform_height:6", toeSpringStep: "shoes.toe_spring:4" },
      },
    };
    const text = compileShoePrompt(sheet, reg);
    for (const stepId of ["shoes.heel_height:6", "shoes.platform_height:6", "shoes.toe_spring:4"]) {
      const step = reg.steps.get(stepId)!;
      for (const anchor of step.anchors) {
        expect(text).not.toContain(anchor);
      }
    }
  });

  it("randomized filled-field combinations stay digit-free", () => {
    const families = ["pump", "sandal", "mule", "boot", "loafer", "oxford"];
    const heelSteps = ["shoes.heel_height:3", "shoes.heel_height:5", "shoes.heel_height:7"];
    const platSteps = ["shoes.platform_height:2", "shoes.platform_height:4", "shoes.platform_height:7", undefined];
    const colors = ["Ivory", "Crimson", "Emerald", null];
    const materials = ["patent leather", "suede", "velvet", null];
    const lacquers = ["fuchsia", "crimson red", null];
    let seed = 42;
    const rand = <T,>(arr: T[]): T => arr[(seed = (seed * 1103515245 + 12345) % 2 ** 31) % arr.length];
    for (let i = 0; i < 200; i++) {
      const details: ShoeDetails = {
        heel: { type: "stiletto", heightStep: rand(heelSteps) },
        platform: { heightStep: rand(platSteps.filter(Boolean) as string[]) },
        upper: {
          upperPrimaryColor: rand(colors) ?? undefined,
          primaryMaterial: rand(materials) ?? undefined,
        },
        outsole: { lacquerColor: rand(lacquers) ?? undefined },
      };
      const text = compileShoePrompt({ upperFamily: rand(families), details }, reg);
      expect(containsDigits(text.slice(PREAMBLE.length))).toBe(false);
    }
  });
});
