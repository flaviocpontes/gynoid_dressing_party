# Design: import-pipeline-hardening

## Context

The motivation is in proposal.md (Why) and the behavior contract is in `specs/shoe-import/spec.md`. The relevant current state:

- **Failure detection by prefix.** `executeBattery` (`src/lib/import.ts`) skips any pass whose `responseText` does not start with `error:`. An empty string therefore counts as a success.
- **Shared merge logic.** `executePass` builds, calls, parses and persists a pass, and `applyToSheet` merges proposals into the working sheet under an in-process per-run lock. The merge (including the re-ask "no proposal clears the field" rule) lives only inside `applyToSheet`.
- **Digit check runs first.** `parseScaleValue` accepts a scale answer only as an exact step id, and any other digit-bearing string gets the "digit-bearing" note.
- **Substring sentinels.** `isSentimental` matches sentinels by substring (`includes`).
- **Text-only client.** `vlmChat` returns only the message text and throws on transport or HTTP errors. Its `max_tokens` is 2048.
- **Current intent path.** Intent runs call `executeVibePass`, one prompt listing every field (~18.8k chars).
- **Server facts.** Per the `lemonade-server` skill references, Lemonade exposes `GET /v1/health`. It keeps one LLM slot (`max_loaded_models: 1`), uses auto `ctx_size`, and auto-loads a model on first request (40–60 s for 20–35 GB models).

## Goals / Non-Goals

**Goals:**
- Every behavior change is a pure, vitest-covered function in `src/domain/import/`. `src/lib/import.ts` only orchestrates.
- One merge function is shared by live passes and re-parse, so the two can't drift apart.
- Existing pass rows (including `vibe` and `error:` rows) are read correctly without a data migration.

**Non-Goals:**
- Automatic repair re-asks, constrained JSON output (`response_format`), self-consistency sampling, background job queue, auto-generated identity. These are follow-up changes.
- Diagnosing or tuning the vibe prompt. It is retired, not fixed.
- Crop/zoom passes.

## Decisions

### D1: Failure is derived from the response, not stored as a status
A pure `isFailedResponse(text: string | null): boolean` in `parse.ts` returns true for null, empty or whitespace-only text, a legacy `error:` record, and text where `extractJsonBlock` finds no object. `executeBattery` uses it in place of the `startsWith("error:")` filter, and the review page's pass log uses it for the failed badge.
*Alternative*: a stored `outcome` column. Rejected because it would be derivable state that needs backfilling for legacy rows, whereas deriving from the stored response classifies old rows correctly for free. It also follows D4 of the original import design: the pass log is the source of truth.

### D2: The client returns `{ text, finishReason }`; `finish_reason` gets a nullable column
`vlmChat` reads `choices[0].finish_reason` and returns it alongside `text`. An empty `content` is returned as `""` (verbatim) instead of throwing, so it lands in a pass row and D1 classifies it. `VlmFn` becomes `(req) => Promise<{ text: string; finishReason: string | null }>`. `import_passes` gains `finish_reason text` (nullable). `max_tokens` rises from 2048 to 4096 as a cheap mitigation for the suspected reasoning-budget exhaustion. The recorded finish reason will confirm or refute the hypothesis on the next real run.
*Alternative*: fold the finish reason into `response_text`. Rejected because it breaks the verbatim-response guarantee.

### D3: Scale answers resolve by step-reference extraction
A pure `extractStepRef(answer, scaleId, validIds)` scans the answer for `<scaleId>:<digits>` tokens (with the scale id regex-escaped). It accepts when exactly one distinct token is in `validIds`. It returns a "wrong scale" note when the answer contains a step-shaped token (`<something>:<digits>`) from another scale. Otherwise the existing digit-rejection note applies. The array (hedged) branch uses the same extraction per element. In prompts, scale lines change from `- <id> (<zone>): phrases — anchors` to `- <id>: phrases [<zone> zone] — anchors`, so the id is no longer followed directly by a parenthetical.
*Alternative*: strip any `(...)` suffix. Rejected because it only handles today's decoration, while extraction handles prose wrappers like "step shoes.heel_height:7, I think" too.
The no-numbers rule is unaffected. Step ids are references the parser resolves to registry rows, and compiled prompts still come only from step phrases via `compile.ts`.

### D4: Sentinels match the whole normalized answer, plus a leading "no " rule
Normalization is lowercase, trimmed, with trailing `.`/`!` removed. A sentinel matches when the normalized answer equals it. Multi-word sentinels (`cannot tell`, `not present`, …) also match as a prefix followed by a space, which keeps the existing "cannot tell from this image" scenario working. Not-present additionally matches when the raw trimmed answer matches `/^no\s/i`. Single-word sentinels (`none`, `absent`, `unclear`) match only as the whole answer. The hyphenated `no-show` and the word `none-cemented` therefore stay ordinary terms. The existing sentinel lists are kept, but `unclear` and `none` now only match as whole answers.
*Alternative*: token-level matching. Rejected because it still misfires on `"clear-sole, none visible"`-style answers. Whole-answer matching fits the answer contract, which asks for the bare sentinel.

### D5: Merge extracted as a pure function; re-parse replays passes
`applyPassToSheet(sheet, passKey, parsed): WorkingSheet` moves to `src/domain/import/merge.ts`. It holds the proposal writes, provenance and notes, and the re-ask clearing rule, all pure. The rule that user provenance is never overwritten is enforced here, and live passes get it too. That is intended: a late pass must not clobber a user edit.
`reparseRun`:
1. Starts from the current working sheet and keeps identity and the confirmed family.
2. Drops every details field whose provenance is not `user`, and drops all notes.
3. Replays every non-failed pass (D1) in `createdAt` order through `parsePassResponse` then `applyPassToSheet`.
4. Writes once, under the existing run lock.

The `family` pass is skipped during replay because the confirmed family is user state. The `vibe` pass keeps its `fieldsForPass` mapping so legacy rows still re-parse.
User clears must survive re-parse, so the `clear` mutation now removes the value but sets provenance to `user`. `sheetFieldPaths` and `displayEntries` already walk `details` only, so a provenance entry without a value is invisible and harmless.
*Alternative*: re-parse by rebuilding from an empty sheet plus a stored user-edits log. Rejected because it needs a new edits log, while provenance already records ownership.

### D6: Preflight is a health GET with a short timeout; errors surface via a search param
`vlmHealth(fetchImpl)` calls `GET ${LEMONADE_URL}/v1/health` with a 5 s `AbortSignal.timeout` and throws `InferenceUnreachableError` on failure or non-2xx. `executeFamilyPass`, `executeBattery` and `executeReAsk` accept an injected `preflight` (default `vlmHealth`) and call it before any pass. On error they throw before touching the database. Server actions catch `InferenceUnreachableError` and `redirect` to `/shoes/import/<runId>?error=inference-unreachable`, and the review page renders a banner naming `LEMONADE_URL`.
*Alternative*: return an error state through `useActionState`. Rejected because the review page uses plain form actions today, and a search param keeps it server-rendered and stateless.
Preflight checks reachability, not model load. A cold model load (40–60 s) is still absorbed by the request itself.

### D7: Intent runs use the gate and battery with a source-aware prompt preamble
`buildPassPrompt` takes `source: { kind: "image" } | { kind: "intent"; text }` in place of `opts.intent`.
- The family and section templates share their field listing and swap only the preamble. The image preamble reads "from its photograph". The intent preamble embeds the intent in `"""` and says: "commit to concrete decisions that serve the intent; hedge only where the intent is genuinely open".
- `executeFamilyPass` drops its image-only guard. `executePass` sends `imagePath` only for image runs.
- `executeVibePass`, `runVibePassAction` and the vibe UI branch are removed. The `"vibe"` key stays in `PassKey`/`fieldsForPass` for legacy parsing only.
- `TEMPLATE_VERSION` becomes `shoe-import/2`.

*Alternative*: keep vibe and chunk its prompt. Rejected because the battery already exists and is family-gated, and this answers the open question from the original design.

### D8: Confirmed family in every section prompt; per-field applicability on both sides
Every section and re-ask prompt gets the line `This shoe is a <family> (confirmed).`, placed after the preamble. `sectionFieldLines` (and group row fields) filter with `isApplicable(family, path)`. `parsePassResponse` takes the family and drops proposals for non-applicable paths, recording a note for each. Re-parse passes `run.family`, so replayed passes obey the same rule. Both sides are filtered because the model sometimes volunteers fields it wasn't asked about.
Only the human-confirmed family is carried forward, because it can't anchor the model on a wrong machine answer. Carrying machine answers forward (a skeleton pass) is deliberately left to `progressive-interrogation`.
*Trade-off*: today `APPLICABILITY` holds one rule (shaft is boot-only), which `selectBattery` already enforces at section level. The per-field filter therefore changes no prompt yet and is plumbing whose value grows with the table. Extending the table (e.g. sandal-only or platform-only fields) is a data change for a later change, not this one.

### D9: Streaming transport (added after the 7.2 end-to-end run)
The 7.2 run showed that a non-streaming request gets no response headers until generation finishes. Node fetch (undici) aborts after 300 s without headers, so any pass that generates for more than 5 minutes fails as `fetch failed`. The server also keeps generating the abandoned request, and with `--parallel 1` the next pass queues behind it.
`vlmChat` therefore sends `stream: true` and assembles the answer from the server-sent-event deltas:
- `content` deltas are concatenated into the stored response. The stored text stays exactly what the model answered, because it's rebuilt byte-for-byte from the stream.
- `finish_reason` is taken from the last chunk that carries one.
- `reasoning_content` deltas are counted but not stored.

Headers arrive immediately, so the headers timeout no longer applies. A per-request budget (`VLM_TIMEOUT_MS`, default 15 min) aborts through an `AbortController`. That closes the connection. llama.cpp cancels a streaming generation when its client disconnects, but Lemonade sits in between as a proxy, so whether the abandoned pass actually frees the slot is an assumption that task 8.2 verifies with `is_busy` from `/v1/health`.
The one transport retry is kept, but only for errors before the first chunk (connection refused or reset). A request that dies mid-stream, or hits the budget, is not retried inside the pass; it becomes a failed pass that the battery retries next time. That stops a slow pass from costing twice its budget.
*Alternative*: keep non-streaming and raise undici's `headersTimeout` through a custom `Agent`. Rejected because it needs the `undici` package as a dependency, and it still leaves abandoned generations blocking the slot.

## Risks / Trade-offs

- **[Leading-"no " rule misfires on a real term starting "no " (with a space)]** → vocab terms are kebab-case, so a seeded term never contains a space. Only free-text prose can trigger the rule, and prose that starts with "no" is a negation.
- **[4096 max_tokens still too small if the model reasons at length]** → the finish reason is now recorded and the failure is retryable. The next real run shows whether to raise it further or disable thinking.
- **[Intent battery is ~8× the calls of the vibe pass]** → acceptable for a single-user tool on a one-at-a-time server. Progress stays visible because pass rows persist as passes settle.
- **[Stating the family biases the model toward family-typical answers]** → the family is human-confirmed, and the only bias it adds is toward what is already true. Answers still come from the image or intent.
- **[Health endpoint is up while the model backend is wedged]** → preflight is a fast-fail for the common down case only. The one existing transport retry still applies per pass, and failures stay retryable.
- **[Sequential battery inside one server action is long-running]** → unchanged from today. Moving it off the request is the planned worker change.

## Migration Plan

1. `npm run db:migrate` adds the nullable `import_passes.finish_reason` column. Existing rows get null, and no data is rewritten.
2. There are no open runs today (all 3 are accepted or discarded), so no in-flight run needs re-parsing. Re-parse is available on open runs from then on.
3. Rollback: revert the code. The extra nullable column is harmless to the previous version.

## Open Questions

- Did the empty heel and platform responses come from reasoning-token exhaustion (content empty, `finish_reason: "length"`) or from something else? D2 records the answer on the next real run. The only follow-up it could trigger is a constant change (`max_tokens`, or `chat_template_kwargs.enable_thinking: false`).
