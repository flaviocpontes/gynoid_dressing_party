## 1. Probe and structured outcomes

- [ ] 1.1 Probe Lemonade for `response_format: json_schema` support with the interrogator model, using the zebra-violet enum probe from design D4. Set `STRUCTURED_OUTPUT_SUPPORTED` in `src/lib/vlm.ts` from the result. This sends a request that may reload the model on the single-slot server, so confirm with the user before running it. Verify by recording the probe request and response in this task's note.
- [ ] 1.2 Add a `code` and the raw answer to `PassNote` in `src/domain/import/parse.ts` (design D1). Verify that the existing parse tests still pass, and that new assertions check the code for each rejection type.

## 2. Repair round

- [ ] 2.1 Implement a pure `selectRepairs(parsed, sheet, sourceKind, passKey)` in `src/domain/import/repair.ts`. Verify with tests: repairable codes are selected; cannot-discern is not; an image choice-set is selected; an intent choice-set is not; a `repair:` pass returns empty.
- [ ] 2.2 Implement a pure `buildRepairPrompt(repairs, reg, family)` (design D2). Verify with a test for the spec scenario "Decorated-but-wrong scale answer repaired": the prompt quotes the answer, states that a step id is required, lists the heel-height steps, and contains no digits outside step ids.
- [ ] 2.3 Make the merge treat the `repair:` prefix as a replacement that never clears. Verify with a test: a repair with no proposal leaves the choice-set intact; a committed repair replaces it.
- [ ] 2.4 Wire the round and the single failed-pass retry into `executePass` (design D3). Verify with integration tests for "One repair pass per pass", "Nothing to repair", "Failed pass retried once" and "No second automatic round", using a scripted VLM stub that returns the responses in sequence.

## 3. Structured answer constraint (conditional on 1.1)

- [ ] 3.1 Add the nullable `responseSchema` column to `importPasses` and run `npm run db:migrate`. Verify the column exists via `PRAGMA table_info`.
- [ ] 3.2 Implement a pure `schemaForPass(passKey, reg, family)` in `src/domain/import/schema-gen.ts`. Verify with tests: the heel schema's heel-height enum equals the step ids plus the sentinels; `not-present` appears only on absence-legal paths; every property is optional.
- [ ] 3.3 Send `responseFormat` from `vlmChat` only when `STRUCTURED_OUTPUT_SUPPORTED` is set, and store it on the pass row. Verify with tests for "Constrained scale field" (flag on) and "Unsupported server falls back" (flag off, null schema, request body without `response_format`).

## 4. Review surface and verification

- [ ] 4.1 Pass log: show `repair:*` rows linked to their original pass, and label field provenance "auto-repaired". Verify with `npx tsc --noEmit` and by viewing a run with a repair in `npm run dev`.
- [ ] 4.2 Run `npm test`. Then do one end-to-end image import, with the constraint on if it is supported and once off, and record in the archive notes: the number of repair passes, fields fixed by repair, fields still flagged, and fill rate compared with the previous change's baseline.
