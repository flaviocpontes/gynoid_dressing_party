import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { lintShoe } from "@/domain/lint";
import { emptyRegistry } from "@/domain/registry";
import type { Registry, StepRec } from "@/domain/registry";

function registryFromSeed(): Registry {
  const reg = emptyRegistry();
  const seed = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../seed/scales.json"), "utf-8"),
  );
  for (const s of seed.scales) {
    const steps: StepRec[] = s.steps.map((st: Record<string, unknown>, i: number) => ({
      id: `${s.id}:${i + 1}`,
      scaleId: s.id,
      rank: i + 1,
      zone: st.zone as StepRec["zone"],
      phrases: st.phrases as string[],
      adjectives: (st.adjectives as string[]) ?? (st.phrases as string[]),
      nuance: (st.nuance as string) || null,
      anchors: (st.anchors as string[]) ?? [],
    }));
    for (const st of steps) reg.steps.set(st.id, st);
    reg.stepsByScale.set(s.id, steps);
  }
  return reg;
}

const reg = registryFromSeed();

describe("lint rules", () => {
  it("warns on kitten heel at sky-high height", () => {
    const w = lintShoe(
      { upperFamily: "pump", details: { heel: { type: "kitten", heightStep: "shoes.heel_height:6" } } },
      reg,
    );
    expect(w.some((x) => x.field === "heel.type" && x.message.includes("Kitten"))).toBe(true);
  });

  it("does not warn on kitten at low height", () => {
    const w = lintShoe(
      { upperFamily: "pump", details: { heel: { type: "kitten", heightStep: "shoes.heel_height:2" } } },
      reg,
    );
    expect(w.length).toBe(0);
  });

  it("warns on full-coverage vamp with peep toe", () => {
    const w = lintShoe(
      {
        upperFamily: "pump",
        details: { silhouette: { vampCoverage: "full-coverage", toeShape: "peep-toe" } },
      },
      reg,
    );
    expect(w.some((x) => x.field === "silhouette.toeShape")).toBe(true);
  });

  it("warns on ballet heel at low height", () => {
    const w = lintShoe(
      { upperFamily: "pump", details: { heel: { type: "ballet-heel", heightStep: "shoes.heel_height:1" } } },
      reg,
    );
    expect(w.some((x) => x.field === "heel.heightStep")).toBe(true);
  });

  it("warns on boot family without shaft height", () => {
    const w = lintShoe({ upperFamily: "boot", details: {} }, reg);
    expect(w.some((x) => x.field === "shaft.heightStep")).toBe(true);
  });

  it("warns on choice-set mixing wedge and stiletto", () => {
    const w = lintShoe(
      { upperFamily: "pump", details: { heel: { type: ["stiletto", "wedge"] } } },
      reg,
    );
    expect(w.some((x) => x.message.includes("wedge"))).toBe(true);
  });

  it("warns on digit-containing values", () => {
    const w = lintShoe(
      { upperFamily: "pump", details: { upper: { primaryMaterial: "4-inch heel leather" } } },
      reg,
    );
    expect(w.some((x) => x.message.includes("digits"))).toBe(true);
  });
});

describe("applicability lint", () => {
  it("warns when shaft is filled on a pump", () => {
    const w = lintShoe(
      { upperFamily: "pump", details: { shaft: { heightStep: "shoes.shaft_height:6" } } },
      reg,
    );
    expect(w.some((x) => x.field === "shaft.heightStep" && x.message.includes("does not apply"))).toBe(true);
  });

  it("stays silent when shaft is unfilled on a pump", () => {
    const w = lintShoe({ upperFamily: "pump", details: {} }, reg);
    expect(w.length).toBe(0);
  });

  it("keeps warning that boots want a shaft height", () => {
    const w = lintShoe({ upperFamily: "boot", details: {} }, reg);
    expect(w.some((x) => x.field === "shaft.heightStep" && x.message.includes("usually wants"))).toBe(true);
  });

  it("does not flag shaft on a boot (applicable)", () => {
    const w = lintShoe(
      { upperFamily: "boot", details: { shaft: { heightStep: "shoes.shaft_height:6" } } },
      reg,
    );
    expect(w.filter((x) => x.message.includes("does not apply"))).toHaveLength(0);
  });

  it("warns once per section, not per leaf", () => {
    const w = lintShoe(
      { upperFamily: "sandal", details: { shaft: { heightStep: "shoes.shaft_height:3", fit: "slim" } } },
      reg,
    );
    expect(w.filter((x) => x.message.includes("does not apply"))).toHaveLength(1);
  });
});

describe("absence-vs-filled lint", () => {
  it("warns when absent fastening contradicts a buckled strap", () => {
    const w = lintShoe(
      {
        upperFamily: "sandal",
        details: {
          silhouette: { fastening: { absent: true } },
          straps: [{ type: "ankle-strap", closure: "single-buckle" }],
        },
      },
      reg,
    );
    expect(w.some((x) => x.field === "straps" && x.message.includes("absent"))).toBe(true);
  });

  it("stays silent when straps carry no closure", () => {
    const w = lintShoe(
      {
        upperFamily: "sandal",
        details: { silhouette: { fastening: { absent: true } }, straps: [{ type: "ankle-strap" }] },
      },
      reg,
    );
    expect(w.length).toBe(0);
  });
});

describe("assertiveness lint (imported sheets)", () => {
  const choice = { heel: { type: ["stiletto", "wedge"] } };

  it("warns on unresolved choice-set in an imported sheet", () => {
    const w = lintShoe({ upperFamily: "pump", details: choice, sheetKind: "imported" }, reg);
    expect(w.some((x) => x.field === "heel.type" && x.message.includes("assertive"))).toBe(true);
  });

  it("stays silent for authored sheets with choice-sets", () => {
    const w = lintShoe({ upperFamily: "pump", details: choice, sheetKind: "authored" }, reg);
    expect(w.filter((x) => x.message.includes("assertive"))).toHaveLength(0);
  });

  it("warns on choice-sets inside strap rows too", () => {
    const w = lintShoe(
      {
        upperFamily: "sandal",
        details: { straps: [{ type: ["ankle-strap", "t-strap"] }] },
        sheetKind: "imported",
      },
      reg,
    );
    expect(w.some((x) => x.field === "straps.0.type")).toBe(true);
  });

  it("returns warnings instead of throwing", () => {
    expect(() =>
      lintShoe(
        {
          upperFamily: "pump",
          details: { heel: { type: ["stiletto", "wedge"] }, shaft: { fit: "slim" } },
          sheetKind: "imported",
        },
        reg,
      ),
    ).not.toThrow();
  });
});
