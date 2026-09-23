## ADDED Requirements

### Requirement: Applicability model
The system SHALL maintain an applicability table mapping upper family (or family groups) to sheet paths that cannot apply to that family. Not-applicable (N/A) SHALL be distinct from explicit absence (a feature the family could have but this shoe does not) and from unfilled (not yet described). The lint SHALL warn when a filled path is not applicable to the shoe's upper family, and SHALL NOT expect or warn about unfilled paths that are not applicable.

#### Scenario: Shaft filled on a pump warns
- **WHEN** a shoe with upper family "pump" has shaft height filled
- **THEN** lint displays a warning that the shaft section does not apply to pumps, and the sheet still saves and compiles

#### Scenario: Shaft unfilled on a pump stays silent
- **WHEN** a shoe with upper family "pump" has no shaft fields filled
- **THEN** lint produces no shaft-related warning

#### Scenario: Boot keeps its existing expectation
- **WHEN** a shoe with upper family "boot" has no shaft height filled
- **THEN** lint still warns that boots usually want a shaft height, as before

### Requirement: Sheet kind and assertive imported sheets
Each shoe SHALL record a sheet kind of "authored" or "imported", defaulting to "authored". Imported sheets describe real, existing shoes and SHALL be assertive: lint SHALL warn on any unresolved disjunctive choice-set in an imported sheet. Authored sheets SHALL allow choice-sets without assertiveness warnings.

#### Scenario: Imported sheet with unresolved choice-set warns
- **WHEN** an imported sheet has heel type as the choice-set {stiletto, wedge}
- **THEN** lint warns that the sheet is imported and the disjunction is unresolved, without blocking save or compilation

#### Scenario: Authored sheet with choice-set stays silent
- **WHEN** an authored sheet has heel type as the choice-set {stiletto, wedge}
- **THEN** lint raises no assertiveness warning for that choice-set

#### Scenario: Kind defaults to authored
- **WHEN** a shoe is created without specifying a sheet kind
- **THEN** the record stores sheet kind "authored"

## MODIFIED Requirements

### Requirement: Shoe asset records with stratified sheet
The system SHALL store shoe assets composed of a required identity section (unique slug, display name; optional origin character, style families, occasions, gallery tags, notes, sheet kind) and optional detail sections: silhouette (upper family, toe shape, vamp coverage, toe box, throat, quarters, topline, fastening), upper construction and colorway, straps (repeatable sub-entity), upper-platform transition (wrap relationship, edge treatment), platform, heel (type, height, pitch, seat, breast finish and profile, lift external and internal, top piece with material, size, shape, and acoustic character), shaft (boot-conditional), counter (rigidity, grip/lining), hardware (type, finish), adornments with placements, construction detail (welt type and visibility, shank, insole material, cushioning, branding, outsole material, style, finish, texture), and sensory notes. Only slug and display name SHALL be required. Every strap row SHALL carry a type and MAY carry width (ordinal scale step), material, hardware finish, anchor, closure, and note.

#### Scenario: Minimal shoe creation
- **WHEN** the user creates a shoe supplying only slug and display name
- **THEN** the system saves the record with every detail section unfilled

#### Scenario: Archetype split into upper family and architecture
- **WHEN** the user records a shoe described as "loafer pumps"
- **THEN** the sheet stores upper family "loafer" while heel and platform sections carry the architecture, and no single conflated "archetype" value is required

#### Scenario: Strap row stores full structure
- **WHEN** the user records a strap with type "slingback", width at a wide step, material "patent leather", hardware "polished gold", anchor "heel-collar", and closure "buckle"
- **THEN** the sheet stores the strap row with all six attributes retrievable as structured fields

#### Scenario: Deep heel detail stored
- **WHEN** the user fills heel breast finish "lacquered", breast profile "concave", lift external "leather-wrapped", and lift internal "steel-reinforced"
- **THEN** the sheet stores each value under the heel section as a separately addressable field

### Requirement: Controlled vocabularies with custom values
Enum-style fields (upper family, toe shape, vamp coverage, toe box structure, throat, quarter style, topline finish, fastening, heel type, heel seat, heel breast finish, heel breast profile, welt type, welt visibility, outsole style, outsole finish, insole cushioning, counter rigidity, counter grip, hardware type, hardware finish, strap type, strap anchor, strap closure, transition wrap, transition edge, materials, colors, embellishments, occasions, and construction-detail terms) SHALL be backed by vocabularies seeded from the existing shoe taxonomy and corpus plus the harvested legacy term families. The user SHALL be able to enter a custom term not present in a vocabulary; accepted custom terms SHALL behave like seeded terms in pickers and compilation.

#### Scenario: Custom material accepted
- **WHEN** the user types "spectator patent leather" as primary material and confirms the custom value
- **THEN** the record stores it and the material picker offers it thereafter

#### Scenario: Harvested throat vocabulary offered
- **WHEN** the user opens the throat field picker
- **THEN** seeded throat terms (such as "plunging V", "wide U", "scalloped") are offered alongside custom entry

#### Scenario: Custom strap type accepted
- **WHEN** the user types "double-crossed instep wrap" as a strap type and confirms the custom value
- **THEN** the strap row stores it and the strap type picker offers it thereafter

### Requirement: Sparse prompt compilation
The system SHALL compile a generation prompt from filled fields only, following the house formula: product-shot preamble (aspect, angle, cyclorama), opening sentence assembled from magnitude phrases and upper family, upper narrative (materials, colors, construction), strap clause (per filled strap row, in sheet order, joined naturally), upper-platform transition clause (when transition fields are filled), platform clause, heel clause (including breast finish/profile and lift finish when filled), shaft clause, counter and hardware clauses (when filled), adornment clause, outsole clause (material, style, and finish when filled), outsole-lacquer contrast clause, and silhouette closer. When outsole lacquer is specified, the contrast clause SHALL be emitted as the house signature. Steps in the extreme zones of a scale SHALL emit their stacked intensifier phrases, including strap width steps.

#### Scenario: Minimal sheet compiles minimal prompt
- **WHEN** only identity, upper family, heel type, heel height, and platform height are filled
- **THEN** the compiled prompt consists of the preamble, opening sentence, heel clause, and platform clause, with no other narrative clauses

#### Scenario: Outsole signature always compiled
- **WHEN** outsole lacquer is filled with color and gloss step
- **THEN** the compiled prompt contains the high-contrast mechanical-signature clause referencing that lacquer

#### Scenario: Extreme-zone intensifier stacking
- **WHEN** platform height is set to the top zone of its scale
- **THEN** the platform clause uses the step's stacked phrases (multiple intensifying terms)

#### Scenario: Straps compile when filled, stay silent when unfilled
- **WHEN** a sheet has two filled strap rows and then they are removed
- **THEN** the compiled prompt first contains a strap clause describing both rows in order, and afterwards contains no strap clause at all

#### Scenario: Strap width extreme zone stacks
- **WHEN** a strap's width is set to the top zone of the width scale
- **THEN** the strap clause uses that step's stacked intensifier phrases

#### Scenario: Transition clause emitted when filled
- **WHEN** transition wrap "monolithic seamless wrap" and edge treatment "knife-edge" are filled
- **THEN** the compiled prompt's platform-area narrative includes a clause describing how the upper meets the platform

#### Scenario: Deep heel detail compiles into the heel clause
- **WHEN** heel breast finish "lacquered" and breast profile "concave" are filled
- **THEN** the heel clause references the lacquered concave breast

### Requirement: Contradiction lint
The system SHALL detect contradictions between filled fields and display warnings; warnings SHALL NOT block saving or compilation. Beyond field-pair contradictions (for example heel type "kitten" with heel height at a sky-high step, or closed vamp coverage with a peep-toe shape), lint SHALL detect: absence-versus-filled contradictions (a path marked explicitly absent while a related structure implying it is filled), applicability violations (filled paths that cannot apply to the shoe's upper family), and assertiveness violations (unresolved choice-sets on imported sheets).

#### Scenario: Kitten heel at sky-high warns
- **WHEN** the sheet has heel type "kitten" and heel height at the "sky-high" step
- **THEN** the editor displays a contradiction warning and the sheet still saves and compiles

#### Scenario: Absent fastening with buckled strap warns
- **WHEN** the sheet has fastening explicitly absent and a strap row with closure "buckle"
- **THEN** lint warns that an explicitly absent fastening contradicts a buckled strap, without blocking save

#### Scenario: Nonsense section for family warns
- **WHEN** a pump-family shoe has a filled shaft height
- **THEN** lint warns that the shaft section does not apply to this family
