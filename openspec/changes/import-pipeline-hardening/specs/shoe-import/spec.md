## MODIFIED Requirements

### Requirement: Family gate with human checkpoint
The first interrogation pass of every run SHALL ask only for gross architecture (upper family, boot-ness, sandal-ness): from the source image for image runs, and from the design intent text for intent runs. The system SHALL present the proposal to the user, and the section battery SHALL NOT run until the user confirms or corrects the family.

#### Scenario: Wrong family corrected before battery
- **WHEN** pass 0 proposes "flat" for a platform pump photo and the user corrects it to "pump"
- **THEN** the section battery runs gated by "pump" and never consumes the wrong proposal

#### Scenario: Battery blocked until checkpoint
- **WHEN** the family pass completes and the user has not yet confirmed
- **THEN** no section pass has run

#### Scenario: Intent run passes through the family gate
- **WHEN** an intent run is started with "a towering black patent stripper platform pump with gold hardware" and its family pass proposes "pump"
- **THEN** the proposal awaits user confirmation and no section pass runs until the user confirms or corrects it

### Requirement: Family-gated interrogation battery
After the family checkpoint, the system SHALL run section interrogation passes (heel, upper and colorway, upper-platform transition, platform, outsole, hardware and straps, adornments, shaft for boot families, sensory), selecting passes via the applicability table for the confirmed family. This SHALL apply to image runs and to intent runs alike. Intent-run passes carry the design intent text instead of an image. Passes SHALL execute one at a time, never as concurrent requests to the inference server, and each pass SHALL be persisted as soon as it settles. Each pass SHALL ask focused questions derived from the sheet template: field labels, vocabulary term families, and scale step anchors for orientation. Each pass SHALL produce proposals for only its section's fields.

#### Scenario: Pump never gets a shaft pass
- **WHEN** the confirmed family is "pump" and the battery runs
- **THEN** no shaft pass executes and no shaft field is proposed

#### Scenario: Boot battery includes the shaft pass
- **WHEN** the confirmed family is "boot" and the battery runs
- **THEN** a shaft pass executes and may propose shaft height, fit, and construction

#### Scenario: Scale question presents anchors
- **WHEN** the heel pass asks about heel height
- **THEN** the prompt lists the heel-height scale steps with their orientation anchors and requests a step reference, not a number

#### Scenario: Intent run gets the section battery
- **WHEN** an intent run's family is confirmed as "pump" and the battery runs
- **THEN** the same section passes as an image pump run execute, each prompt carrying the intent text and no image

#### Scenario: Passes never overlap
- **WHEN** the battery runs eight section passes
- **THEN** each inference request starts only after the previous one has settled, and each pass row is visible before the next pass completes

### Requirement: Assertive response semantics
Parsed pass responses SHALL map to the sheet value states: a committed answer becomes a single value; a hedged answer naming alternatives becomes a choice-set proposal; an explicit not-present statement becomes an absence proposal only on paths where absence is defined; a cannot-discern statement leaves the field unfilled. A cannot-discern statement SHALL be recognized only when it is the entire answer. A not-present statement SHALL be recognized only when it is the entire answer, or when the answer begins with the standalone word "no" followed by a space (e.g. "no visible welt or stitching"). Matching ignores case and surrounding whitespace. A term that merely contains such a word (e.g. "none-cemented", "no-show") is an ordinary answer. For scale fields, an answer SHALL be accepted when it contains exactly one valid step reference for that field's scale, whatever decoration surrounds it. Any other value containing digits SHALL be rejected to unfilled with a note. Vocabulary answers outside the seeded terms SHALL be accepted as custom values, normalized to the house term format.

#### Scenario: Hedged toe shape becomes a choice-set
- **WHEN** the upper pass answers toe shape "pointed, possibly almond"
- **THEN** the proposal sheet holds the choice-set {pointed, almond} flagged for resolution

#### Scenario: Numeric answer rejected
- **WHEN** the heel pass answers heel height "about 12 centimeters" instead of a step reference
- **THEN** no step is proposed, the field stays unfilled, and the response note records the rejection

#### Scenario: Not-present becomes absence where legal
- **WHEN** the construction pass answers "no visible welt or stitching" for a sheet where welt absence is defined
- **THEN** the welt field receives an absence proposal

#### Scenario: Decorated step reference accepted
- **WHEN** the upper pass answers lacquer gloss "general.smoothness:9 (high)"
- **THEN** the field receives the proposal "general.smoothness:9" and no rejection note is recorded

#### Scenario: Step reference from the wrong scale rejected
- **WHEN** the heel pass answers heel height "shoes.platform_height:4"
- **THEN** no step is proposed and the note records that the answer is not a step of the heel-height scale

#### Scenario: Term containing a sentinel word is an ordinary answer
- **WHEN** the construction pass answers welt "none-cemented"
- **THEN** the welt field receives the value "none-cemented", not an absence proposal

#### Scenario: Cannot-discern inside a longer answer is not a sentinel
- **WHEN** the upper pass answers primary material "unclear-coated leather"
- **THEN** the field receives the value "unclear-coated-leather" and is not left unfilled

### Requirement: Pass provenance
Each executed pass SHALL be stored as an immutable row recording its section, template version, verbatim prompt text, verbatim model response, the model's reported finish reason when available, and the fields it proposed. A pass SHALL count as failed when the request errored, the response was empty, or the response contained no JSON object. Failed passes SHALL propose nothing, SHALL be shown as failed in the pass log, and SHALL be re-executed by the next battery run. Pass rows SHALL NOT be editable or deleted while the run exists; re-asks and retries SHALL append new rows.

#### Scenario: Pass log inspectable after acceptance
- **WHEN** a run is accepted and the user opens its pass log
- **THEN** every pass is listed with the exact prompt sent and the exact response received

#### Scenario: Template drift cannot rewrite history
- **WHEN** pass templates change after a run completed
- **THEN** the stored prompts and responses of that run remain byte-identical

#### Scenario: Empty response is a retryable failure
- **WHEN** the heel pass returns an empty response with finish reason "length"
- **THEN** the pass row records the empty response and finish reason, the pass log shows it as failed, and the next battery run executes the heel pass again

#### Scenario: Successful pass is not repeated
- **WHEN** the battery is re-run after the upper pass returned a parseable JSON object
- **THEN** the upper pass is not executed again

## ADDED Requirements

### Requirement: Re-parse stored responses
For an open run, the user SHALL be able to re-parse the run. Re-parsing SHALL apply the current response parser to every successful stored pass, in the order the passes were recorded, and rebuild the machine proposals and notes in the working sheet from the results. Fields the user has edited, resolved, marked absent, or accepted SHALL keep their user values, and fields the user has cleared SHALL stay cleared. Re-parsing SHALL NOT send any inference request, and SHALL NOT append, modify, or delete pass rows.

#### Scenario: Parser fix recovers lost answers
- **WHEN** a stored silhouette pass response contains seven valid answers that an earlier parser failed to map, and the user re-parses the run
- **THEN** the working sheet holds proposals for those seven silhouette fields, attributed to the silhouette pass

#### Scenario: User edits survive re-parse
- **WHEN** the user has edited toe shape to "almond" and then re-parses a run whose stored upper pass answered "pointed"
- **THEN** toe shape remains "almond"

#### Scenario: User-cleared field stays cleared
- **WHEN** the user cleared the platform shape proposal and then re-parses the run
- **THEN** platform shape remains unfilled

#### Scenario: Re-parse is inference-free and history-preserving
- **WHEN** the user re-parses a run while the inference server is unreachable
- **THEN** the re-parse completes, and the run's pass rows are unchanged in number and content

### Requirement: Inference server preflight
Before executing any interrogation pass (family, battery, or re-ask), the system SHALL check that the inference server is reachable. When it is not, the action SHALL stop before sending any pass, SHALL record no pass rows, and SHALL show the user an error naming the unreachable server.

#### Scenario: Unreachable server fails fast
- **WHEN** the user runs the battery while the inference server is down
- **THEN** no pass rows are appended and the review page shows that the inference server is unreachable

#### Scenario: Reachable server proceeds
- **WHEN** the user runs the battery and the server answers the reachability check
- **THEN** the battery executes its pending passes
