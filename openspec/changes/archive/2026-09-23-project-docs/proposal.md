## Why

The repository has no human entry point: the project's purpose lives only in an archived change proposal, `openspec/config.yaml` has an empty `context:` block (so AI agents authoring artifacts get no project framing), and there is no AGENTS.md telling coding agents how to work in this repo. Bootstrap, conventions, the generation environment (Lemonade server, legacy knowledge base), and the project's north star (render every asset across as many AI image models as possible) are all undocumented.

## What Changes

- New `README.md` at repo root: project purpose and lineage (structured rebuild of the legacy "People for IA" filesystem system), core domain concepts (sheets, ordinal scales, vocabularies, value states, sparse compiler, lint, house signature), tech stack, bootstrap commands, repo layout, and roadmap with multi-model generation as the next milestone.
- New `AGENTS.md` at repo root: commands, architecture map, conventions (spec-driven workflow, pure domain logic, zod at boundaries, structural no-numbers rule, verbatim prompt snapshots), generation environment pointers (Lemonade server, legacy read-only knowledge base), and anti-patterns.
- Populate the `context:` block in `openspec/config.yaml`: tech stack, workflow, domain glossary, design principles (structure over discipline; rules become data; the app is the database; eval is a product feature), north star, and constraints.

## Capabilities

### New Capabilities

- None — documentation only, no spec-level behavior changes.

### Modified Capabilities

- None.

## Impact

- Documentation and workflow configuration only: two new root-level markdown files and one config edit. No runtime code, schema, or dependency changes.
