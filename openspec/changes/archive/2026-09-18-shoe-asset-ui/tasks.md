## 1. App Scaffold

- [x] 1.1 Scaffold Next.js (App Router, TypeScript) with Tailwind and verify `npm run dev` serves the default page
- [x] 1.2 Add Drizzle + better-sqlite3, DB file under `data/`, and verify `npm run db:migrate` creates an empty SQLite database
- [x] 1.3 Add vitest and verify `npx vitest run` executes a placeholder test green

## 2. Database Schema

- [x] 2.1 Create scale registry tables (`scales`, `scale_steps` with rank/zone/phrases/nuance/anchors) and vocabulary tables (`vocabularies`, `vocabulary_terms`) and verify migrations apply
- [x] 2.2 Create `shoes` table: identity + promoted facet columns (upper_family, heel_type, heel_height_step, platform_height_step, outsole_lacquer_name, style_family, origin_character, appearance_tier) + `details` JSON column; verify migration applies and facets are indexed
- [x] 2.3 Create `shoe_images` (kind, pass, approved, rendered-overlay JSON) and append-only `shoe_prompts` snapshot tables; verify migrations apply

## 3. Seed Data

- [x] 3.1 Write a throwaway converter parsing the dimension-guides markdown (~15 general scales, three-zone structure) into committed `seed/scales.json`; verify step counts and zone ordering against the source files
- [x] 3.2 Derive shoe-domain scales (heel height, platform height, pitch, toe spring, shaft height) in `seed/scales.json` from the guide structure (heel/platform heights from the existing Women's Shoes scales); verify steps are rank-ordered with phrases present
- [x] 3.3 Write a throwaway extractor converting the world_of_gynoids shoe-template option lists into committed `seed/vocabularies.json`; run corpus filename/token analysis over Gallery/Shoes and record any archetype/term not covered as vocabulary additions; verify coverage report shows zero uncovered corpus type tokens
- [x] 3.4 Implement idempotent seed script (upsert by natural key, provenance noted) and verify re-running produces no duplicates

## 4. Domain Core

- [x] 4.1 Implement the value-state model (unfilled / value / choice-set / explicit-absence) with zod schemas for the shoe `details` document (field groups: silhouette, upper/colorway, platform, heel, shaft, adornments, construction, sensory) and verify unit tests accept legal states and reject illegal ones
- [x] 4.2 Implement scale-step and vocabulary resolution helpers (step lookup, zone classification, phrase retrieval) and verify unit tests against seeded JSON fixtures

## 5. Prompt Compiler

- [x] 5.1 Implement clause emitters per field group following the house formula (preamble, opening sentence, upper narrative, platform, heel, shaft, adornments, outsole signature, closer) with choice-set "or" joins, absence clauses, and top-zone phrase stacking; verify unit tests per emitter
- [x] 5.2 Add corpus fixture tests: reconstruct the five analyzed sheets (Extreme Mary Janes Glossy Black Metallic Red, black patent closedtoe extreme platform pumps, extreme seifuku black patent loafer pumps, extreme towering black mary janes, cream spectator patent oxford platform pumps) from decomposed fields and verify compiled prompts match their recorded prompts in structure and clause content
- [x] 5.3 Add the numeric-ban test asserting no digits appear in any compiled output across all fixtures and randomized filled-field combinations

## 6. Lint

- [x] 6.1 Implement contradiction lint (kitten heel vs sky-high height, closed vamp vs peep toe, plus at least three more rules from the taxonomy) and verify unit tests cover each rule firing and passing

## 7. Data Layer

- [x] 7.1 Implement shoe CRUD server actions with zod validation and facet-filtered gallery query (upper family, heel type, height zones, lacquer color, style family, origin character, text search); verify via vitest-integration against a temp DB
- [x] 7.2 Implement image upload (files under `data/images/<slug>/`, metadata + rendered-overlay storage) and approve/unapprove actions enforcing one approved product shot; verify via integration test
- [x] 7.3 Implement prompt snapshot action (verbatim store when marked used) and verify a later sheet edit leaves the snapshot unchanged
- [x] 7.4 Implement canonical prose description read/write and verify edit-replace behavior

## 8. Gallery UI

- [x] 8.1 Build the server-rendered card grid using approved images with placeholder for shoes lacking one; verify all seed/dev shoes render with name and facets
- [x] 8.2 Build facet filter bar and search box wired to the gallery query; verify each facet filters correctly and combines with text search

## 9. Sheet Editor UI

- [x] 9.1 Build the editor form: identity section (required slug/display name), progressive-disclosure collapsible detail sections; verify creating a minimal shoe (identity only) succeeds and shows unfilled states
- [x] 9.2 Build scale steppers (zone-aware, anchor annotations) and vocabulary comboboxes with custom-term entry and per-field state toggles (value / choice-set / absent); verify setting heel type to a choice-set and welt to absent round-trips through save/load
- [x] 9.3 Surface compiler output live in the editor with a hand-edit path and "mark used" snapshotting; verify snapshot appears and survives sheet edits
- [x] 9.4 Render lint warnings inline; verify the kitten+sky-high case warns and still saves

## 10. Image & Prose UI

- [x] 10.1 Build image management panel (upload, kind/pass/approved, rendered-overlay entry form) and verify approval swaps the gallery card
- [x] 10.2 Build prose description editor on the shoe detail view; verify saved text displays verbatim on detail and gallery hover/preview

## 11. Integration Check

- [x] 11.1 End-to-end manual pass: create shoe → fill fields → compile + snapshot prompt → attach and approve image → record overlay → set prose → find it via gallery facets; verify each spec scenario in `specs/shoe-assets/spec.md` is observable in the running app
- [x] 11.2 Run `npm run build`, full vitest suite, and record results; fix any regressions before marking complete
