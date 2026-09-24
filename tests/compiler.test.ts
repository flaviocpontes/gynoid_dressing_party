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

describe("compiler: deep sheet clauses", () => {
  it("emits straps in sheet order and drops the clause when removed", () => {
    const withStraps: CompileSheet = {
      upperFamily: "sandal",
      details: {
        straps: [
          { type: "mary-jane", widthStep: "general.width:8", material: "patent leather" },
          { type: "ankle-strap", anchor: "ankle", closure: "buckle", hardwareFinish: "polished gold" },
        ],
      },
    };
    const text = compileShoePrompt(withStraps, reg);
    const mj = text.indexOf("mary jane");
    const ankle = text.indexOf("ankle strap");
    expect(text).toContain("Strapped with");
    expect(mj).toBeGreaterThan(-1);
    expect(ankle).toBeGreaterThan(mj); // sheet order preserved
    expect(text).toContain("expansive, sprawling mary jane"); // top-zone width stacking
    expect(text).toContain("anchored at the ankle");
    expect(text).toContain("closing with a polished gold buckle");

    const without = compileShoePrompt(
      { upperFamily: "sandal", details: { straps: [{ type: "mary-jane" }] } },
      reg,
    );
    expect(without).toContain("Strapped with");
    const bare = compileShoePrompt({ upperFamily: "sandal", details: {} }, reg);
    expect(bare).not.toContain("Strapped with");
  });

  it("razor-thin bottom-zone width also reads naturally", () => {
    const text = compileShoePrompt(
      {
        upperFamily: "sandal",
        details: { straps: [{ type: "toe-post", widthStep: "general.width:1" }] },
      },
      reg,
    );
    expect(text).toContain("hairline, razor-thin toe post");
  });

  it("emits transition clause only when filled", () => {
    const filled = compileShoePrompt(
      {
        upperFamily: "pump",
        details: { transition: { wrap: "monolithic-seamless-wrap", edge: "knife-edge" } },
      },
      reg,
    );
    expect(filled).toContain("The upper meets the platform in a monolithic seamless wrap, finished with a knife edge transition.");
    const empty = compileShoePrompt({ upperFamily: "pump", details: {} }, reg);
    expect(empty).not.toContain("upper meets the platform");
  });

  it("folds deep heel detail into the heel narrative", () => {
    const text = compileShoePrompt(
      {
        upperFamily: "pump",
        details: {
          heel: { breastFinish: "lacquered", breastProfile: "concave", liftInternal: "steel-reinforced" },
        },
      },
      reg,
    );
    expect(text).toContain("The heel breast is lacquered, concave in profile.");
    expect(text).toContain("The heel lift is steel reinforced within.");
  });

  it("emits counter and hardware clauses only when filled", () => {
    const text = compileShoePrompt(
      {
        upperFamily: "pump",
        details: { counter: { rigidity: "rigid-stiff", grip: "suede-lined" }, hardware: { type: "pin-buckle", finish: "polished-gold" } },
      },
      reg,
    );
    expect(text).toContain("The heel counter is rigid stiff, suede lined.");
    expect(text).toContain("The hardware is pin buckle in polished gold.");
    const empty = compileShoePrompt({ upperFamily: "pump", details: { counter: {} } }, reg);
    expect(empty).not.toContain("heel counter");
    expect(empty).not.toContain("hardware");
  });

  it("folds outsole material, style and finish into the outsole narrative", () => {
    const text = compileShoePrompt(
      {
        upperFamily: "pump",
        details: { construction: { outsoleMaterial: "leather", outsoleStyle: "diamond-pattern", outsoleFinish: "lacquered-glossy" } },
      },
      reg,
    );
    expect(text).toContain("The outsole is cut from leather, a diamond pattern tread, a lacquered glossy finish.");
  });

  it("compiles a pre-change sheet byte-identically", () => {
    // snapshot captured from the compiler before deep clauses were added
    const sheet: CompileSheet = {
      upperFamily: "mary-jane",
      details: {
        silhouette: { toeShape: "peep-toe", vampCoverage: "full-coverage", fastening: "mary-jane-strap" },
        upper: { primaryMaterial: "patent leather", upperPrimaryColor: "Jet Black" },
        heel: { type: "stiletto", heightStep: "shoes.heel_height:7", breastFinish: "baby pink", liftExternal: "polished gold", topPiece: { sizeStep: "general.width:2" } },
        platform: { heightStep: "shoes.platform_height:7", shape: "block", material: "patent leather", edgeProfile: "straight-vertical", toeSpringStep: "shoes.toe_spring:6" },
        outsole: { lacquerColor: "baby pink", lacquerGloss: "general.smoothness:8" },
        construction: { welt: { absent: true }, ornamentation: { absent: true }, insoleMaterial: "leather", outsoleMaterial: "leather" },
        adornments: [{ type: "satin-bow", placement: "vamp" }],
        sensory: { lightBehavior: "sharp, high-specular reflections", stepSound: "staccato tap" },
      },
    };
    const expected =
      "Product shot. 1:1 aspect. 3/4 shot. Light studio cyclorama.\n\n" +
      "A pair of towering jet-black patent leather mary janes with an extreme, sky-high stiletto heel and an extremely towering, colossal mega, block-shaped patent leather platform with an extremely steep toe spring.\n\n" +
      "The upper is constructed in Jet Black patent leather.\n\n" +
      "Fastened with a mary jane strap.\n\n" +
      "The polished gold stiletto heel is ultra-long and needle-thin, rising far above the platform height.\n\n" +
      "Adorned with satin-bow at the vamp.\n\n" +
      "The entire outsole and the inner heel breast are finished in a highly visible, polished, baby pink lacquer, serving as a clean high-contrast mechanical chassis signature.\n\n" +
      "No visible welt, stitching, or ornamentation — the silhouette is monolithic and sculptural.\n\n" +
      "The patent-leather surface produces sharp, high-specular reflections under studio lighting.";
    expect(compileShoePrompt(sheet, reg)).toBe(expected);
  });

  it("randomized deep-field combinations stay digit-free", () => {
    const families = ["pump", "sandal", "mule", "boot", "mary-jane"];
    const widthSteps = ["general.width:1", "general.width:4", "general.width:8", undefined];
    const straps = [undefined, [{ type: "ankle-strap" }], [{ type: "mary-jane", widthStep: "general.width:8", material: "patent leather", hardwareFinish: "polished gold", anchor: "ankle", closure: "single-buckle" }]];
    const wraps = [undefined, "monolithic-seamless-wrap", "butt-joint"];
    const edges = [undefined, "knife-edge", "scalloped"];
    const rigidities = [undefined, "rigid-stiff", "flexible"];
    const outsoleStyles = [undefined, "diamond-pattern", "lug"];
    let seed = 7;
    const rand = <T,>(arr: T[]): T => arr[(seed = (seed * 1103515245 + 12345) % 2 ** 31) % arr.length];
    for (let i = 0; i < 200; i++) {
      const details: ShoeDetails = {
        straps: rand(straps),
        transition: { wrap: rand(wraps), edge: rand(edges) },
        counter: { rigidity: rand(rigidities) },
        hardware: { type: "pin-buckle", finish: "polished-gold" },
        heel: { breastProfile: "concave", liftInternal: "steel-reinforced" },
        construction: { outsoleStyle: rand(outsoleStyles), outsoleFinish: "waxed" },
      };
      const text = compileShoePrompt({ upperFamily: rand(families), details }, reg);
      expect(containsDigits(text.slice(PREAMBLE.length))).toBe(false);
    }
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
