## Why

Many machine answers are close but unusable: a scale answer that isn't a step reference, a hedged scale answer (scale fields hold one step), a digit-bearing value, an unparseable pass, or a choice-set on a photo that a second, focused look would settle. Today each one needs a human to click "re-ask", which is the most repetitive part of review. The model can fix most of these itself if it's told exactly what was wrong. Separately, much of the parsing trouble would go away if the server constrained the answer shape.

**Depends on:** `import-pipeline-hardening` (the `repair:` key is treated like `re-ask:` in the merge; failed-pass classification). It works alongside `progressive-interrogation` (repairs can resolve conflict choice-sets) but does not require it.

## What Changes

- **Automatic repair round (new).** After each pass, the system gathers that pass's repairable outcomes and sends one repair request covering all of them. Repairable outcomes are: rejected scale answers (not a step reference, wrong scale, hedged), digit-bearing rejections, and, on image runs only, choice-sets and cross-pass conflicts. The repair prompt quotes the rejected answer, states why it was rejected, and lists the valid options. There is at most one repair round per pass and no looping. Whatever is still unresolved goes to the human as today.
- **Intent runs keep creative choice-sets.** On intent runs, choice-sets are left alone by automatic repair. The original spec treats them as deliberate creative choices for the reviewer.
- **Failed passes retried once automatically.** A pass classified as failed is re-sent once within the same battery run before it's left for a manual retry.
- **Targeted re-ask requirement updated.** The "no automatic multi-round looping in this version" clause is replaced by the bounded single repair round. Manual re-ask is unchanged.
- **Structured answer constraint (new, conditional on server support).** When the inference server supports JSON-schema-constrained output, each pass sends a schema generated from its fields. Scale fields are restricted to their step ids plus the sentinels, and each field is an optional key. The schema is stored with the pass. If the server does not support it, passes run unconstrained exactly as today.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shoe-import`: modifies "Targeted re-ask refinement" (the automatic single repair round replaces the no-automation clause). Adds "Automatic repair round" and "Structured answer constraint".

## Impact

- **Code:** `src/domain/import/repair.ts` (new, pure: selects repairable outcomes and builds the repair prompt), `src/domain/import/schema-gen.ts` (new, pure: builds the JSON schema for a pass), `src/lib/import.ts` (repair round after each pass, one automatic retry of a failed pass), `src/lib/vlm.ts` (optional `responseFormat`), the review page (repair rows in the pass log, "auto-repaired" provenance label).
- **Schema:** adds a nullable `import_passes.response_schema` column (the constraint that was sent, verbatim).
- **Cost:** up to one extra inference call per pass that had repairable outcomes, plus at most one retry per failed pass. It's bounded, and on the one-at-a-time server it adds time, not load. That is a strong reason to have `import-job-worker` in place.
- **Unknown:** whether Lemonade's llama.cpp backend passes `response_format: json_schema` through. Task 1.1 probes this first, and the constraint work is conditional on the result.
