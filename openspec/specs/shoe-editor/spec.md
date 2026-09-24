## Purpose

The shoe sheet editing workspace: a two-pane live loop where every field edit instantly shows its effect on the compiled prompt and lint, deep vocabularies and ordinal scales get purpose-built controls, repeatable structures are edited as structured rows, and the depth of the sheet is navigable through progressive disclosure.

## Requirements

### Requirement: Two-pane live workspace
The shoe editor SHALL present the sheet on the left and the live output (compiled prompt preview and lint warnings) on the right, both visible on a desktop viewport without scrolling between them. Images and prose SHALL be reachable as tabs within the same workspace without leaving the page. Saving SHALL remain an explicit action with a visible dirty indicator when unsaved changes exist.

#### Scenario: Sheet and prompt visible together
- **WHEN** the user opens a shoe editor page on a desktop viewport
- **THEN** the sheet pane and the prompt preview pane are both visible, and switching to the images tab does not navigate away

#### Scenario: Dirty indicator
- **WHEN** the user edits a field and has not saved
- **THEN** the save action shows an unsaved-changes indicator until saving succeeds

### Requirement: Live prompt preview from the canonical compiler
The prompt preview SHALL recompile on every sheet edit from the current unsaved state, client-side, using the same compiler that produces server snapshots. The preview SHALL remain hand-editable, and "Mark used" SHALL snapshot the current text verbatim as today. No compile action or page reload SHALL be required to see the effect of an edit.

#### Scenario: Edit reflects immediately
- **WHEN** the user changes heel type from stiletto to wedge in the sheet
- **THEN** the prompt preview's heel clause updates without any button press or save

#### Scenario: Snapshot parity
- **WHEN** the user marks the previewed prompt as used
- **THEN** the stored snapshot equals the preview text exactly, including any hand edits

### Requirement: Clause provenance in the preview
The prompt preview SHALL present the compiled prompt grouped into clauses, each annotated with the sheet section and fields that emitted it. Activating a clause SHALL navigate to (and highlight) its emitting field in the sheet pane.

#### Scenario: Clause jumps to its field
- **WHEN** the user clicks the heel clause in the preview
- **THEN** the sheet pane scrolls to the heel section with the emitting fields highlighted

#### Scenario: Clause identifies its source fields
- **WHEN** the platform clause contains contributions from platform height and toe spring
- **THEN** both fields are listed as the clause's sources

### Requirement: Live lint during editing
Lint warnings SHALL be recomputed and displayed as the sheet changes, without saving. Warnings SHALL reference their fields such that activating a warning navigates to the offending field.

#### Scenario: Contradiction appears while typing
- **WHEN** the user sets heel type "kitten" while heel height sits at the sky-high step
- **THEN** the warning appears in the output pane immediately, and clicking it scrolls to the heel height field

### Requirement: Vocabulary combobox
Vocabulary-backed fields SHALL use a combobox: type-to-filter over seeded and previously accepted custom terms, keyboard navigation (arrows and enter), free-text acceptance of a new custom term marked as custom in the picker thereafter.

#### Scenario: Filtering a large vocabulary
- **WHEN** the user types "metal" into a 244-term color field
- **THEN** the dropdown lists only terms containing "metal" and the user can select one with the keyboard

#### Scenario: Custom term accepted and remembered
- **WHEN** the user types a term not in the vocabulary and confirms it
- **THEN** the field stores it, the combobox offers it on later use, and it is marked as custom

### Requirement: Ordinal scale stepper with emit preview
Scale-backed fields SHALL use a stepper control showing the scale's ordered steps grouped by zone (low extreme, neutral, high extreme). For the selected step it SHALL display the step's prompt phrases and orientation anchors, plus a short preview of the clause fragment the step will emit.

#### Scenario: Stepping updates the emit preview
- **WHEN** the user steps heel height from mid to the top-zone step
- **THEN** the control shows the new step's zone, phrases, anchors, and the intensified clause fragment it will emit

#### Scenario: Unfilled state is clear
- **WHEN** no step is selected
- **THEN** the stepper shows an unfilled state and the emit preview states that no clause will be emitted

### Requirement: Value-state controls
Choice-set fields SHALL be edited as chips: alternatives added and removed individually, never typed as delimited strings. Where a field defines an explicit-absence clause, the field SHALL offer a value/absent toggle whose absent state shows the absence clause that will be emitted.

#### Scenario: Building a choice-set with chips
- **WHEN** the user adds "suede" and "patent leather" as alternatives on primary material
- **THEN** both render as removable chips and the preview shows them joined as alternatives

#### Scenario: Absent toggle previews the absence clause
- **WHEN** the user toggles fastening to absent
- **THEN** the control displays the absence clause that will appear in the prompt and the field's value input is disabled

### Requirement: Repeatable group editor
Repeatable sub-entities (straps, adornments) SHALL be edited as structured rows: each row exposes proper widgets for its fields (comboboxes, steppers, text inputs as the specs define), and rows can be added, removed, and reordered. Serialization syntax SHALL NOT be user-visible.

#### Scenario: Composing a strap row with widgets
- **WHEN** the user adds a strap row and fills type via combobox, width via stepper, and closure via combobox
- **THEN** the row stores all three as structured fields and the prompt preview emits the strap clause accordingly

#### Scenario: Reordering rows
- **WHEN** the user moves a strap row from first to second
- **THEN** the compiled strap clause lists the rows in the new order

### Requirement: Progressive disclosure over the deep sheet
Section headers SHALL display filled-field counts. The editor SHALL provide field search that matches labels and paths and jumps to the field. Sections that cannot apply to the shoe's upper family SHALL be marked not-applicable and SHALL NOT offer input.

#### Scenario: Fill count on a collapsed section
- **WHEN** the Heel section has 4 of its 8 fields filled and is collapsed
- **THEN** its header shows the count and a filled indicator

#### Scenario: Search jumps to a field
- **WHEN** the user searches "breast" in the field search
- **THEN** matching fields (heel breast finish, heel breast profile) are offered and selecting one scrolls to and expands the containing section

#### Scenario: Inapplicable section not editable
- **WHEN** the shoe's upper family is pump and the shaft section does not apply to pumps
- **THEN** the shaft section is marked not applicable for pumps and its fields accept no input
