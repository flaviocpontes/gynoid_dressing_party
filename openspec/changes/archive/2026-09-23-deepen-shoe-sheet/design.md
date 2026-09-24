# Design: deepen-shoe-sheet

## Context

The details schema (`src/domain/shoe.ts`), field specs (`src/lib/field-specs.ts`), compiler (`src/domain/compile.ts`), lint (`src/domain/lint.ts`), and seeded vocabularies (`seed/vocabularies.json`, kebab-case `{value}` terms, prettified to prose at compile time) form a data-driven chain: schema → specs → editor/compiler/lint. The legacy KB file `templates/outfit_components/shoe_sheet_template.md` holds the deep taxonomy to harvest. Constraints: domain stays pure (zero I/O, vitest-covered), numbers never reach prompts, seed JSON regenerates via scripts, details live in a JSON column so most schema growth needs no migration.

## Goals / Non-Goals

**Goals:**
- Sheet can express straps, upper-platform transition, counter, hardware, outsole style, and the deep heel/construction detail, all sparse and compilable
- Applicability (N/A) as first-class domain data distinct from absent/unfilled
- Sheet kind (authored/imported) with assertive-import lint
- Vocabulary harvest that is reproducible (script, not hand edits) and reviewable (diffable output)

**Non-Goals:**
- VLM import pipeline, review surface, editor two-pane rework, real combobox widgets (separate changes)
- New ordinal scales — strap width reuses `general.width`; all magnitudes reuse existing scales
- Gallery/filter changes
- Touching existing sheets or stored snapshots (immutable by design)

## Decisions

### D1: Straps as a details array mirroring adornments
`details.straps: Array<{ type: FieldValue, widthStep?: string, material?: FieldValue, hardwareFinish?: FieldValue, anchor?: FieldValue, closure?: FieldValue, note?: string }>`. Same pattern as `adornments` — zod-validated array inside the existing details JSON, no migration. Leaf fields use `fieldValue` so choice-sets remain legal on authored sheets; `widthStep` is a scale-step id string like every other magnitude (satisfies the no-numbers rule structurally).
*Alternative*: typed columns in a straps table — rejected, details JSON is the established home for sub-entities and keeps the sheet one atomic document.

### D2: Applicability as a pure data table in domain code
`src/domain/applicability.ts` exports `APPLICABILITY: { paths: string[]; families: string[] }[]`-style data (family groups → N/A path prefixes) plus a lookup `isApplicable(family, path)`. Launch minimal: shaft gated to boot families (`boot`, `bootie`, `shootie` — same group lint rule 4 already uses). Straps deliberately NOT gated (Mary Janes, gladiators, and boots can all carry them).
*Alternative*: store in the registry DB alongside scales/vocabs — rejected: this is structural knowledge that changes with schema revisions, not content that grows; a code table is versioned with the schema it describes and stays under test. It follows the existing `ABSENCE_ALLOWED` precedent (rules as in-domain data).

### D3: Sheet kind as a shoes table column
`sheetKind TEXT NOT NULL DEFAULT 'authored'` via drizzle push; surfaces in create/update inputs (zod enum) and lint.
*Alternative*: a key inside details JSON — rejected: it is record-level provenance, not a describable detail; lint and the future import flow read it without parsing details.

### D4: Harvest via a one-time converter writing a separate seed file
New `scripts/harvest_legacy_vocabs.py` (pattern-matching the existing one-time converters) reads the legacy template, normalizes prose terms to kebab-case `{value}` entries, and writes `seed/vocabularies_deep.json`; `scripts/seed.ts` loads both files. Converter rules: split comma-separated legacy lines, strip parenthetical qualifiers into a `note` where the registry supports it (otherwise drop), lowercase/kebab-case, dedupe against existing vocabulary ids where a family already exists (e.g. `heel_type`) by emitting only missing terms.
*Alternative*: regenerate `seed/vocabularies.json` in place — rejected: keeps each seed file's provenance single-source and the new harvest diff reviewable in isolation.

### D5: Compiler clause emitters, fixed house order
New pure emitters in `compile.ts`: straps clause (rows in sheet order, width adjectives from `getStep` zone stacking like other magnitudes), transition clause (emitted adjacent to the platform clause), heel-clause extensions (breast finish/profile, lift finishes appended to the existing heel narrative), counter/hardware clauses (short factual sentences after construction detail), outsole style/finish folded into the existing outsole narrative. No reordering of existing clauses; every new clause emits only when filled. Final `replaceAll("-", " ")` prettification already covers new kebab terms.

### D6: Absence-vs-filled relation pairs as lint data
A small relation table in `lint.ts`: `{ absentPath, contradictsPathPrefix, message }[]` — first entry `silhouette.fastening` absent vs `straps` rows with a `closure` filled. Applicability violations iterate `APPLICABILITY`; assertiveness walks filled fields for choice-sets when `sheetKind === "imported"`. All warnings non-blocking (house rule).

### D7: Minimal editor exposure via a repeatable-group field kind
`FieldSpec` gains `kind: "group"` with child specs; `ShoeEditor` renders group rows with the existing crude widgets (vocab input+datalist, scale select) plus add/remove row buttons. Straps get this first; adornments stay as the textarea until the editor rework replaces both. Ugly is accepted — this change is about the domain; the form is a viewport onto it.

## Risks / Trade-offs

- [Harvested term quality: legacy lines are prose-y ("Concealed/invisible zipper") and normalization may mangle nuance] → converter keeps terms conservative (whole-clause kebab like `concealed-invisible-zipper`), output is diff-reviewed before seeding, and custom terms remain always-legal at the boundary.
- [~25 more fields make the already-criticized long form worse] → accepted deliberately; field-specs sections keep collapse defaults, and the editor-rework change is queued behind this one.
- [Applicability table too coarse for boundary families (shooties, peep-toe booties)] → start with only shaft↔boot-families; warnings are non-blocking and the table is trivially extensible data.
- [Compiler output changes for sheets that fill new fields — downstream generation comparisons shift] → snapshots are immutable and record exactly what was sent; behavior for existing sheets is bit-identical since new clauses emit only when new fields are filled.
- [Choice of kebab values for transition/wrap terms leaks into prose awkwardly] → covered by the existing prettifier; vitest fixtures assert readable output.

## Migration Plan

1. Run converter, review `seed/vocabularies_deep.json` diff.
2. `npm run db:migrate` (adds `sheet_kind` column with default; no data migration, existing rows become "authored").
3. `npm run db:seed` to load merged vocabularies.
4. Deploy is a local restart; rollback is reverting the commit — no destructive schema change.
