# Proposal: deepen-shoe-sheet

## Why

The sheet is the foundation every downstream capability stands on (VLM import pipeline, editor rework, multi-model generation), and it is currently too shallow: ~40 fields, several of them free text, no straps architecture, no upper-platform transition, no outsole styles, no counter or hardware sections. The legacy knowledge base holds a validated deep shoe taxonomy (a 445-line sheet template with controlled term families for throat profiles, welt visibility, heel-breast profiles, counter rigidity, hardware types, and more) that this app's vocabularies descend from but only partially port. Deepening the sheet now — before the import pipeline and editor rework are built on top of it — avoids building those twice.

## What Changes

- **Harvest legacy taxonomies into vocabularies**: throat, quarter style, topline finish, toe box structure, heel seat, heel breast finish, heel breast profile, welt type, welt visibility, outsole style, outsole finish, insole cushioning, counter rigidity, counter grip, hardware type. Harvest is script-driven from the legacy template file (vendored seed JSON is never hand-edited).
- **New schema depth**: counter section (rigidity, grip/lining); hardware fields (type, finish placement); heel breast profile; lift internal material; welt visibility; outsole style and finish; insole cushioning level; expose already-modeled top-piece shape and acoustic fields. Free-text fields gaining vocabularies keep accepting custom terms as today.
- **Straps as a first-class repeatable sub-entity**: `straps[]` with type, width (ordinal scale step, general.width), material, hardware finish, anchor, closure, and note — modeled like the existing adornments array.
- **Upper–platform transition fields**: wrap relationship and edge treatment describing how the upper meets the platform.
- **Applicability model**: a domain table mapping upper family to applicable sections/sub-entities (e.g. pumps have no shaft or straps), distinguishing **N/A** (never applicable) from **absent** (confirmed not present) from **unfilled**. Drives lint now; will later drive the VLM interrogation battery and the editor's progressive disclosure.
- **Sheet kind**: shoes record whether their sheet is `authored` or `imported`. Imported sheets must be assertive — lint warns on unresolved choice-sets — because they describe a real, existing shoe. Authored sheets keep choice-sets as a creative tool.
- **Compiler growth**: emit clauses for newly fillable structures (straps, transition, hardware, counter, outsole style, heel breast profile) following the house formula; sparse behavior unchanged — new clauses appear only when the new fields are filled.
- **Lint growth**: absence-vs-filled contradictions (e.g. fastening absent + strap rows present), applicability violations (shaft filled on a pump), assertiveness warnings for imported sheets, and extension of existing contradiction classes to the new fields.
- **Editor: minimal exposure only** — new fields appear in the existing form (simple repeatable rows for straps); the full editor/UX rework is a separate change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shoe-assets`: sheet structure requirement gains the new sections, fields, and the straps sub-entity; vocabulary requirement gains the harvested term families; compilation requirement gains clause sources for the new structures; lint requirement gains contradiction classes and applicability/assertiveness rules; new requirements for the applicability model and sheet kind.

## Impact

- `src/domain/shoe.ts` — details schema: new sections, straps array, sheet kind on the create/update inputs
- `src/domain/applicability.ts` — new pure module (family → applicable paths), vitest-covered
- `src/domain/registry.ts`, `seed/vocabularies.json` — harvested vocabularies, loaded via a new one-time converter script in `scripts/`
- `src/domain/compile.ts` — clause emitters for new fields; extreme-zone stacking reused for strap width
- `src/domain/lint.ts` — new contradiction classes, applicability + assertiveness warnings
- `src/lib/field-specs.ts`, `src/app/shoes/[slug]/*` — expose new fields with existing widget patterns (minimal)
- `src/db/schema.ts` — sheet kind column on shoes (drizzle push)
- `tests/` — new and extended vitest suites for all domain changes
- No breaking changes: all new fields are optional, existing sheets stay valid, stored snapshots are immutable by design, and the compiler only adds clauses for newly filled fields.
