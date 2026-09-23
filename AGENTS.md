# AGENTS.md

Operating manual for AI coding agents working in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # production build
npm run test         # vitest run (all suites)
npm run db:migrate   # drizzle-kit push -> data/app.db
npm run db:seed      # load seed/scales.json + seed/vocabularies.json into SQLite
```

Run `npm test` before considering any change to `src/` complete.

## Architecture

- `src/domain/` — pure domain logic with zero I/O: `shoe.ts` (zod schemas, value-state helpers), `registry.ts` (scale/vocabulary registry), `compile.ts` (sparse prompt compiler), `lint.ts` (contradiction warnings). Every behavior here is vitest-covered in `tests/`.
- `src/db/` — Drizzle schema (`schema.ts`) and SQLite connection (`db.ts`). Database file: `data/app.db`; images under `data/images/`.
- `src/lib/` — `field-specs.ts` maps detail paths to the progressive-disclosure editor form; `shoes.ts` is the data-access layer over the db.
- `src/app/` — App Router pages (gallery, `/shoes/new`, `/shoes/[slug]` editor with compiler/prose/images panels) and server actions in `actions.ts`. Images served via `src/app/api/images/[...path]/route.ts`.
- `seed/` — vendored seed data. `scripts/seed.ts` loads it; the Python converters in `scripts/` are one-time provenance tools reading external libraries — never needed at runtime.

Flow: sheet (structured details) -> registry lookups (scales/vocabularies) -> sparse compiler -> prompt snapshot -> image artifacts with pass/approved flags and overlays.

## Conventions

- **Spec-driven workflow**: create an OpenSpec change (`openspec new change "<name>"`) and its artifacts before writing code. Pure docs/tooling changes set `skip_specs: true` in the change's `.openspec.yaml`. Archive completed changes.
- **Domain logic is pure and tested.** Anything involving scales, vocabularies, compilation, or linting belongs in `src/domain/` with vitest coverage; UI code stays thin.
- **Zod at every boundary**: server actions validate with the input schemas from `src/domain/shoe.ts`; scale step ids follow `scaleId:rank` (e.g. `shoes.heel_height:7`).
- **No numeric measurements in prompts — ever.** This is structural: magnitudes compile from ordinal scale steps only. Never add numbers, units, or degrees to any compiled prompt or template.
- **Prompts are snapshotted verbatim** when used; artifacts record what was actually sent.
- **Value states are meaningful**: `null` omits the clause, arrays compile disjunctive choice-sets, `{ absent: true }` is only legal on `ABSENCE_ALLOWED` paths.
- Slugs are kebab-case; naming stays consistent between sheet and routes.

## Generation environment

- **Lemonade inference server**: `192.168.0.20:13305` — local image generation models (Flux-2-Klein-9B-GGUF, Krea-2-Turbo, Qwen-Image-2512-GGUF, Z-Image-Turbo) and vision models for judging. A `lemonade-server` skill exists on this machine.
- **Remote generation**: Gemini and Venice image-generation skills exist on this machine (Gemini via API key in `~/.config/opencode/secrets/gemini`; Venice via its API).
- **Legacy knowledge base** (read-only, do not modify): `~/Insync/flaviocpontes@gmail.com/Google Drive/PersonalProjects/Extract into IA/People for IA` — the predecessor filesystem system. Mine it for validated learnings: model adapter rules with evidence (`procedures/shoe_generation/local_model_adapters.md`), judge bake-off policy, rubric v3 criteria, and the calibration dev log (`calibration/dev_log.md`).

## Anti-patterns

- Do not hand-edit `data/app.db` or the vendored `seed/*.json` — regenerate via scripts instead.
- Do not build prompts by string-concatenating outside the compiler, or bypass `src/domain/compile.ts`.
- Do not reintroduce numeric measurements, "invisible mannequin" phrasing, or un-versioned model-specific prompt hacks. Model deltas will be versioned adapter rules, not inline edits.
- Do not implement features without an OpenSpec change; do not skip `npm test`.
