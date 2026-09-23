# Proposal: shoe-editor-rework

## Why

The editor is where every shoe-making path converges (hand-authoring, tweaking, reviewing imports), and it currently fights the user at every step: one long vertical scroll where the sheet and its compiled prompt never meet, compilation and lint behind server round-trips and page reloads, vocabularies of up to 244 terms browsed through a native `<datalist>`, choice-sets typed as `alt1 | alt2` pipe syntax, and adornments/straps edited as raw serialized text. The deepened sheet (~100 fields) makes this layout untenable: the mapping *field in → clause out* is the product's core value and the UI never shows it.

## What Changes

- **Two-pane workspace** on `/shoes/[slug]`: sheet editor on the left, live output on the right (compiled prompt + lint warnings), both visible without scrolling; images and prose move to tabs in the same workspace.
- **Live prompt preview**: compilation runs client-side from the current (unsaved) sheet state using the same canonical compiler — no Compile button, no round-trip; the preview updates on every edit and hand-edits remain possible before snapshotting.
- **Live lint**: contradiction warnings render as fields change, not after save-and-reload.
- **Clause provenance**: the preview groups compiled clauses by their emitting section and links each clause back to its fields (click a clause, jump to the field); powered by a new structured-clause domain API alongside the existing compiler.
- **Real widgets, no new dependencies**: type-to-filter combobox for vocabularies (keyboard navigable, custom terms accepted and badged), zone-annotated stepper for ordinal scales showing the selected step's phrases, anchors, and a "will emit" preview, chip editor for choice-sets (no pipe syntax), tri-state explicit-absence control where absence is legal.
- **Structured repeatable groups**: straps and adornments as add/remove/reorder rows with proper per-field widgets, replacing the raw textareas.
- **Progressive disclosure**: per-section fill counts, field search with jump-to-field, and applicability-aware display (sections that cannot apply to the shoe's family are marked N/A and not offered for input).
- **Explicit save with dirty indicator** (no autosave in this change).

## Capabilities

### New Capabilities

- `shoe-editor`: the sheet editing workspace — live compile/lint feedback loop, clause-to-field provenance, vocabulary/scale/value-state widgets, repeatable groups, and progressive disclosure over the deep sheet.

### Modified Capabilities

(none — the compiler's prompt output is unchanged; the structured-clause API is additive domain surface consumed by the editor. Sheet kind, applicability, straps, and lint classes come from `deepen-shoe-sheet`.)

## Impact

- `src/domain/compile.ts` — additive refactor: clause emitters shared by the existing `compileShoePrompt` and a new structured `compileShoeClauses` (byte-identical prompt output, parity-tested)
- `src/app/shoes/[slug]/` — the bulk of the change: `ShoeEditor` becomes the two-pane workspace; new widget components beside it (project convention); `CompilerPanel` collapses into the live preview pane; `ImagesPanel`/`ProseEditor` become tabs
- `src/lib/field-specs.ts` — gains search indexing metadata (paths/labels) and group specs; widgets driven by the same specs
- No new npm dependencies (combobox, chips, stepper hand-rolled; ~3 small components)
- Prerequisite: `deepen-shoe-sheet` implemented first (deep fields, straps groups, applicability table, sheet kind); independent of `shoe-import-pipeline`
