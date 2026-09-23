## Why

This project (a web gallery app for generating consistent gynoid characters, wardrobes, and scenes) has no code yet. Shoes are the right first vertical slice: they have the most developed taxonomy in the existing authoring system, no composition dependencies (no character/outfit references), and a real validation corpus of ~389 markdown sheets and ~463 images currently scattered as hand-maintained files with no structure, search, or lifecycle. This change establishes the app skeleton and proves the core asset pattern — structured sheet, ordinal-scale magnitudes, sparse prompt compilation, image + prose artifacts — on the hardest asset type first.

## What Changes

- New Next.js app skeleton (App Router, TypeScript, SQLite via Drizzle, local-filesystem image storage) — the project is currently empty
- Shoe asset data model: full stratified schema (identity, silhouette, upper/colorway, platform, heel, shaft, adornments, construction detail, sensory), every detail field optional, magnitude fields expressed as steps on registered ordinal scales
- Scale registry seeded from the local dimension-guides library (~15 general scales plus shoe-specific derivations: heel height, platform height, pitch, toe spring, shaft height); steps carry prompt phrases and human-only anchors, and numbers are structurally excluded from compiled prompts
- Controlled vocabularies for enum fields, seeded from the existing shoe taxonomy template and validated against the corpus; every enum field accepts custom values
- Sparse prompt compiler: emits clauses only for filled fields; supports disjunctive choice-sets ("stiletto or wedge"), explicit absence clauses ("no visible welt or stitching"), and stacked intensifiers at extreme scale zones; outsole-lacquer contrast clause is the always-emitted house signature; prompts are snapshotted verbatim when used
- Shoe gallery UI: image grid with faceted filtering (upper family, heel type, heel/platform height zone, outsole lacquer color, style family, origin character) and text search
- Shoe sheet editor UI: progressive-disclosure form over vocabularies and scales, with lint warnings for contradictions (e.g. kitten heel at sky-high height) that warn without blocking
- Image artifacts: manual attach of product shots with kind/pass/approved flags, one approved shot as gallery card; per-image rendered overlay (resolved fields, deviations, defects) entered manually; editable canonical prose description
- Deferred (explicitly out of scope): generator execution/job runner, vision-model automation of overlay/prose, bulk import of the existing corpus, character/outfit/scene capabilities

## Capabilities

### New Capabilities
- `shoe-assets`: Shoe asset studio — structured sheets, scale-backed magnitudes, vocabularies, sparse prompt compilation, image/prose artifacts, gallery and editor UI

### Modified Capabilities
- None (no existing specs)

## Impact

- Greenfield repo: creates the application, database, seed scripts, and first UI; no existing code affected
- Seed-time reads from outside the repo: the dimension-guides library (`~/guide_to_dimensions/`) and the shoe taxonomy template in the `world_of_gynoids` repo; these are converted to seed data once, then live in the database
- Single-user local deployment; no auth, no external services at runtime
