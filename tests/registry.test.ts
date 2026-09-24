import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { emptyRegistry, getStep, isTopZone, getScaleSteps } from "@/domain/registry";
import type { StepRec } from "@/domain/registry";

// Build a registry straight from the committed seed JSON (no DB needed in unit tests).
function registryFromSeed(): ReturnType<typeof emptyRegistry> {
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
      nuance: (st.nuance as string) || null,
      anchors: (st.anchors as string[]) ?? [],
    }));
    for (const st of steps) reg.steps.set(st.id, st);
    reg.stepsByScale.set(s.id, steps);
  }
  return reg;
}

describe("registry helpers", () => {
  const reg = registryFromSeed();

  it("resolves steps by id", () => {
    const step = getStep(reg, "shoes.heel_height:6");
    expect(step).not.toBeNull();
    expect(step!.phrases).toContain("Sky-High Heel");
    expect(step!.anchors.length).toBeGreaterThan(0); // anchors present, display-only
  });

  it("returns null for unknown step ids", () => {
    expect(getStep(reg, "nope:1")).toBeNull();
    expect(getStep(reg, null)).toBeNull();
  });

  it("orders scale steps by rank", () => {
    const steps = getScaleSteps(reg, "shoes.heel_height");
    expect(steps.map((s) => s.rank)).toEqual([...steps.keys()].map((i) => i + 1));
    expect(steps[0].phrases).toContain("Flats");
  });

  it("flags top zone for stacking", () => {
    expect(isTopZone(reg, "shoes.platform_height:7")).toBe(true);
    expect(isTopZone(reg, "shoes.platform_height:4")).toBe(false);
  });

  it("has all required shoe scales", () => {
    for (const id of [
      "shoes.heel_height",
      "shoes.platform_height",
      "shoes.pitch",
      "shoes.toe_spring",
      "shoes.shaft_height",
    ]) {
      expect(getScaleSteps(reg, id).length).toBeGreaterThan(0);
    }
  });
});
