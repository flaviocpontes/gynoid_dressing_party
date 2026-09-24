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

/** Type-to-filter over vocabulary terms; every whitespace token must match (case-insensitive). */
export function filterTerms(terms: string[], query: string): string[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return terms;
  return terms.filter((t) => {
    const lower = t.toLowerCase();
    return tokens.every((tok) => lower.includes(tok));
  });
}

// ---- serialization (server -> client prop -> Registry) -----------------------

export type SerializedStep = Pick<StepRec, "id" | "rank" | "zone" | "phrases" | "adjectives" | "nuance" | "anchors">;

export type SerializedRegistry = {
  vocabTerms: Record<string, string[]>;
  scales: Record<string, SerializedStep[]>;
};

/** Rebuild a Registry from its serialized prop form (client-side compile/lint). */
export function registryFromSerialized(ser: SerializedRegistry): Registry {
  const reg = emptyRegistry();
  for (const [vocabId, terms] of Object.entries(ser.vocabTerms)) {
    reg.vocabTerms.set(vocabId, terms);
  }
  for (const [scaleId, steps] of Object.entries(ser.scales)) {
    const recs = steps.map((s) => ({ ...s, scaleId }));
    recs.forEach((r) => reg.steps.set(r.id, r));
    reg.stepsByScale.set(scaleId, recs);
  }
  return reg;
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
