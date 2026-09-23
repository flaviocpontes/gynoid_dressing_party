## Context

Greenfield repository — this change creates the application itself. Exploration settled the product architecture: an asset-centric web app where every asset follows the lifecycle *structured sheet → compiled prompt → image → prose description*, with magnitude dimensions expressed as ordinal adjective scales and enums as controlled vocabularies. Shoes are the first capability (see proposal.md - Why). Two external sources feed one-time seed data: the dimension-guides library (`~/guide_to_dimensions/`, ~15 markdown scales with three-zone structure) and the shoe taxonomy template in the `world_of_gynoids` repo (~60 fields of option lists), validated against a corpus of ~389 existing shoe sheets.

The composition model agreed for later capabilities (global component library, outfit bases with fork-with-lineage, character-agnostic scene blueprints) informs foundation choices here — scales and vocabularies are app-global, not shoe-private — but none of it is built in this change.

## Goals / Non-Goals

**Goals:**
- Establish the app skeleton: Next.js + SQLite + local image storage, single-user local deployment
- Implement the asset pattern once, end to end, for shoes: stratified sheet, scale-backed magnitudes, vocabularies, sparse compiler, image/prose artifacts, gallery
- Make the scale registry and vocabulary store reusable foundations for future asset types (characters, garments, scenes)
- Prove compiler fidelity against real corpus sheets (fixture tests from the five sheets analyzed during exploration)

**Non-Goals:**
- Generator execution (job runner, sidecar, API keys) — manual image attach only
- Vision-model automation of rendered overlays and prose descriptions — manual entry only
- Bulk import of the existing corpus — vocabulary seeding uses offline corpus token analysis, but no import feature
- Characters, outfits, scenes, components — later capabilities
- Multi-user, auth, deployment beyond the local machine

## Decisions

**Stack: Next.js App Router + TypeScript + SQLite via Drizzle.**
Single-user gallery app on a local machine; embedded database, zero services to operate, typed schema with lightweight migrations. Alternatives: Postgres (operational overhead unjustified for one user), Prisma (heavier runtime, worse SQLite ergonomics than Drizzle), a JSON-file store (facet filtering and relations become hand-rolled).

**Sheet storage: promoted facet columns + one JSON details column.**
The ~10 fields that drive gallery facets (upper_family, heel_type, heel_height_step, platform_height_step, outsole_lacquer_name, style_family, origin_character, appearance_tier) become real indexed columns. Everything else — the deep, nested, still-evolving taxonomy (throat, quarters, heel breast, lift, top piece, sensory, …) — lives in a `details` JSON column validated by a zod schema at the application boundary. Alternatives: fully normalized (~60 columns, migration churn every taxonomy tweak — the taxonomy is expected to grow), fully JSON (facet queries and indexes get clunky). JSON also gives the future fork/diff machinery document-shaped data to work with.

**Value states as a discriminated encoding inside `details`.**
Each detail field is `null` (unfilled) | `string` (value) | `string[]` with length > 1 (choice-set) | `{"absent": true}` (explicit absence). Four states, one compact representation the compiler switches on; zod refines per field (which states are legal, which vocabularies apply).

**Scales and vocabularies as database tables, seeded from committed JSON.**
`scales`, `scale_steps`, `vocabularies`, `vocabulary_terms`. Requirements demand in-app extensibility, so registry content must be runtime data, not code constants. Seed JSON is generated once by two throwaway converters (guides-markdown parser; template option-list extractor) and committed; corpus token analysis validates vocabulary coverage during seeding. Re-running the seed is idempotent (upsert by natural key). Scale steps carry `phrases[]`, `zone`, `rank`, `nuance`, `anchors[]`; anchors are display-only and have no code path into the compiler.

**Prompt compiler: pure function, clause emitters, snapshot table.**
A pure TypeScript function takes (sheet, registry) and returns prompt text. Per-field-group clause emitters follow the house formula (preamble, opening sentence, upper narrative, platform, heel, shaft, adornments, outsole signature, closer). Scale steps contribute their `phrases[]`; top-zone steps contribute the full stack. Choice-sets join with "or"; absence emits its taxonomy-defined clause. The numeric ban holds by construction — no numeric data reaches the compiler — and a test asserts no digits appear in output. Compiled-or-hand-edited prompts are snapshotted verbatim into an append-only `shoe_prompts` row when marked used; sheet edits never rewrite history. Alternative considered: an LLM-as-compiler — rejected: non-deterministic, untestable, and the corpus proves the formula is mechanical.

**Images: filesystem + API route, not public/ and not BLOBs.**
Files under `data/images/<slug>/`; metadata (kind, pass, approved, rendered overlay JSON) in `shoe_images`. Served through a Next route handler so runtime writes never touch `public/`. Rendered overlay lives on the image row, not the shoe row — resolutions are per-render.

**UI: server-rendered gallery, client editor with progressive disclosure.**
Gallery is a server component grid over promoted columns (fast, no client data). The editor is a client form: collapsible sections (identity and silhouette open by default; construction detail and sensory collapsed), scale steppers rendering zone + anchor context, vocabulary comboboxes with custom-term entry, per-field state toggles (value / choice-set / absent). Tailwind for styling; no component library — the picker/stepper/collapsible set is small and hand-rolled. Lint warnings render inline and never gate saves.

**Testing: vitest against corpus fixtures.**
Unit suites for value-state handling, the compiler (fixture tests reconstruct the five analyzed corpus sheets' prompts from their decomposed fields), the numeric-ban assertion, and lint rules. No e2e framework in this slice; the app is one page-flow and manually smoke-testable.

## Risks / Trade-offs

- [~60-field form overwhelms users] → progressive disclosure, everything optional after identity, gallery-first UX where creating a minimal shoe takes under a minute
- [Seed drift if guides or template change upstream] → seed JSON is committed and provenance-noted; regeneration is explicit and idempotent, never automatic
- [Compiler output diverges from an author's phrasing preferences] → hand-edit path and verbatim snapshots always available; the compiler is a starting point, not a gate
- [SQLite single-writer] → acceptable for one local user; no concurrency requirement exists
- [Orphaned image files on disk after record deletion] → best-effort directory cleanup on delete; documented limitation

## Migration Plan

Greenfield: `npm install`, `npm run db:migrate` (Drizzle push), `npm run db:seed` (idempotent upserts), `npm run dev`. Rollback: delete the SQLite file and `data/images/`; both are regenerable artifacts, and no corpus import exists yet, so nothing of value is lost. Future changes evolve the schema through Drizzle migrations from this baseline.
