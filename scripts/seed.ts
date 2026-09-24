import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/db/db";
import { scales, scaleSteps, vocabularies, vocabularyTerms } from "../src/db/schema";

type ScaleSeed = {
  id: string;
  name: string;
  domain: string;
  derived_from: string | null;
  provenance: string | null;
  steps: {
    rank: number;
    zone: string;
    phrases: string[];
    adjectives?: string[];
    nuance: string;
    anchors: string[];
  }[];
};
type VocabSeed = {
  id: string;
  name: string;
  provenance: string | null;
  terms: { value: string }[];
};

function load<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "..", "seed", file), "utf-8"));
}

function main() {
  const db = getDb();
  const { scales: scaleList } = load<{ scales: ScaleSeed[] }>("scales.json");
  const { vocabularies: baseVocabs } = load<{ vocabularies: VocabSeed[] }>("vocabularies.json");
  // deep vocabularies ride alongside; dedupe by vocabulary id (first file wins)
  const { vocabularies: deepVocabs } = load<{ vocabularies: VocabSeed[] }>("vocabularies_deep.json");
  const seen = new Set(baseVocabs.map((v) => v.id));
  const vocabList = [...baseVocabs, ...deepVocabs.filter((v) => !seen.has(v.id))];

  db.transaction((tx) => {
    for (const s of scaleList) {
      tx.insert(scales)
        .values({
          id: s.id, name: s.name, domain: s.domain,
          derivedFrom: s.derived_from, provenance: s.provenance,
        })
        .onConflictDoUpdate({
          target: scales.id,
          set: { name: s.name, domain: s.domain, derivedFrom: s.derived_from, provenance: s.provenance },
        })
        .run();
      for (const st of s.steps) {
        const values = {
          id: `${s.id}:${st.rank}`,
          scaleId: s.id,
          rank: st.rank,
          zone: st.zone,
          phrases: JSON.stringify(st.phrases),
          adjectives: JSON.stringify(st.adjectives ?? st.phrases),
          nuance: st.nuance || null,
          anchors: JSON.stringify(st.anchors ?? []),
        };
        tx.insert(scaleSteps)
          .values(values)
          .onConflictDoUpdate({
            target: scaleSteps.id,
            set: {
              rank: st.rank, zone: st.zone,
              phrases: values.phrases,
              adjectives: values.adjectives,
              nuance: values.nuance,
              anchors: values.anchors,
            },
          })
          .run();
      }
    }
    for (const v of vocabList) {
      tx.insert(vocabularies)
        .values({ id: v.id, name: v.name, provenance: v.provenance })
        .onConflictDoUpdate({ target: vocabularies.id, set: { name: v.name, provenance: v.provenance } })
        .run();
      for (const t of v.terms) {
        tx.insert(vocabularyTerms)
          .values({ id: `${v.id}:${t.value}`, vocabId: v.id, value: t.value, custom: 0 })
          .onConflictDoUpdate({
            target: vocabularyTerms.id,
            set: { value: t.value, custom: 0 },
          })
          .run();
      }
    }
  });

  const count = (t: string) =>
    Number((db.$client as unknown as { prepare: (q: string) => { get: () => { n: number } } })
      .prepare(`select count(*) n from ${t}`)
      .get().n);
  console.log("seeded:", {
    scales: count("scales"),
    steps: count("scale_steps"),
    vocabs: count("vocabularies"),
    terms: count("vocabulary_terms"),
  });
}

main();
