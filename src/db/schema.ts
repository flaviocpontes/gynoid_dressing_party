import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const scales = sqliteTable("scales", {
  id: text("id").primaryKey(), // e.g. "general.height", "shoes.heel_height"
  name: text("name").notNull(),
  domain: text("domain").notNull(), // "general" | "shoes" | future domains
  derivedFrom: text("derived_from"), // parent scale id for domain derivations
  provenance: text("provenance"), // source note
});

export const scaleSteps = sqliteTable(
  "scale_steps",
  {
    id: text("id").primaryKey(), // "<scale_id>:<rank>"
    scaleId: text("scale_id")
      .notNull()
      .references(() => scales.id),
    rank: integer("rank").notNull(), // 1 = low extreme .. N = high extreme
    zone: text("zone").notNull(), // "low" | "neutral" | "high"
    phrases: text("phrases").notNull(), // JSON string[]
    adjectives: text("adjectives"), // JSON string[] - adjective forms for clause assembly
    nuance: text("nuance"),
    anchors: text("anchors"), // JSON string[] - display-only, never compiled
  },
  (t) => [index("scale_steps_scale_idx").on(t.scaleId, t.rank)],
);

export const vocabularies = sqliteTable("vocabularies", {
  id: text("id").primaryKey(), // e.g. "upper_family", "heel_type"
  name: text("name").notNull(),
  provenance: text("provenance"),
});

export const vocabularyTerms = sqliteTable(
  "vocabulary_terms",
  {
    id: text("id").primaryKey(), // "<vocab_id>:<value>"
    vocabId: text("vocab_id")
      .notNull()
      .references(() => vocabularies.id),
    value: text("value").notNull(),
    synonyms: text("synonyms"), // JSON string[]
    custom: integer("custom").notNull().default(0),
  },
  (t) => [index("vocab_terms_vocab_idx").on(t.vocabId)],
);

export const shoes = sqliteTable(
  "shoes",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    originCharacter: text("origin_character"),
    // promoted facet columns
    upperFamily: text("upper_family"),
    heelType: text("heel_type"),
    heelHeightStep: text("heel_height_step"), // scale step id
    platformHeightStep: text("platform_height_step"),
    outsoleLacquerName: text("outsole_lacquer_name"),
    styleFamily: text("style_family"), // JSON string[]
    appearanceTier: text("appearance_tier"),
    // full stratified sheet, validated by zod at the boundary
    details: text("details"), // JSON ShoeDetails
    notes: text("notes"),
    proseDescription: text("prose_description"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("shoes_slug_idx").on(t.slug),
    index("shoes_facet_idx").on(
      t.upperFamily,
      t.heelType,
      t.heelHeightStep,
      t.platformHeightStep,
      t.outsoleLacquerName,
      t.originCharacter,
    ),
  ],
);

export const shoeImages = sqliteTable(
  "shoe_images",
  {
    id: text("id").primaryKey(),
    shoeId: text("shoe_id")
      .notNull()
      .references(() => shoes.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(), // relative under data/images/
    kind: text("kind").notNull().default("product-shot"), // product-shot | detail | alternate
    passNumber: integer("pass_number").notNull().default(1),
    approved: integer("approved").notNull().default(0),
    overlay: text("overlay"), // JSON { resolved: {}, deviations: string[], defects: string[] }
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("shoe_images_shoe_idx").on(t.shoeId, t.approved)],
);

export const shoePrompts = sqliteTable(
  "shoe_prompts",
  {
    id: text("id").primaryKey(),
    shoeId: text("shoe_id")
      .notNull()
      .references(() => shoes.id, { onDelete: "cascade" }),
    text: text("text").notNull(), // verbatim snapshot
    createdAt: integer("created_at").notNull(),
    usedAt: integer("used_at"),
  },
  (t) => [index("shoe_prompts_shoe_idx").on(t.shoeId, t.createdAt)],
);
