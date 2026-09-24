import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { compileShoeClauses, compileShoePrompt, containsDigits, PREAMBLE } from "@/domain/compile";
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

// Representative deep sheet: straps, transition, hardware, every heel detail
// (breast finish/profile, both lifts, top piece), extreme zones, shaft,
// counter, adornments, sensory, absence, outsole detail. Expected output was
// captured byte-for-byte from the compiler before the structured-clause
// refactor (task 1.1 parity fixture).
const deepSheet: CompileSheet = {
  upperFamily: "boot",
  details: {
    silhouette: { toeShape: "peep-toe", vampCoverage: "partial-coverage", fastening: "mary-jane-strap" },
    upper: {
      primaryMaterial: "patent leather",
      secondaryMaterial: "metallic lambskin",
      upperPrimaryColor: "Jet Black",
      lining: { material: "kidskin leather" },
    },
    heel: {
      type: "stiletto",
      heightStep: "shoes.heel_height:7",
      pitchStep: "shoes.pitch:6",
      breastFinish: "crimson red",
      breastProfile: "concave",
      liftExternal: "polished gold",
      liftInternal: "steel-reinforced",
      topPiece: { material: "polyurethane", sizeStep: "general.width:2", shape: "rounded-rectangle" },
    },
    platform: {
      heightStep: "shoes.platform_height:7",
      shape: "block",
      material: "patent leather",
      toeSpringStep: "shoes.toe_spring:6",
    },
    shaft: { heightStep: "shoes.shaft_height:6", fit: "skin-tight", material: "stretch velvet" },
    transition: { wrap: "monolithic-seamless-wrap", edge: "knife-edge" },
    counter: { rigidity: "rigid-stiff", grip: "suede-lined" },
    hardware: { type: "pin-buckle", finish: "polished-gold" },
    straps: [
      { type: "mary-jane", widthStep: "general.width:8", material: "patent leather", hardwareFinish: "polished gold", anchor: "instep", closure: "single-buckle" },
      { type: "ankle-strap", widthStep: "general.width:1", anchor: "ankle", closure: "buckle" },
    ],
    adornments: [
      { type: "satin-bow", placement: "vamp" },
      { type: "crystal-heart-buckle", placement: "back-collar" },
    ],
    construction: {
      welt: { absent: true },
      ornamentation: { absent: true },
      outsoleMaterial: "leather",
      outsoleStyle: "diamond-pattern",
      outsoleFinish: "lacquered-glossy",
    },
    outsole: { lacquerColor: "metallic gold", lacquerGloss: "general.smoothness:9" },
    sensory: { lightBehavior: "sharp, high-specular reflections", stepSound: "staccato tap" },
  },
};

const expectedPrompt =
  "Product shot. 1:1 aspect. 3/4 shot. Light studio cyclorama.\n\n" +
  "A pair of towering jet-black patent leather boots with an extreme, sky-high stiletto heel and an extremely towering, colossal mega, block-shaped patent leather platform with an extremely steep toe spring.\n\n" +
  "The upper is constructed in Jet Black patent leather. Accent panels in metallic-lambskin.\n\n" +
  "Strapped with an expansive, sprawling mary jane in patent leather anchored at the instep closing with a polished gold single buckle; and a hairline, razor-thin ankle strap anchored at the ankle closing with a buckle.\n\n" +
  "The upper meets the platform in a monolithic seamless wrap, finished with a knife edge transition.\n\n" +
  "Fastened with a mary jane strap.\n\n" +
  "The polished gold stiletto heel is ultra-long and needle-thin, rising far above the platform height.\n\n" +
  "The heel breast is crimson red, concave in profile. The heel lift is polished gold on the outside, steel reinforced within.\n\n" +
  "The shaft rises to thigh-high height, skin-tight in fit.\n\n" +
  "The heel counter is rigid stiff, suede lined.\n\n" +
  "The hardware is pin buckle in polished gold.\n\n" +
  "Adorned with satin-bow at the vamp or crystal-heart-buckle at the back-collar.\n\n" +
  "The outsole is cut from leather, a diamond pattern tread, a lacquered glossy finish.\n\n" +
  "The entire outsole and the inner heel breast are finished in a highly visible, glassy, metallic gold lacquer, with the heel's inner line accentuated in crimson-red, serving as a clean high-contrast mechanical chassis signature.\n\n" +
  "No visible welt, stitching, or ornamentation — the silhouette is monolithic and sculptural.\n\n" +
  "The patent-leather surface produces sharp, high-specular reflections under studio lighting.";

describe("compileShoeClauses: parity and provenance", () => {
  it("deep sheet compiles byte-identically to the pre-refactor compiler", () => {
    expect(compileShoePrompt(deepSheet, reg)).toBe(expectedPrompt);
  });

  it("clauses join to exactly compileShoePrompt output", () => {
    const clauses = compileShoeClauses(deepSheet, reg);
    expect(clauses.map((c) => c.text).join("\n\n")).toBe(compileShoePrompt(deepSheet, reg));
    expect(clauses[0]).toEqual({ sectionKey: "preamble", fieldPaths: [], text: PREAMBLE });
  });

  it("every non-preamble clause carries its emitting field paths", () => {
    const clauses = compileShoeClauses(deepSheet, reg);
    for (const c of clauses.slice(1)) {
      expect(c.fieldPaths.length, `clause "${c.text.slice(0, 40)}…" has no fieldPaths`).toBeGreaterThan(0);
    }
    expect(clauses.map((c) => c.sectionKey)).toEqual([
      "preamble",
      "identity",
      "upper",
      "straps",
      "transition",
      "silhouette",
      "heel",
      "heel",
      "shaft",
      "counter",
      "hardware",
      "adornments",
      "construction",
      "outsole",
      "construction",
      "sensory",
    ]);
  });

  it("identity clause lists every contributing field, including upperFamily and toe spring", () => {
    const opening = compileShoeClauses(deepSheet, reg).find((c) => c.sectionKey === "identity")!;
    expect(opening.fieldPaths).toEqual([
      "heel.heightStep",
      "platform.heightStep",
      "upper.upperPrimaryColor",
      "upper.primaryMaterial",
      "upperFamily",
      "heel.type",
      "platform.shape",
      "platform.material",
      "platform.toeSpringStep",
    ]);
  });

  it("strap clause provenance names each row's contributing fields with row indexes", () => {
    const straps = compileShoeClauses(deepSheet, reg).find((c) => c.sectionKey === "straps")!;
    expect(straps.fieldPaths).toEqual([
      "straps.0.type",
      "straps.0.widthStep",
      "straps.0.material",
      "straps.0.anchor",
      "straps.0.closure",
      "straps.0.hardwareFinish",
      "straps.1.type",
      "straps.1.widthStep",
      "straps.1.anchor",
      "straps.1.closure",
    ]);
  });

  it("heel detail clause carries all four heel-detail fields; signature clause carries lacquer, gloss and breast", () => {
    const clauses = compileShoeClauses(deepSheet, reg);
    const heelDetail = clauses.find((c) => c.text.startsWith("The heel breast"))!;
    expect(heelDetail.fieldPaths).toEqual([
      "heel.breastFinish",
      "heel.breastProfile",
      "heel.liftExternal",
      "heel.liftInternal",
    ]);
    const signature = clauses.find((c) => c.sectionKey === "outsole")!;
    expect(signature.fieldPaths).toEqual(["outsole.lacquerColor", "outsole.lacquerGloss", "heel.breastFinish"]);
  });

  it("absence clause provenance names the absent-marked fields", () => {
    const absence = compileShoeClauses(deepSheet, reg).find((c) => c.text.startsWith("No visible welt"))!;
    expect(absence.fieldPaths).toEqual(["construction.welt", "construction.ornamentation"]);
  });

  it("minimal sheet: prompt-only clauses still join correctly and stay digit-free", () => {
    const sheet: CompileSheet = { upperFamily: "mule", details: {} };
    const clauses = compileShoeClauses(sheet, reg);
    expect(clauses.map((c) => c.text).join("\n\n")).toBe(PREAMBLE + "\n\nA pair of mules.");
    expect(containsDigits(clauses.map((c) => c.text).join("\n\n").slice(PREAMBLE.length))).toBe(false);
  });

  it("sparse contributions drop out of provenance (type-only heel)", () => {
    const sheet: CompileSheet = {
      upperFamily: "pump",
      details: { heel: { type: "stiletto" } as ShoeDetails["heel"] },
    };
    const opening = compileShoeClauses(sheet, reg).find((c) => c.sectionKey === "identity")!;
    expect(opening.text).toBe("A pair of pumps with a stiletto heel.");
    expect(opening.fieldPaths).toEqual(["upperFamily", "heel.type"]);
  });
});
