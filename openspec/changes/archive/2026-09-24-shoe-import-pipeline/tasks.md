# Tasks: shoe-import-pipeline

Prerequisite: `deepen-shoe-sheet` implemented and archived (applicability table, straps/deep fields, sheet kind).

## 1. Domain: battery selection and pass templates

- [x] 1.1 Create `src/domain/import/battery.ts` with `selectBattery(family)` over the applicability table and `buildPassPrompt(passKey)` generating prompts from field-specs + registry (labels, capped term families, full scale steps with anchors, step-reference request for magnitudes) stamped with `TEMPLATE_VERSION`; verify with vitest that pump excludes the shaft pass, boot includes it, scale prompts list anchors, and vocab listings respect the cap
- [x] 1.2 Add the family pass prompt (pass 0: gross architecture only — upper family from the vocabulary plus boot-ness/sandal-ness signals); verify with vitest that it asks no section-detail questions and requests a single family value

## 2. Domain: response parsing

- [x] 2.1 Create `src/domain/import/parse.ts` with `parsePassResponse` implementing the value-state mapping: single → value, multi/hedged → choice-set, not-present → absence (only on absence-legal paths), cannot-discern/unparseable → unfilled with note; verify with vitest over fixture responses covering each mapping and paths where absence is illegal
- [x] 2.2 Add digit rejection and term normalization (kebab-case free text, no fuzzy vocab snapping); verify with vitest that "about 12 centimeters" rejects to unfilled with note and "Kitten Heel" normalizes to `kitten-heel`

## 3. Persistence and VLM client

- [x] 3.1 Add `import_runs` and `import_passes` tables to `src/db/schema.ts` (insert-only passes, working_sheet JSON, status open/accepted/discarded, result_shoe_id, source columns) and data access in `src/lib/import.ts` (createRun, getRun, appendPass, updateWorkingSheet, acceptRun, discardRun, listPasses); verify `npm run db:migrate` creates both tables and a round-trip unit test writes and reads a run with two passes
- [x] 3.2 Create `src/lib/vlm.ts` — Lemonade chat-completions client (fetch to the configured server URL, base64 image part, `INTERROGATOR_MODEL` constant, JSON-preferring system prompt), consulting the `lemonade-server` skill for the exact request shape; verify with a mocked fetch unit test that the request body carries the image and model id, and with one live smoke call against the server (manual)

## 4. Server actions and wizard flow

- [x] 4.1 Add server actions: start run (image upload to `data/images/imports/` or intent text), run family pass, confirm family, run battery (parallel `Promise.all`, per-pass persistence on settle, failures recorded with empty proposals), re-ask field, mutate working sheet (accept/edit/resolve/absent/clear), discard; verify each action with a vitest/integration test over an in-memory db where applicable, and zod validation at every boundary
- [x] 4.2 Build `/shoes/import` entry page (choose image or intent, list of open runs) and the wizard pages for family checkpoint and battery progress; verify manually: image run reaches checkpoint, correction blocks battery until confirmed, battery shows per-pass progress
- [x] 4.3 Build the review surface at `/shoes/import/[runId]`: source panel beside flagged proposal sheet (provenance pass key + raw response per field), per-field actions, live `lintShoe` over the working sheet on every mutation, accept gate (no unresolved choice-sets, slug + display name present) enforced server-side in the accept action; verify manually with a run containing a choice-set, a lint warning, and missing identity

## 5. Acceptance and vibe path

- [x] 5.1 Implement accept: create shoe via existing `createShoe` with sheet kind by source type (image → imported, intent → authored), link `result_shoe_id`, set run accepted; verify with vitest that an image run produces an imported shoe whose sheet equals the working sheet, and a lint warning alone does not block
- [x] 5.2 Implement the vibe path: intent runs use one full-template text pass (collapsed battery) feeding the same review surface; verify manually that an intent run reaches review and accepts as an authored shoe

## 6. Integration verification

- [x] 6.1 Run `npm test` and `npm run build` green; manual end-to-end pass: start image run → confirm family → battery completes → resolve a choice-set via re-ask → accept → shoe appears in gallery with sheet kind imported → open the run's pass log and confirm verbatim prompts/responses → discard a second run and confirm it leaves no shoe
