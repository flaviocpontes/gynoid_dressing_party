# Design: shoe-import-pipeline

## Context

`deepen-shoe-sheet` (prerequisite, in flight) delivers the deep schema, applicability table (`src/domain/applicability.ts`), straps sub-entity, and sheet kind with assertiveness lint. This change adds the machine draft-producer on top: Lemonade server (homelab, 192.168.0.20:13305) provides vision chat completions; the `lemonade-server` skill on this machine documents the API surface for implementation time. Existing patterns to reuse: field-specs as the sheet's data-driven definition, registry-as-value passed into pure functions, zod at boundaries, insert-only prompt snapshots, server actions + `useTransition` UI.

## Goals / Non-Goals

**Goals:**
- One wizard that turns an image or an intent into an assertive, lint-checked sheet with per-field provenance
- All decision logic pure and vitest-covered: which passes run, what each pass asks, how answers map to value states
- Every machine interaction stored verbatim — the run is its own audit log

**Non-Goals:**
- Zoom/crop or region-focused image passes (v2; requires bounding-box tooling)
- Automatic multi-round refinement loops (v1: battery + manual re-ask)
- VLM-judge/critic scoring of proposals (belongs to the north-star generation milestone with the judge bake-off policy)
- Editor rework, gallery changes, attaching the source image to the shoe's image set

## Decisions

### D1: Three-layer split — pure domain, thin lib, dumb UI
- `src/domain/import/battery.ts` — `selectBattery(family, applicability): PassKey[]`; `buildPassPrompt(passKey, specs, registry): { templateVersion, prompt }`. Zero I/O; registry and field-specs are values.
- `src/domain/import/parse.ts` — `parsePassResponse(passKey, rawText, specs): { proposals, notes }` implementing the value-state mapping (committed/hedged/absent/cannot-discern/digit-rejection). Pure, heavily tested.
- `src/lib/vlm.ts` — Lemonade chat-completions client (fetch, base64 image, model id constant `INTERROGATOR_MODEL`); the only place that knows the server exists.
- `src/lib/import.ts` — run/pass data access over the new tables.
- `src/app/shoes/import/` — wizard pages + server actions; UI renders state, owns no pipeline logic.

### D2: Pass prompts are generated, not handwritten
Each pass prompt is assembled from field-specs: section fields with labels, vocabulary term families (seeded values, capped listing with "other terms allowed"), and for scale fields the step list with anchors and a request for a step reference. A `TEMPLATE_VERSION` constant stamps every stored pass; since prompts are stored verbatim, template drift never rewrites history — the version is metadata for analysis, not a compatibility mechanism.
*Alternative*: hand-authored prompt templates per pass — rejected: duplicates the field-specs' source of truth and rots as the schema grows.

### D3: Response format — tolerant JSON extraction, prose-friendly semantics
The prompt requests JSON keyed by field path but the parser never trusts it: extract the outermost JSON block, zod-validate loosely (unknown keys ignored, all values strings or arrays). Because vocabularies accept custom terms by design, the parser kebab-cases free-text answers instead of snapping to nearest seeded term (no fuzzy matching to get wrong). Hedged answers surface as multi-value arrays → choice-set proposals. Digit regex mirrors `containsDigits` from the compiler domain.

### D4: Run state — minimal statuses, derived phase
`import_runs`: id, source_type ("image" | "intent"), source_image_path, source_intent_text, family (confirmed), working_sheet (JSON, the mutable proposal assembly), result_shoe_id, status ("open" | "accepted" | "discarded"), timestamps. `import_passes`: id, run_id, pass_key, template_version, prompt_text, response_text, proposed_fields (JSON), created_at — insert-only. Wizard phase (awaiting-family / battery / review) is derived from family confirmation + pass rows, not stored.
*Alternative*: a phase state machine column — rejected: derivable state goes stale; the pass log is the truth.

### D5: Battery execution — one action, parallel passes, per-pass persistence
A single server action `runBatteryAction(runId)` fires the selected passes with `Promise.all`; each pass independently writes its row as soon as it settles (partial progress visible), failures recorded as pass rows with empty proposals rather than aborting the run. Family pass is its own action run first. Vibe runs skip pass 0's image interrogation: one full-template text call (the battery collapsed to a single pass, since decomposition earns its keep on vision), then the same review surface.

### D6: Review surface — server-rendered state, client component for interaction
`/shoes/import/[runId]` review page composes: source panel (image or intent), sheet panel reusing the field-specs machinery over the working sheet with provenance flags (pass_key + expandable raw response per field), actions (accept/edit/resolve/absent/clear), live lint via the existing `lintShoe` on every mutation, and the accept gate (zero choice-sets, slug + display name present — server-enforced in the accept action, not just UI). Accept calls the existing `createShoe` with `sheetKind` by source type, links `result_shoe_id`.
*Alternative*: store review edits as another "user pass" row — rejected: the working sheet is mutable by design; passes record machine output only. Provenance of *edits* is out of scope (the accepted sheet is the artifact).

### D7: Source image stays on the run
Image runs store `source_image_path` (under `data/images/imports/`); the shoe page can later link to it via the run's `result_shoe_id`. No change to the shoe-images kind enum, no fake "product shot" pollution.
*Alternative*: attach as a new `source` kind image — rejected: modifies the shoe-assets image requirement for marginal gain; revisit if the editor rework wants in-page reference display.

## Risks / Trade-offs

- [VLM JSON unreliability] → tolerant extraction + kebab-case free-text acceptance + re-ask; a fully unparseable pass records itself and proposes nothing (review shows the raw text).
- [Token budget: large vocabularies in prompts] → cap listed terms per family (anchors for scale steps always complete); custom-term legality makes capping lossless.
- [Local server latency: 8-9 sequential-feeling passes] → parallel `Promise.all`, per-pass progressive rendering; a full battery on the homelab server is acceptable for a single-user tool.
- [Wrong family slips through the checkpoint] → non-catastrophic: review can edit any field, applicability lint flags stragglers, and the run can be discarded cheaply.
- [Hedged answers flood the review with choice-sets on ambiguous photos] → that is honest signal; re-ask exists precisely for this, and acceptance gating turns it into a decision list rather than silent wrong data.
- [Working sheet drift from schema evolution mid-run] → runs are short-lived; `working_sheet` is zod-validated at every mutation, so an evolved schema surfaces immediately rather than corrupting.

## Migration Plan

1. `npm run db:migrate` adds `import_runs` / `import_passes` (new tables only — rollback is dropping them; no existing data touched).
2. Deploy is a local restart; the Lemonade server must be reachable only when passes actually execute.
3. Prerequisite ordering: implement and archive `deepen-shoe-sheet` first.

## Open Questions

- Exact interrogator model id and generation parameters (temperature, max tokens) — resolve at implementation against the Lemonade server's loaded vision models and the legacy adapter evidence in `procedures/shoe_generation/local_model_adapters.md`; a constant makes this a one-line change.
- Whether the vibe path benefits from per-section decomposition for *detail depth* (vision needs it; text may not) — decide after the first vibe runs; the collapsed single-pass is the lazy default and the battery builder already exists if needed.
