import fs from "node:fs";
import path from "node:path";
import { emptyRegistry, type Registry, type StepRec } from "../src/domain/registry";

/** Build a registry from the vendored seed data (no db needed in unit tests). */
export function registryFromSeed(): Registry {
  const r = emptyRegistry();
  const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../seed/scales.json"), "utf-8"));
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
    steps.forEach((st) => r.steps.set(st.id, st));
    r.stepsByScale.set(s.id, steps);
  }
  const vocab = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../seed/vocabularies.json"), "utf-8"));
  for (const v of vocab.vocabularies) {
    r.vocabTerms.set(v.id, v.terms.map((t: { value: string }) => t.value));
  }
  return r;
}
