import type { Db } from "../db/db";
import { scaleSteps, scales, vocabularyTerms, vocabularies } from "../db/schema";

export type StepRec = {
  id: string;
  scaleId: string;
  rank: number;
  zone: "low" | "neutral" | "high";
  phrases: string[];
  adjectives: string[];
  nuance: string | null;
  anchors: string[];
};

export type Registry = {
  steps: Map<string, StepRec>;
  stepsByScale: Map<string, StepRec[]>;
  vocabTerms: Map<string, string[]>;
};

export function emptyRegistry(): Registry {
  return { steps: new Map(), stepsByScale: new Map(), vocabTerms: new Map() };
}

export function loadRegistrySync(db: Db): Registry {
  const reg = emptyRegistry();
  const scaleRows = db.select().from(scales).all();
  const knownScales = new Set(scaleRows.map((s) => s.id));
  for (const row of db.select().from(scaleSteps).all()) {
    if (!knownScales.has(row.scaleId)) continue;
    const rec: StepRec = {
      id: row.id,
      scaleId: row.scaleId,
      rank: row.rank,
      zone: row.zone as StepRec["zone"],
      phrases: JSON.parse(row.phrases) as string[],
      adjectives: JSON.parse(row.adjectives ?? row.phrases) as string[],
      nuance: row.nuance,
      anchors: JSON.parse(row.anchors ?? "[]") as string[],
    };
    reg.steps.set(rec.id, rec);
    const list = reg.stepsByScale.get(rec.scaleId) ?? [];
    list.push(rec);
    reg.stepsByScale.set(rec.scaleId, list);
  }
  for (const list of reg.stepsByScale.values()) list.sort((a, b) => a.rank - b.rank);

  for (const v of db.select().from(vocabularies).all()) {
    reg.vocabTerms.set(v.id, []);
  }
  for (const t of db.select().from(vocabularyTerms).all()) {
    const list = reg.vocabTerms.get(t.vocabId) ?? [];
    list.push(t.value);
    reg.vocabTerms.set(t.vocabId, list);
  }
  return reg;
}

export function getStep(reg: Registry, stepId: string | undefined | null): StepRec | null {
  if (!stepId) return null;
  return reg.steps.get(stepId) ?? null;
}

export function getScaleSteps(reg: Registry, scaleId: string): StepRec[] {
  return reg.stepsByScale.get(scaleId) ?? [];
}

/** True when the step sits in the top zone of its scale (intensifier stacking). */
export function isTopZone(reg: Registry, stepId: string | undefined | null): boolean {
  const step = getStep(reg, stepId);
  if (!step) return false;
  const steps = getScaleSteps(reg, step.scaleId);
  if (steps.length === 0) return false;
  return step.rank === steps[steps.length - 1].rank;
}

export function isVocabTerm(reg: Registry, vocabId: string, value: string): boolean {
  return (reg.vocabTerms.get(vocabId) ?? []).includes(value);
}
