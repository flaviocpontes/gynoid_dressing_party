import { describe, it, expect } from "vitest";
import {
  TEMPLATE_VERSION,
  VOCAB_CAP,
  buildPassPrompt,
  selectBattery,
  SECTION_PASS_KEYS,
} from "@/domain/import/battery";
import { registryFromSeed } from "./seed-registry";

const reg = registryFromSeed();

describe("selectBattery", () => {
  it("pump never gets a shaft pass", () => {
    const battery = selectBattery("pump");
    expect(battery).not.toContain("shaft");
    for (const k of battery) {
      expect(k).not.toMatch(/^shaft/);
    }
  });

  it("boot battery includes the shaft pass", () => {
    expect(selectBattery("boot")).toContain("shaft");
    expect(selectBattery("bootie")).toContain("shaft");
  });

  it("covers every ungated section for any family", () => {
    const pump = selectBattery("pump");
    expect(pump.length).toBe(SECTION_PASS_KEYS.length - 1); // only shaft gated today
  });
});

describe("buildPassPrompt", () => {
  it("stamps every prompt with TEMPLATE_VERSION", () => {
    for (const k of ["heel", "sensory", "family"] as const) {
      expect(buildPassPrompt(k, reg).templateVersion).toBe(TEMPLATE_VERSION);
    }
  });

  it("scale prompts list full step ids with anchors and request a step reference", () => {
    const { prompt } = buildPassPrompt("heel", reg);
    for (let i = 1; i <= 7; i++) expect(prompt).toContain(`shoes.heel_height:${i}`);
    // anchors present (seed carries cm/inch anchors on mid/high steps)
    const anchored = [...reg.stepsByScale.get("shoes.heel_height")!].flatMap((s) => s.anchors);
    expect(anchored.length).toBeGreaterThan(0);
    for (const a of anchored) expect(prompt).toContain(a);
    expect(prompt).toContain("Never answer with a number, measurement, or unit");
  });

  it("vocab listings respect the cap while staying open to custom terms", () => {
    const { prompt } = buildPassPrompt("heel", reg);
    const terms = reg.vocabTerms.get("heel_type")!;
    const listed = terms.filter((t) => prompt.includes(t));
    expect(listed.length).toBe(Math.min(terms.length, VOCAB_CAP));
    if (terms.length > VOCAB_CAP) {
      expect(prompt).not.toContain(terms[VOCAB_CAP]); // first unlisted term stays out
      expect(prompt).toContain("other kebab-case terms are allowed");
    }
  });

  it("family pass asks no section-detail questions and requests a single family value", () => {
    const { prompt } = buildPassPrompt("family", reg);
    expect(prompt).toContain('"upperFamily"');
    expect(prompt).toContain("one committed kebab-case family value");
    // no section detail paths or labels leak in
    expect(prompt).not.toContain("heel.type");
    expect(prompt).not.toContain("toeShape");
    expect(prompt).not.toContain("Toe shape");
    expect(prompt).not.toContain("primaryMaterial");
    // lists the family vocabulary
    for (const f of ["pump", "boot", "sandal", "mary-jane"]) expect(prompt).toContain(f);
    // boot-ness / sandal-ness signals
    expect(prompt).toContain("rises above the ankle");
    expect(prompt.toLowerCase()).toContain("sandal");
  });

  it("vibe prompt carries the intent and the family plus every section", () => {
    const { prompt } = buildPassPrompt("vibe", reg, { source: { kind: "intent", text: "a towering black patent pump" } });
    expect(prompt).toContain("a towering black patent pump");
    expect(prompt).toContain("upperFamily");
    expect(prompt).toContain("heel.type");
    expect(prompt).toContain("sensory.stepSound");
    expect(prompt).toContain("shaft.heightStep");
  });

  it("intent section prompts carry the intent and never mention a photograph", () => {
    const { prompt } = buildPassPrompt("heel", reg, { source: { kind: "intent", text: "a towering black patent pump" } });
    expect(prompt).toContain('"""a towering black patent pump"""');
    expect(prompt).not.toContain("photograph");
    expect(prompt).toContain("heel.type");
  });

  it("image section prompts read from the photograph", () => {
    expect(buildPassPrompt("heel", reg).prompt).toContain("of a shoe from its photograph");
  });

  it("intent family prompt carries the intent", () => {
    const { prompt } = buildPassPrompt("family", reg, { source: { kind: "intent", text: "thigh-high lace-up boot" } });
    expect(prompt).toContain("thigh-high lace-up boot");
    expect(prompt).not.toContain("photograph");
  });

  it("no step id is directly followed by a parenthetical", () => {
    for (const k of ["heel", "platform", "upper"] as const) {
      expect(buildPassPrompt(k, reg).prompt).not.toMatch(/:\d+ \(/);
    }
    expect(buildPassPrompt("heel", reg).prompt).toMatch(/shoes\.heel_height:7: .+ \[high zone\]/);
  });

  it("re-ask prompt names the candidates and only one field", () => {
    const { prompt } = buildPassPrompt("re-ask:silhouette.toeShape", reg, {
      candidates: ["pointed", "almond"],
    });
    expect(prompt).toContain("pointed, almond");
    expect(prompt).toContain("silhouette.toeShape");
    expect(prompt).not.toContain("heel.type");
  });
});
