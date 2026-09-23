# Design: shoe-editor-rework

## Context

`ShoeEditor.tsx` already receives the full registry as props (`vocabTerms`, `scales`) and holds the whole sheet in client state; `compileShoePrompt` and `lintShoe` are pure functions taking that registry as a value — so client-side live compile/lint is an import away, no new plumbing. Field-specs (`src/lib/field-specs.ts`) already drive the form data-driven; `deepen-shoe-sheet` (prerequisite) extends them with groups and the deep fields plus the applicability table. No component library is installed and none is needed at this scale. Tailwind 4 for styling, server actions + `useTransition` for persistence (existing pattern).

## Goals / Non-Goals

**Goals:**
- The field→clause feedback loop visible in one glance; zero round-trips for compile and lint
- Widgets that replace serialization syntax (pipes, `type | placement` lines) with structure
- The ~100-field sheet navigable: counts, search, applicability marking
- Thin UI per project convention: all real logic stays in domain (parity-tested)

**Non-Goals:**
- Autosave (explicit save + dirty indicator only; revisit separately if the save click annoys)
- Mobile layout polish (desktop single-user tool; panes stack on narrow viewports via simple responsive fallback)
- Editing the gallery, `/shoes/new` (already minimal), or the import wizard (`shoe-import-pipeline` owns its surfaces)
- Undo/redo history

## Decisions

### D1: Structured clauses as a domain API, not UI parsing
Refactor `compile.ts` so each clause emitter returns `{ sectionKey, fieldPaths, text }`; `compileShoePrompt` joins clause texts exactly as before; new `compileShoeClauses(sheet, reg): Clause[]` powers the preview pane. Parity is enforced by a vitest fixture asserting byte-identical prompts across a representative deep sheet. The editor never parses prompt text.
*Alternative*: regex/section splitting in the UI — rejected: fragile against compiler evolution and violates thin-UI.

### D2: One workspace component, panes as children
`/shoes/[slug]/page.tsx` keeps server-side data loading and passes registry + shoe as today. A new `EditorWorkspace` client component owns sheet state (the existing useState approach, lifted), renders left pane (sections, search, identity) and right pane (tabs: prompt | lint summary is inline in prompt pane | images | prose) — prompt tab default. `CompilerPanel` dissolves into the prompt tab (preview textarea keeps hand-edit; "Mark used" action unchanged). Dirty tracking = shallow compare of serialized state vs. loaded props.

### D3: Widgets — three small hand-rolled components, no dependencies
- `VocabCombo` (~120 lines): input + filtered listbox, arrow-key/enter navigation, "custom" badge for off-vocabulary values, chips mode for choice-set fields. Filtering is a pure helper (`filterTerms`) exported and unit-tested.
- `ScaleStepper` (~100 lines): segmented control of steps grouped by zone, selected step detail (phrases, anchors), emit-fragment preview from the clause emitters' building blocks (adjectives join) — reuses `getStep` output only.
- `GroupRows`: generic renderer over group specs (row of FieldSpec widgets, add/remove/move buttons). Straps and adornments both use it; the adornments textarea dies.
*Alternative*: add downshift/headlessui — rejected: three focused components are smaller than a dependency's surface, and no a11y edge cases beyond basics (aria-expanded, role=listbox, keyboard nav) that the hand-rolled versions handle directly.

### D4: Navigation wiring via field-path anchors
Every field renders with `id={`f-${path}`}`; clause/warning click and search selection scroll to the anchor, expand the containing `<details>` section, and flash a highlight (CSS class, timed removal). No routing, no state library — `scrollIntoView` + a transient set of highlighted paths.

### D5: Applicability and fill counts derived, not stored
Section fill counts compute from sheet state over field-specs (pure helper `sectionCounts(details, specs)` — unit-tested). N/A marking consumes `APPLICABILITY` from `deepen-shoe-sheet`'s domain module: applicable=false renders the section header with an N/A badge and skips field inputs. Changing upper family re-derives instantly (state, not persistence).

### D6: Registry payload stays a prop, memoized compile
`useMemo` over `[details]` for clauses and lint — pure functions on a ~100-field object are sub-millisecond; no debounce needed. Registry object identity is stable per page load.

### D7: Save flow unchanged
Same `updateShoeAction` FormData POST; adornments/straps now serialize from structured state (buildDetails loses its textarea-parsing branch). Result/status display moves into a workspace footer.

## Risks / Trade-offs

- [Clause refactor regresses prompt output] → parity fixtures run the full deep-sheet matrix in vitest; any wording change fails loudly.
- [Hand-rolled combobox a11y gaps] → keep semantics simple (combobox/listbox roles, full keyboard loop); single-user local tool, screen-reader perfection is not the bar — basics are.
- [Two-pane on small screens] → panes stack vertically below `lg:`; acceptable degradation, documented in the workspace.
- [State sprawl as widgets multiply] → single lifted state + path-based setters (existing `setPath` pattern) keeps it flat; no reducer/context unless it hurts.
- [Preview drift vs. server compile (registry version skew after deploy)] → snapshotting always snapshots the preview text verbatim (spec rule), so drift cannot corrupt artifacts; worst case is a stale preview until reload.

## Migration Plan

No schema or data migration — pure UI/domain-additive change. Deploy is a local restart. Rollback = revert commit. Prerequisite: `deepen-shoe-sheet` merged first (groups, deep fields, applicability).

## Open Questions

- Whether the right pane's default tab should be prompt or a combined prompt+lint split view — decide during implementation with one session of real editing; tab structure makes either a constant away.
- Emit-fragment preview inside `ScaleStepper`: reuse adjective-join only, or expose per-step fragment builders from `compile.ts` — pick whichever the D1 refactor lands on naturally; not architecturally binding.
