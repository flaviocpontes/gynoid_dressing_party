## Why

The first real import runs show the pipeline losing most of what the model gets right. The only image run (a pump) accepted 10 of ~60 fields. Two section passes (heel, platform) came back empty yet were recorded as successes, so retry skipped them. A correct scale answer (`general.smoothness:9 (high)`) was rejected as "digit-bearing". `"none-cemented"` was silently turned into an absent welt. Seven good silhouette answers were lost to an earlier parser, with no way to recover them from the stored responses. On a second run, 16 passes failed with `fetch failed` because the server was unreachable. The single-pass intent ("vibe") path sent an 18.8k-character prompt and got back one field. These are correctness bugs in a finished feature, and they need fixing before the pipeline gets more automation (auto re-ask, worker queue, bulk import).

## What Changes

- **Failed passes are detected, not assumed.** An empty response, one with no JSON object, or a transport error marks the pass as failed. Failed passes are retried by the battery like errors are today. Each pass also records the model's finish reason, so running out of tokens shows up instead of silently producing nothing.
- **Scale answers are read by step reference.** The parser pulls a valid step id for the field's scale out of the answer and ignores trailing decoration such as `(high)`. Any other digit-bearing answer is still rejected. Prompts no longer print the zone right after the step id.
- **Sentinel answers match whole answers only.** `cannot-discern` and `not-present` (and their listed variants) are recognized only when they are the entire answer; the one exception is that an answer starting with the word "no" followed by a space (e.g. "no visible welt") still reads as not-present. `"none-cemented"`, `"stone"` and `"unclear-edge"` are ordinary terms.
- **Re-parse run (new).** One action re-runs the current parser over every successful stored pass of an open run and rebuilds the machine proposals. Fields the user has edited are kept. It makes no inference calls, and pass rows stay byte-identical.
- **Server preflight (new).** Before any pass executes, the pipeline checks that the inference server is reachable. If it isn't, the action fails immediately with a visible message and writes no pass rows.
- **Intent runs use the family gate and battery.** The single "vibe" pass is retired. Intent runs get a text-only family pass, the same human checkpoint, and the same family-gated section battery (text-only prompts carrying the intent). Existing vibe pass rows stay readable.
- **Section prompts carry the confirmed family and only applicable fields.** Every section and re-ask prompt states the human-confirmed upper family. Each section lists only the fields the applicability table allows for that family, and the parser ignores answers for fields that aren't applicable. Only the human-confirmed family is carried forward; machine answers never are (that is the separate `progressive-interrogation` change).
- **The spec matches the one-request-at-a-time server.** The battery requirement changes from "passes run in parallel" to "passes run one at a time", which is what the code already does because the server has a single slot.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shoe-import`: changes to family gate (now also for intent runs), battery (sequential execution, intent runs, server preflight, family-aware prompts, per-field applicability), assertive response semantics (step-reference extraction, whole-answer sentinels), pass provenance (finish reason, failed-pass definition and retry), plus a new re-parse requirement.

## Impact

- **Code:** `src/domain/import/parse.ts` (step extraction, sentinel matching, failed-response classification), `src/domain/import/battery.ts` (step-line format, intent-aware and family-aware section prompts, per-field applicability filtering, vibe retirement), `src/lib/vlm.ts` (returns text and finish reason, health preflight), `src/lib/import.ts` (failed-pass logic, re-parse, intent battery), `src/app/shoes/import/actions.ts` and the `[runId]` review page (re-parse button, preflight error display, intent flow).
- **Schema:** adds one nullable column `import_passes.finish_reason` via `npm run db:migrate`. Existing rows keep null.
- **Tests:** extend `tests/import-parse.test.ts` and `tests/import-integration.test.ts`. The `VlmFn` test stubs change shape to return `{ text, finishReason }`.
- **Template version:** `TEMPLATE_VERSION` goes to `shoe-import/2` because the prompt text changes.
- **No change** to the compiler, lint, shoe schema, or the no-numbers rule. Step ids are references the parser resolves, and they never reach a compiled prompt.
