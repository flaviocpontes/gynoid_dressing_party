## Purpose

Turns a source image of an existing shoe, or a free-text design intent, into a reviewed shoe sheet: a gated multi-pass model interrogation extracts extreme detail progressively, every machine answer keeps verbatim provenance, and a human review surface guarantees the accepted sheet is assertive and lint-clean before it becomes a shoe.

## ADDED Requirements

### Requirement: Import runs from image or intent
The system SHALL let the user start an import run from an uploaded shoe image or from a free-text design intent. A run SHALL persist its source (image file or intent text), a mutable working sheet of proposals, and a status of open, accepted, or discarded. Runs SHALL remain resumable across navigation until accepted or discarded.

#### Scenario: Image run survives navigation
- **WHEN** the user uploads a shoe photo, leaves the wizard, and reopens the run
- **THEN** the run is still open with its source image and current proposal sheet intact

#### Scenario: Vibe run from intent text
- **WHEN** the user starts a run with the intent "a towering black patent stripper platform pump with gold hardware"
- **THEN** the run is created in open status with that text as its source

### Requirement: Family gate with human checkpoint
The first interrogation pass SHALL ask only for gross architecture (upper family, boot-ness, sandal-ness). The system SHALL present the proposal to the user, and the section battery SHALL NOT run until the user confirms or corrects the family.

#### Scenario: Wrong family corrected before battery
- **WHEN** pass 0 proposes "flat" for a platform pump photo and the user corrects it to "pump"
- **THEN** the section battery runs gated by "pump" and never consumes the wrong proposal

#### Scenario: Battery blocked until checkpoint
- **WHEN** the family pass completes and the user has not yet confirmed
- **THEN** no section pass has run

### Requirement: Family-gated interrogation battery
After the family checkpoint, the system SHALL run section interrogation passes (heel, upper and colorway, upper-platform transition, platform, outsole, hardware and straps, adornments, shaft for boot families, sensory), selecting passes via the applicability table for the confirmed family. Passes SHALL run in parallel, each asking focused questions derived from the sheet template: field labels, vocabulary term families, and scale step anchors for orientation. Each pass SHALL produce proposals for only its section's fields.

#### Scenario: Pump never gets a shaft pass
- **WHEN** the confirmed family is "pump" and the battery runs
- **THEN** no shaft pass executes and no shaft field is proposed

#### Scenario: Boot battery includes the shaft pass
- **WHEN** the confirmed family is "boot" and the battery runs
- **THEN** a shaft pass executes and may propose shaft height, fit, and construction

#### Scenario: Scale question presents anchors
- **WHEN** the heel pass asks about heel height
- **THEN** the prompt lists the heel-height scale steps with their orientation anchors and requests a step reference, not a number

### Requirement: Assertive response semantics
Parsed pass responses SHALL map to the sheet value states: a committed answer becomes a single value; a hedged answer naming alternatives becomes a choice-set proposal; an explicit not-present statement becomes an absence proposal only on paths where absence is defined; a cannot-discern statement leaves the field unfilled. Any value containing digits SHALL be rejected to unfilled with a note. Vocabulary answers outside the seeded terms SHALL be accepted as custom values, normalized to the house term format.

#### Scenario: Hedged toe shape becomes a choice-set
- **WHEN** the upper pass answers toe shape "pointed, possibly almond"
- **THEN** the proposal sheet holds the choice-set {pointed, almond} flagged for resolution

#### Scenario: Numeric answer rejected
- **WHEN** the heel pass answers heel height "about 12 centimeters" instead of a step reference
- **THEN** no step is proposed, the field stays unfilled, and the response note records the rejection

#### Scenario: Not-present becomes absence where legal
- **WHEN** the construction pass answers "no visible welt or stitching" for a sheet where welt absence is defined
- **THEN** the welt field receives an absence proposal

### Requirement: Pass provenance
Each executed pass SHALL be stored as an immutable row recording its section, template version, verbatim prompt text, verbatim model response, and the fields it proposed. Pass rows SHALL NOT be editable or deleted while the run exists; re-asks SHALL append new rows.

#### Scenario: Pass log inspectable after acceptance
- **WHEN** a run is accepted and the user opens its pass log
- **THEN** every pass is listed with the exact prompt sent and the exact response received

#### Scenario: Template drift cannot rewrite history
- **WHEN** pass templates change after a run completed
- **THEN** the stored prompts and responses of that run remain byte-identical

### Requirement: Review surface with live lint
The system SHALL present the run's source (image or intent) beside the assembled proposal sheet, flag every machine-filled field, and offer per-field actions: accept, edit, resolve choice-set, mark absent (where legal), and clear. Contradiction lint SHALL run over the assembled sheet on every change. Acceptance SHALL be blocked while any choice-set is unresolved or identity fields (slug, display name) are missing; lint warnings SHALL NOT block acceptance.

#### Scenario: Choice-set must resolve before accept
- **WHEN** the proposal sheet still contains the choice-set {pointed, almond} and the user clicks accept
- **THEN** acceptance is refused and the unresolved field is highlighted

#### Scenario: Cross-pass contradiction surfaced in review
- **WHEN** one pass proposed a red heel breast and another proposed a burgundy outsole lacquer described as matching
- **THEN** lint displays the contradiction warning during review and the user may still accept after correcting a field

#### Scenario: Lint warning does not block
- **WHEN** the assembled sheet has a non-blocking lint warning and no unresolved choice-sets
- **THEN** acceptance is permitted with the warning visible

### Requirement: Acceptance creates the shoe
Accepting a run SHALL create a shoe from the assembled sheet with sheet kind "imported" for image runs and "authored" for intent runs, link the run to the created shoe, and set the run to accepted. The source image of an image run SHALL remain attached to the run, retrievable from the linked shoe, and SHALL NOT enter the shoe's generated-image set.

#### Scenario: Image import marks sheet imported
- **WHEN** the user accepts an image run
- **THEN** the created shoe has sheet kind "imported" and the run links to it

#### Scenario: Vibe import keeps authored kind
- **WHEN** the user accepts an intent run holding an unresolved-by-design creative choice-set that was resolved during review to a single value
- **THEN** the created shoe has sheet kind "authored" and stores the resolved value

### Requirement: Targeted re-ask refinement
For any flagged field or unresolved choice-set, the user SHALL trigger a re-ask: a single-question follow-up pass, stamped with the field's current candidates, whose response is stored as a new pass row and may replace the field's proposal. Refinement SHALL end when the user stops re-asking; no automatic multi-round looping SHALL occur in this version.

#### Scenario: Re-ask resolves a hedge
- **WHEN** the user re-asks the toe-shape choice-set {pointed, almond} with the source image
- **THEN** a new pass row is appended and, on a committed answer, the proposal becomes the single value

#### Scenario: Re-ask that cannot discern leaves the proposal
- **WHEN** a re-ask answers "cannot tell from this image"
- **THEN** the field's proposal is cleared to unfilled with the pass recorded
