# Tasks: shoe-editor-rework

Prerequisite: `deepen-shoe-sheet` implemented (deep fields, group specs, applicability table, sheet kind).

## 1. Domain: structured clauses

- [ ] 1.1 Refactor `src/domain/compile.ts` clause emitters to return `{ sectionKey, fieldPaths, text }`; keep `compileShoePrompt` joining clause texts and add `compileShoeClauses(sheet, reg)`; verify with vitest parity fixtures that prompts over a representative deep sheet (straps, transition, hardware, all heel detail, extreme zones) are byte-identical to the previous output and that every clause carries its emitting field paths
- [ ] 1.2 Add pure helpers `sectionCounts(details, specs)` (filled/total per section) and `filterTerms(terms, query)` (case-insensitive contains, custom terms included); verify with vitest covering collapsed sections, empty sheets, and multi-word queries

## 2. Widgets

- [ ] 2.1 Build `VocabCombo` (input + filtered listbox, arrow/enter/escape keyboard loop, aria combobox semantics, custom-value badge, chip mode for choice-sets) in `src/app/shoes/[slug]/widgets/`; verify manually: filter a 244-term color list by typing, select by keyboard, add and re-offer a custom term, add/remove choice chips
- [ ] 2.2 Build `ScaleStepper` (zone-grouped segmented steps, selected-step phrases + anchors, emit-fragment preview, unfilled state, keyboard stepping); verify manually across heel height (extreme zones) and strap width: preview text matches what the compiled clause gains/loses
- [ ] 2.3 Build `GroupRows` (structured add/remove/reorder rows rendering child field specs with the proper widgets) and replace the adornments textarea; verify manually: compose a two-row strap + one adornment, reorder, observe clause order in preview

## 3. Workspace

- [ ] 3.1 Build `EditorWorkspace` two-pane layout (left sheet, right tabs: prompt / images / prose) with responsive stacking below `lg:`, field-path anchors (`f-<path>` ids) on every field, and section expand/flash highlight helpers; verify manually that both panes are visible on desktop and tabs do not navigate away
- [ ] 3.2 Wire the prompt tab: live preview via `useMemo` over `compileShoeClauses`, hand-edit retained, "Mark used" snapshotting verbatim (existing action); verify manually that an edit updates the preview with no button press and a snapshot equals the preview text
- [ ] 3.3 Wire clause provenance and live lint into the prompt pane: clauses grouped by section with source-field annotations, click-to-jump via anchors; `lintShoe` on every change with warning click-to-jump; verify manually that kitten + sky-high warns immediately and jumps correctly
- [ ] 3.4 Add field search (matches labels and paths, jump on select) and section fill counts from `sectionCounts`; verify manually: search "breast" jumps to heel breast fields, collapsed section headers show counts

## 4. Applicability, save flow, cleanup

- [ ] 4.1 Consume `APPLICABILITY` in the workspace: N/A sections render a not-applicable badge for the current upper family and skip inputs; verify manually that a pump sheet marks shaft N/A and a boot sheet offers it, switching family re-derives instantly
- [ ] 4.2 Rework save flow in the workspace footer: same `updateShoeAction`, structured serialization from state (textarea parsing branch deleted), dirty indicator via state/props compare, result display; verify manually: edit → dirty shows → save → indicator clears → reload preserves values
- [ ] 4.3 Delete the dissolved `CompilerPanel` and dead code paths (datalist field rendering, adornments textarea state); verify with `npm run build` that no references remain

## 5. Integration verification

- [ ] 5.1 Run `npm test` and `npm run build` green; manual end-to-end pass: open a deep shoe → live prompt/lint correct → edit every widget type (combo, chips, stepper, absent toggle, group rows, search, clause jump, N/A section) → save → snapshot → reload round-trip; confirm no pipe or serialization syntax is user-visible anywhere
