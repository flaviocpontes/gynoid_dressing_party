# Design: import-auto-repair

## Context

After `import-pipeline-hardening`, `parsePassResponse` returns proposals and notes. The notes already carry the reason for each rejection (digit-bearing, not a step reference, wrong scale, hedged scale), but only as free text. `applyPassToSheet` treats `re-ask:` keys as authoritative replacements, and `isFailedResponse` classifies failures. `vlmChat` sends plain chat completions. The `lemonade-server` skill reference lists the chat parameters Lemonade documents (`temperature`, `top_p`, `tools`, `max_tokens`, …) and does **not** list `response_format`. Its llama.cpp backend supports JSON-schema grammars natively, but whether Lemonade forwards the field is unverified. The motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- Repair is bounded by construction (one repair pass per pass, one retry per failed pass). No loop can form.
- Selecting repairable outcomes and building the repair prompt are pure and tested.
- The structured-output work is fully optional at runtime and gated on a probe.

**Non-Goals:**
- Self-consistency sampling or second-model verification (a later eval-oriented change).
- Automatically repairing cannot-discern answers. "I can't see it" is an honest answer, not an error.
- Repairing group rows (straps, adornments) field by field. A group with no usable rows is left for manual re-ask.

## Decisions

### D1: Parser notes become structured outcomes
`PassNote` gains a `code`: `digits | not-step-ref | wrong-scale | hedged-scale | cannot-discern | absence-illegal | not-applicable | unparseable`. The note also carries the `raw` rejected answer. The existing free-text `note` stays for display. `selectRepairs(parsed, sheet, sourceKind)` returns the repairable subset:
- codes `digits`, `not-step-ref`, `wrong-scale` and `hedged-scale`;
- on image runs, choice-set proposals and conflict notes (from `progressive-interrogation`, when present).
*Alternative*: pattern-match on note text. Rejected because it's brittle.

### D2: One batched repair prompt per pass
The pass key is `repair:<originalPassKey>`. The prompt contains the answer contract; then, per field, a block with the field line (step list or terms, as in the original prompt), `You answered: "<raw>"`, `Problem: <reason>`, and for choice-sets `Choose one of: a, b, or cannot-discern`. It is parsed by `parsePassResponse` restricted to the repaired paths. The merge treats the `repair:` prefix like `re-ask:`: committed answers replace; no proposal leaves the current value (unlike re-ask, which clears). A repair that fails to commit must never erase a choice-set the human could still resolve.

### D3: Where the round runs
`executePass` becomes: build → send → classify.
- If the pass failed and this is its first attempt, send it again once and stop there.
- Otherwise, parse → merge → `selectRepairs`. If the result is non-empty, build → send → parse → merge the repair pass.

Repair passes never trigger repairs. The rule is structural: `selectRepairs` returns empty for `repair:` keys. Manual re-asks do not trigger automatic repair either, since the user is already in the loop.

### D4: Structured output behind a probed capability
Task 1.1 sends one tiny request to the loaded interrogator model with `response_format: { type: "json_schema", json_schema: {...} }` and a schema that only an obedient model would satisfy (e.g. an enum `["zebra-violet"]`). If every reply matches, support is confirmed. The result is recorded as the constant `STRUCTURED_OUTPUT_SUPPORTED` in `vlm.ts`, with the probe evidence in the task note. It is a constant, not a runtime probe, because the server configuration is stable and a runtime probe would add a request and possibly a model reload per battery run.
`schemaForPass(passKey, reg, family)` builds the schema:
- scale field: `enum: [...stepIds, "cannot-discern"]`, or an array of that enum for hedges;
- vocab and text fields: string, or an array of strings;
- `not-present` allowed only on `ABSENCE_ALLOWED` paths;
- group fields: an array of row objects;
- `contextDisagreements` (when present) as an optional object.

It is stored verbatim in `import_passes.response_schema`. The parser stays tolerant regardless, because the schema is a filter on the answer, not a replacement for validation.
*Alternative*: GBNF grammar via a llama.cpp-specific parameter. Rejected because it isn't part of Lemonade's OpenAI-compatible surface and would tie the code to the backend.

## Risks / Trade-offs

- **[Repair confirms a wrong answer with false confidence]** → a repair row is visible in the pass log, and the field provenance reads "auto-repaired" (`repair:*`) so the reviewer can tell. The acceptance gate is unchanged.
- **[Constrained decoding degrades answer quality on some models]** → the probe only confirms support. The end-to-end comparison (task 4.2) compares fill rate with and without the constraint, and the constant can be turned off.
- **[The probe request evicts whatever LLM is loaded on the single-slot server]** → run the probe only when the user runs task 1.1, never automatically, and target the interrogator model the import already uses.
- **[More calls per run]** → bounded at 2× in the worst case. The real mitigation for wall-clock time is `import-job-worker`.

## Migration Plan

`npm run db:migrate` adds the nullable `response_schema` column. Old rows keep null. Rollback is a code revert. The column is harmless.

## Open Questions

- The probe outcome (task 1.1) only switches a constant. The tasks that depend on it are written as conditional, so no re-planning is needed either way.
