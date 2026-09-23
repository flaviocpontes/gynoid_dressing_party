# gynoid dressing party

A single-user, local web studio for authoring gynoid wardrobe assets as **structured sheets** and rendering them **consistently across as many AI image models as possible**.

This is a ground-up rebuild of the legacy "People for IA" filesystem system. The legacy system proved the prompt science — ordinal magnitude scales instead of numbers, sparse canonical prompts, model-specific adapter deltas, VLM-judged quality gates — but ran on markdown files and agent discipline. This project keeps the science and enforces it in software.

## Purpose and design principles

The legacy system accumulated 34 numbered agent rules and a 722-line canonical prompt-blocks document, a 2,922-line hand-maintained gallery index, and relative links that rotted. Every rule was a scar from a real generator failure; every fix depended on an agent remembering to comply. This project replaces that with four principles:

1. **Structure over discipline.** If a rule matters, the schema, compiler, or linter enforces it — not the agent's memory.
2. **Rules become data.** Magnitude codex -> ordinal scales in the database. Style vocabulary -> controlled vocabularies. Model-specific prompt tweaks -> versioned adapter rules. Prose rules retire into rows.
3. **The app is the database.** Sheets, images, overlays, and prompt snapshots live in SQLite via Drizzle, queryable and faceted — no gallery markdown to maintain, no link integrity to police.
4. **Eval is a product feature.** Every generated image is an artifact with pass/approved flags; judging and model standings are app capabilities, not one-time heroic calibration campaigns.

## Core concepts

- **Sheet** — a structured asset definition (currently: shoes) covering identity, silhouette, upper, outsole, platform, heel, shaft, adornments, construction, and sensory detail. Every detail field is optional.
- **Ordinal scales** — magnitude fields (heel height, platform height, pitch, toe spring, shaft height, gloss, intensity, ...) are steps on registered scales, each step carrying prompt phrases and human-only anchors. **Numbers are structurally excluded from compiled prompts** — image generators misinterpret them.
- **Vocabularies** — controlled term lists for enum fields, seeded from the legacy shoe taxonomy. Every enum field still accepts custom values.
- **Value states** — each detail field holds `null` (unfilled, omitted from prompts), a single value, a choice-set (`["stiletto", "wedge"]` compiles to "stiletto or wedge"), or explicit absence (`{ absent: true }` compiles an absence clause like "no visible welt").
- **Sparse compiler** — emits clauses only for filled fields; stacks intensifiers at extreme scale zones; always emits the **house signature** (contrasting lacquered outsole clause). Prompts are snapshotted verbatim when used.
- **Lint** — warns on contradictions (e.g. kitten heel at sky-high height) without blocking.
- **Image artifacts** — product shots with kind/pass/approved flags, one approved shot as the gallery card, manually-entered rendered overlays (resolved fields, deviations, defects), and an editable canonical prose description.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Drizzle ORM + better-sqlite3 (SQLite at `data/app.db`)
- Zod validation at every boundary
- Vitest for domain tests
- OpenSpec (`openspec/`) for spec-driven change management

## Bootstrap

```bash
npm install
npm run db:migrate   # drizzle-kit push -> data/app.db
npm run db:seed      # load seed/scales.json + seed/vocabularies.json
npm run dev          # http://localhost:3000
```

Bootstrap is self-contained: seed data is vendored in `seed/`. Tests: `npm test`.

The `scripts/convert-guides.py` and `scripts/extract-vocab.py` converters are **provenance tools**, already run once — they read from external libraries (`~/guide_to_dimensions/`, the `world_of_gynoids` repo) and produced the vendored seed JSON. A fresh clone never needs them.

## Repo layout

```
src/domain/    pure domain logic: shoe schema, registry, compiler, lint (vitest-covered)
src/db/        Drizzle schema + SQLite connection
src/lib/       field specs (progressive-disclosure form model) + shoe data access
src/app/       Next.js App Router: gallery, sheet editor, image API, server actions
seed/          vendored scale + vocabulary seed data
scripts/       one-time provenance converters + seed loader
data/          runtime SQLite database + image storage (gitignored artifacts)
tests/         vitest suites for the domain layer
openspec/      change management: active changes, archived history, capability specs
```

## Roadmap

1. **Multi-model generation pipeline** (next milestone) — the north star: render every asset across as many AI image models as possible. Model-specific adapter deltas (versioned, evidence-cited), generation targeting Gemini/Venice remote APIs and local Lemonade models (Flux-Klein, Krea, Qwen, Z-Image), VLM judge policies, and per-model pass-rate standings computed from logged runs. The legacy system's validated learnings (adapter v3 standings, judge bake-off, rubric v3) are the seed corpus.
2. Clothes, outfits, and character asset types — the same sheet/scale/compiler pattern beyond shoes.
3. Scene rendition — composing characters, outfits, and environments into rendered scenes.
4. Bulk import of the existing ~389-sheet shoe corpus.

## Lineage

Seed scales derive from the `guide_to_dimensions` library; vocabularies from the `world_of_gynoids` shoe taxonomy template. The legacy knowledge base (procedures, adapter rules, calibration dev log) is preserved read-only outside this repo and remains the reference for mining further learnings.
