## 1. Parser correctness (pure, `src/domain/import/parse.ts`)

- [x] 1.1 Replace substring sentinel matching with whole-answer matching (lowercase, trim, strip trailing `.`/`!`) plus the raw `/^no\s/i` not-present rule (design D4). Verify with new `tests/import-parse.test.ts` cases: `"none-cemented"` → value, `"no-show"` → value, `"unclear-coated leather"` → value, `"no visible welt or stitching"` → absence on an absence-legal path, `"Cannot discern."` → unfilled. Existing value-state tests still pass.
- [x] 1.2 Add `extractStepRef(answer, scaleId, validIds)` and use it in both the string and array branches of scale parsing (design D3). Verify with tests: `"general.smoothness:9 (high)"` → `general.smoothness:9` with no note; `"step shoes.heel_height:7, I think"` → accepted; `"shoes.platform_height:4"` on heel height → no proposal plus a wrong-scale note; `"about 12 centimeters"` → digit-rejection note; two distinct valid ids → no proposal.
- [x] 1.3 Add `isFailedResponse(text)` (null, empty or whitespace-only, `error:` prefix, no JSON object → failed) (design D1). Verify with unit tests covering each case, including a fenced `{}` counting as not failed.

## 2. Pure merge and re-parse (`src/domain/import/merge.ts`)

- [x] 2.1 Extract `applyPassToSheet(sheet, passKey, parsed)` from `applyToSheet` in `src/lib/import.ts`, keeping provenance, notes and the re-ask clearing rule, and adding "never overwrite `user` provenance" (design D5). Verify that the existing `tests/import-integration.test.ts` review-mutation and re-ask tests still pass, and that a new unit test shows a machine proposal skips a user-owned path.
- [ ] 2.2 Implement a pure `reparseSheet(sheet, passes, reg)`: keep identity, family and user-provenance fields; drop machine fields and notes; replay non-failed, non-family passes in `createdAt` order. Verify with unit tests for the three spec scenarios: stored silhouette response recovers 7 fields, a user edit survives, a user-cleared field stays cleared. Build the silhouette fixture from the real stored response shape (nested `"silhouette": {...}` object).
- [ ] 2.3 Change the `clear` mutation in `mutateField` to remove the value but set provenance to `user`. Verify that the integration test "resolve collapses a choice-set, clear empties…" still passes, and that a new assertion shows provenance `user` after a clear.

## 3. Inference client and schema

- [ ] 3.1 Add nullable `finishReason: text("finish_reason")` to `importPasses` in `src/db/schema.ts` and run `npm run db:migrate`. Verify the column exists (`PRAGMA table_info(import_passes)` via a node one-liner) and that existing rows read with null.
- [ ] 3.2 Change `vlmChat` to return `{ text, finishReason }`: read `choices[0].finish_reason`, return empty content as `""` instead of throwing, and raise the default `max_tokens` to 4096 (design D2). Update the `VlmFn` type and the test stubs. Verify with the `vlm client` tests (request body, finish reason passthrough, empty content returned, server error still propagates).
- [ ] 3.3 Add `vlmHealth()` (GET `/v1/health`, 5 s timeout) and `InferenceUnreachableError` (design D6). Verify with unit tests using a stubbed fetch: 200 resolves; network error, timeout and 500 throw `InferenceUnreachableError`.

## 4. Pipeline orchestration (`src/lib/import.ts`)

- [ ] 4.1 Store `finishReason` in `appendPass`, and switch `executeBattery`'s retry filter to `isFailedResponse`. Verify with an integration test: a stub returning `""` with `"length"` records the row with its finish reason, and a second `executeBattery` re-executes only that pass.
- [ ] 4.2 Add the injectable `preflight` to `executeFamilyPass`, `executeBattery` and `executeReAsk`, called before any pass. Verify with an integration test: a failing preflight throws `InferenceUnreachableError` and `listPasses` length is unchanged.
- [ ] 4.3 Implement `reparseRun(db, runId, reg)` over `reparseSheet`, under the run lock, with a single working-sheet write and no VLM dependency. Verify with an integration test: pass row count and contents are byte-identical before and after, and the working sheet gains the recovered fields.

## 5. Intent runs through the gate and battery

- [ ] 5.1 Make `buildPassPrompt` source-aware (`{ kind: "image" } | { kind: "intent"; text }`), share field listings across family and section templates, change scale lines to `- <id>: phrases [<zone> zone] — anchors`, and bump `TEMPLATE_VERSION` to `shoe-import/2` (design D3, D7). Verify with tests: an intent heel prompt contains the intent text and no "photograph"; an image heel prompt is unchanged apart from the step-line format; no step line has `(` directly after the id.
- [ ] 5.2 Add the confirmed-family line to section and re-ask prompts, filter section and group-row fields with `isApplicable`, and make `parsePassResponse` family-aware (drop non-applicable proposals with a note) (design D8). Verify with tests: the pump heel prompt contains "pump (confirmed)"; with a test-only applicability rule excluding a heel field for "pump", that field is absent from the prompt and an answer for it yields no proposal plus a note; `reparseSheet` applies the same filter.
- [ ] 5.3 Allow `executeFamilyPass` on intent runs, send `imagePath` only for image runs, and remove `executeVibePass` (keeping `"vibe"` in `fieldsForPass` for legacy re-parse). Rewrite the intent-run integration tests to go family pass → confirm → battery → accept. Verify with the "Intent run passes through the family gate" and "Intent run gets the section battery" scenarios as tests, plus a test that an intent battery stub never receives an `imagePath`.

## 6. Review UI and actions

- [ ] 6.1 Add `reparseRunAction`, and wrap the family, battery and re-ask actions to redirect with `?error=inference-unreachable` on `InferenceUnreachableError`. Remove `runVibePassAction`. Verify with `npx tsc --noEmit` clean.
- [ ] 6.2 Update `/shoes/import/[runId]`: add an error banner naming `LEMONADE_URL`; a "Re-parse" button on open runs; a "failed" badge plus finish reason in the pass log; the intent flow using the family and battery controls; and rename the "Vibe import" and "From a vibe" labels to intent wording. Verify by running `npm run dev`, then: start an intent run with the Lemonade URL pointed at an unreachable port (`LEMONADE_URL=http://127.0.0.1:9`) and confirm the banner shows with no pass rows added; open the accepted image run and confirm the empty heel and platform passes show as failed.

## 7. Verification

- [ ] 7.1 Run `npm test` and `npx tsc --noEmit`, and confirm both pass.
- [ ] 7.2 End-to-end against the real Lemonade server: run one image import of a pump through the gate and battery, and record the fill rate, the failed-pass count and the finish reasons in the change's archive notes. The fill rate is compared against the 10/~60 baseline. The finish reasons answer design.md's open question.
