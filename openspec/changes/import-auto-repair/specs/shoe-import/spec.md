## MODIFIED Requirements

### Requirement: Targeted re-ask refinement
For any flagged field or unresolved choice-set, the user SHALL be able to trigger a re-ask: a single-question follow-up pass, stamped with the field's current candidates, whose response is stored as a new pass row and may replace the field's proposal. Apart from the bounded automatic repair round, refinement SHALL continue only while the user keeps re-asking. The system SHALL NOT loop automatically beyond one repair round per pass.

#### Scenario: Re-ask resolves a hedge
- **WHEN** the user re-asks the toe-shape choice-set {pointed, almond} with the source image
- **THEN** a new pass row is appended and, on a committed answer, the proposal becomes the single value

#### Scenario: Re-ask that cannot discern leaves the proposal
- **WHEN** a re-ask answers "cannot tell from this image"
- **THEN** the field's proposal is cleared to unfilled with the pass recorded

#### Scenario: No second automatic round
- **WHEN** a repair pass still leaves a field unresolved
- **THEN** no further automatic pass is sent for that field, and it remains flagged for the user

## ADDED Requirements

### Requirement: Automatic repair round
After each interrogation pass completes, the system SHALL collect that pass's repairable outcomes and, if there are any, send exactly one repair pass covering all of them. Repairable outcomes are: a scale answer that was not a valid step reference for its scale, a hedged scale answer, and a digit-bearing rejection. On image runs, a choice-set proposal and a cross-pass conflict are also repairable. On intent runs, choice-sets SHALL NOT be repaired automatically. For each field, the repair prompt SHALL quote the rejected or hedged answer, state the reason, and list the valid options. Repair passes SHALL be stored as pass rows like any other pass, and their committed answers SHALL replace the field's proposal. A pass classified as failed SHALL be re-sent once automatically, in the same battery run, before it is left for a manual retry.

#### Scenario: Decorated-but-wrong scale answer repaired
- **WHEN** the heel pass answers heel height "very high, around the top of the scale" and the answer is rejected as not being a step reference
- **THEN** one repair pass is sent that quotes that answer, states that a step id is required, and lists the heel-height step ids with their phrases; if the repair commits "shoes.heel_height:8", heel height holds that step

#### Scenario: One repair pass per pass
- **WHEN** the upper pass produces three repairable outcomes
- **THEN** exactly one repair pass row is appended, covering all three fields

#### Scenario: Intent choice-set left for the reviewer
- **WHEN** an intent run's upper pass proposes the choice-set {black, oxblood} for upper color
- **THEN** no repair pass is sent for that field

#### Scenario: Nothing to repair
- **WHEN** a pass produces only committed values, absences, and cannot-discern notes
- **THEN** no repair pass is sent

#### Scenario: Failed pass retried once
- **WHEN** the platform pass returns an empty response during a battery run
- **THEN** the platform pass is sent once more in the same run, and if it fails again, it is left failed for a manual retry

### Requirement: Structured answer constraint
When the inference server supports schema-constrained output, every pass SHALL send an answer schema generated from the fields it asks. In that schema, each scale field SHALL accept only its scale's step ids or the sentinels, and every field SHALL be optional. The exact schema sent SHALL be stored with the pass row. When the server does not support schema-constrained output, passes SHALL be sent without a schema, and parsing SHALL behave as it does without this requirement.

#### Scenario: Constrained scale field
- **WHEN** schema-constrained output is supported and the heel pass is sent
- **THEN** the stored schema restricts heel height to the heel-height step ids and the sentinels

#### Scenario: Unsupported server falls back
- **WHEN** the server does not support schema-constrained output
- **THEN** the heel pass is sent without a schema, and its row stores no schema
