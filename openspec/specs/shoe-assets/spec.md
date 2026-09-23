## Purpose

Shoe asset studio: the first asset capability of the gynoid dressing-party app. It gives shoe assets a structured, stratified sheet with ordinal-scale magnitudes and controlled vocabularies, compiles generation prompts sparsely from filled fields, and manages image and prose artifacts — all browsable through a faceted gallery.

## Requirements

### Requirement: Shoe asset records with stratified sheet
The system SHALL store shoe assets composed of a required identity section (unique slug, display name; optional origin character, style families, occasions, gallery tags, notes) and optional detail sections: silhouette (upper family, toe shape, vamp coverage, toe box, throat, quarters, topline, fastening), upper construction and colorway, platform, heel, shaft (boot-conditional), adornments with placements, construction detail, and sensory notes. Only slug and display name SHALL be required.

#### Scenario: Minimal shoe creation
- **WHEN** the user creates a shoe supplying only slug and display name
- **THEN** the system saves the record with every detail section unfilled

#### Scenario: Archetype split into upper family and architecture
- **WHEN** the user records a shoe described as "loafer pumps"
- **THEN** the sheet stores upper family "loafer" while heel and platform sections carry the architecture, and no single conflated "archetype" value is required

### Requirement: Magnitude fields as ordinal scale steps
All magnitude characteristics (heel height, platform height, heel pitch, toe spring, platform presence, shaft height, top-piece size, lacquer gloss, adornment density) SHALL be expressed as a step on a registered ordinal scale rather than a number. Scale steps SHALL carry prompt phrases; the UI MAY display human-orientation anchors (approximate measurements) for a selected step.

#### Scenario: Selecting a heel height step
- **WHEN** the user sets heel height to the "sky-high" step of the heel-height scale
- **THEN** the sheet stores the scale step reference and the UI shows that step's anchor annotation for orientation

#### Scenario: Numbers excluded from compilation
- **WHEN** a prompt is compiled from a sheet whose selected steps carry numeric anchors
- **THEN** the compiled prompt contains the steps' phrases and contains no numeric measurements

### Requirement: Scale registry
The system SHALL hold a scale registry seeded from the dimension-guides library: general scales (size, height, width, length, openness, prominence, smoothness, intensity, volume, magnitude, weight, temperature, distance, agreeableness, thickness) and shoe-domain scales derived from them (heel height, platform height, pitch, toe spring, shaft height). Each step SHALL record rank, zone (low extreme, neutral, high extreme), phrase list, and nuance text. Registry content SHALL be inspectable in the UI.

#### Scenario: Seed loads derived scale
- **WHEN** the app is initialized from seed data
- **THEN** the shoe heel-height scale exists with ordered steps from "flats" through "extreme/ballet", each carrying at least one phrase

#### Scenario: Shared general scale reuse
- **WHEN** a field references a general scale such as smoothness for lacquer gloss
- **THEN** it uses the same registry entry as any other field referencing smoothness, without a duplicate scale

### Requirement: Controlled vocabularies with custom values
Enum-style fields (upper family, toe shape, vamp coverage, fastening, heel type, materials, colors, hardware finishes, embellishments, occasions, and construction-detail terms) SHALL be backed by vocabularies seeded from the existing shoe taxonomy and corpus. The user SHALL be able to enter a custom term not present in a vocabulary; accepted custom terms SHALL behave like seeded terms in pickers and compilation.

#### Scenario: Custom material accepted
- **WHEN** the user types "spectator patent leather" as primary material and confirms the custom value
- **THEN** the record stores it and the material picker offers it thereafter

### Requirement: Field value states
Every detail field SHALL support four value states: unfilled, single value, disjunctive choice-set (two or more alternatives), and explicit absence (where the taxonomy defines an absence clause). Unfilled fields SHALL be omitted from compiled prompts. Choice-sets SHALL compile as alternatives joined naturally ("or"). Explicit absence SHALL compile as an absence clause naming what is deliberately absent.

#### Scenario: Disjunctive heel type
- **WHEN** heel type is set to the choice-set {stiletto, wedge}
- **THEN** the compiled prompt's heel clause reads "stiletto ... or wedge" alternatives

#### Scenario: Explicit absence of welt
- **WHEN** welt is set to explicit-absence
- **THEN** the compiled prompt includes a clause stating no visible welt, stitching, or ornamentation

#### Scenario: Unfilled section omitted
- **WHEN** adornments are entirely unfilled
- **THEN** the compiled prompt contains no adornment clause

### Requirement: Sparse prompt compilation
The system SHALL compile a generation prompt from filled fields only, following the house formula: product-shot preamble (aspect, angle, cyclorama), opening sentence assembled from magnitude phrases and upper family, upper narrative (materials, colors, construction), platform clause, heel clause, shaft clause, adornment clause, outsole-lacquer contrast clause, and silhouette closer. When outsole lacquer is specified, the contrast clause SHALL be emitted as the house signature. Steps in the extreme zones of a scale SHALL emit their stacked intensifier phrases.

#### Scenario: Minimal sheet compiles minimal prompt
- **WHEN** only identity, upper family, heel type, heel height, and platform height are filled
- **THEN** the compiled prompt consists of the preamble, opening sentence, heel clause, and platform clause, with no other narrative clauses

#### Scenario: Outsole signature always compiled
- **WHEN** outsole lacquer is filled with color and gloss step
- **THEN** the compiled prompt contains the high-contrast mechanical-signature clause referencing that lacquer

#### Scenario: Extreme-zone intensifier stacking
- **WHEN** platform height is set to the top zone of its scale
- **THEN** the platform clause uses the step's stacked phrases (multiple intensifying terms)

### Requirement: Prompt snapshots
The system SHALL snapshot a compiled or hand-edited prompt verbatim when it is marked as used for generation. Subsequent edits to the sheet or compiler SHALL NOT alter stored snapshots.

#### Scenario: Snapshot immutability
- **WHEN** a prompt snapshot exists and the user later edits the sheet
- **THEN** the stored snapshot text remains unchanged and the compiler produces a fresh prompt on demand

### Requirement: Image artifacts and rendered overlay
The user SHALL attach multiple images to a shoe, each with kind (product shot, detail, alternate), pass number, and approval flag. Exactly one approved product shot SHALL serve as the gallery card. Each image SHALL carry an optional rendered overlay: resolved field values, deviation notes versus the sheet, and defect observations, entered manually in this capability.

#### Scenario: Approval sets the gallery card
- **WHEN** the user approves a product-shot image for a shoe with no other approved shot
- **THEN** the gallery displays that image as the shoe's card

#### Scenario: Overlay records a resolved disjunction
- **WHEN** the sheet's heel type was the choice-set {stiletto, wedge} and the user records "stiletto" as the rendered value on an image
- **THEN** the image's overlay stores the resolved value and the sheet's choice-set remains unchanged

### Requirement: Canonical prose description
Each shoe SHALL have exactly one canonical prose description, editable as free text, stored verbatim.

#### Scenario: Description edit
- **WHEN** the user edits the prose description and saves
- **THEN** the new text replaces the old and is displayed wherever the shoe's description is shown

### Requirement: Faceted gallery
The gallery SHALL present shoes as a card grid using approved images, filterable by upper family, heel type, heel height zone, platform height zone, outsole lacquer color, style family, and origin character, and searchable by display name and slug.

#### Scenario: Filter by heel height zone
- **WHEN** the user filters the gallery to the top heel-height zone
- **THEN** only shoes whose heel height step lies in that zone are listed

#### Scenario: Search by name
- **WHEN** the user searches "mary jane"
- **THEN** shoes whose display name or slug matches are listed

### Requirement: Contradiction lint
The system SHALL detect contradictions between filled fields (for example heel type "kitten" with heel height at a sky-high step, or closed vamp coverage with a peep-toe shape) and display warnings. Warnings SHALL NOT block saving or compilation.

#### Scenario: Kitten heel at sky-high warns
- **WHEN** the sheet has heel type "kitten" and heel height at the "sky-high" step
- **THEN** the editor displays a contradiction warning and the sheet still saves and compiles
