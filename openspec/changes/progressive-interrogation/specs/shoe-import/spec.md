## ADDED Requirements

### Requirement: Structural skeleton pass
After the family checkpoint and before any section pass, the system SHALL run one skeleton pass that asks only the skeleton fields applicable to the confirmed family. The skeleton fields SHALL be a fixed, data-defined list of structural fields. Skeleton answers SHALL follow the same response semantics and provenance rules as any other pass. Section passes SHALL NOT ask skeleton fields again.

#### Scenario: Skeleton runs before sections
- **WHEN** the family is confirmed as "pump" and the battery runs
- **THEN** the skeleton pass row is recorded before any section pass row

#### Scenario: Skeleton fields not re-asked
- **WHEN** heel type is a skeleton field and the heel pass is built
- **THEN** the heel prompt does not ask for heel type

#### Scenario: Boot-only skeleton field gated by family
- **WHEN** the confirmed family is "pump"
- **THEN** the skeleton pass does not ask about shaft presence

### Requirement: Committed context forwarding
Each section pass prompt SHALL include the established skeleton values as orientation that the source overrides. A skeleton field SHALL be forwarded only when it holds a single committed value or an explicit absence. When the user has set a skeleton field, the user's value SHALL be forwarded instead of the machine's. Choice-sets, unfilled skeleton fields, and notes SHALL NOT be forwarded. The forwarded context SHALL be part of the stored verbatim prompt.

#### Scenario: Committed value forwarded
- **WHEN** the skeleton pass committed heel type "stiletto" and the heel pass is built
- **THEN** the heel prompt states that the heel type is established as "stiletto" and that the source overrides it

#### Scenario: Hedge not forwarded
- **WHEN** the skeleton pass answered toe shape as the choice-set {pointed, almond}
- **THEN** no section prompt mentions toe shape as established

#### Scenario: User value wins
- **WHEN** the skeleton pass proposed toe shape "round" and the user edited it to "almond" before the sections ran
- **THEN** section prompts forward toe shape "almond"

### Requirement: Context disagreement becomes a decision
A section pass SHALL be able to report that the source contradicts a forwarded value by naming the field and the value it observes. The system SHALL then turn that field into a choice-set of the forwarded value and the observed value, with a note naming the disagreeing pass. A disagreement on a user-set field SHALL NOT change the value; it SHALL only add a note.

#### Scenario: Disagreement produces a choice-set
- **WHEN** heel type "stiletto" was forwarded and the heel pass reports that it observes "block"
- **THEN** heel type holds the choice-set {stiletto, block} with a note naming the heel pass, and acceptance is blocked until it is resolved

#### Scenario: Disagreement with a user value only notes
- **WHEN** the user set heel type "stiletto" and the heel pass reports that it observes "block"
- **THEN** heel type remains "stiletto" and a note records the disagreement

### Requirement: Cross-pass conflicts become choice-sets
When a machine pass proposes a value for a field that already holds a different value proposed by another machine pass, the field SHALL become a choice-set of both values, flagged as a cross-pass conflict. The exceptions are targeted re-asks and repair passes, whose proposals replace the value outright. Fields with user provenance SHALL NOT be changed by any machine pass.

#### Scenario: Two passes disagree on a shared field
- **WHEN** the upper pass proposed outsole lacquer color "red" and a later pass proposes "burgundy" for the same field
- **THEN** the field holds the choice-set {red, burgundy} flagged as a cross-pass conflict

#### Scenario: Agreement stays a single value
- **WHEN** two passes both propose outsole lacquer color "red"
- **THEN** the field holds the single value "red"

#### Scenario: Re-ask replaces
- **WHEN** a field holds a cross-pass conflict choice-set and a re-ask commits "red"
- **THEN** the field holds the single value "red"

### Requirement: Stale context notice and section re-run
When a skeleton field's value differs from the value forwarded to section passes that already ran, the review surface SHALL list those sections as having run on outdated context. The user SHALL be able to re-run them. A re-run SHALL append new pass rows using the current context, and SHALL NOT modify or delete earlier rows.

#### Scenario: Edited skeleton marks sections stale
- **WHEN** the sections ran with heel type "stiletto" forwarded and the user then changes heel type to "block"
- **THEN** the review surface lists the section passes that received "stiletto" as run on outdated context

#### Scenario: Re-run appends
- **WHEN** the user re-runs the stale sections
- **THEN** new pass rows are appended whose prompts forward "block", and the earlier rows are unchanged
