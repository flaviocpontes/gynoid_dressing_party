# Proposal: shoe-import-pipeline

## Why

Two of the four shoe-creation paths produce a *draft sheet by machine* instead of by hand: importing an existing shoe from a photo (VLM interrogation) and generating a base design from a vibe prompt (LLM). Today both are impossible — every sheet is typed by hand into the editor. A single VLM call cannot extract the extreme detail the deepened sheet supports (attention budget dilution), so import needs a gated, multi-pass interrogation pipeline with a human review surface on top. `deepen-shoe-sheet` (in flight) supplies the deep schema, applicability gating, and the imported/authored sheet-kind distinction this pipeline consumes.

## What Changes

- **Import runs**: a new wizard flow at `/shoes/import` that starts a run from an uploaded image (VLM path) or a free-text intent prompt (vibe path). Runs are persisted server-side as drafts with their source, so the flow survives navigation and every machine answer keeps provenance.
- **Family gate with human checkpoint**: pass 0 interrogates only gross architecture (upper family); the user confirms or corrects before anything else runs. One click, and every later pass gets smarter.
- **Family-gated interrogation battery**: section passes (heel, upper, transition, platform, outsole, hardware/straps, adornments, shaft for boots, sensory) selected via the applicability table, each pass asked focused questions derived from the sheet template (field specs + vocabulary terms + scale anchors), run in parallel after the checkpoint.
- **Assertive response semantics**: parsed VLM answers map to the sheet's value states — committed value → single, hedged answer → choice-set (transient), confirmed-not-present → absence proposal (only where absence is defined), cannot-discern → unfilled. Magnitude questions present step anchors and the model returns scale step ids; digit-bearing values are rejected to unfilled (no numerics ever enter the sheet).
- **Pass provenance**: every pass stores its template version, verbatim prompt, and verbatim response as immutable rows — the snapshot philosophy extended to interrogation.
- **Review surface**: side-by-side source (image or intent text) and proposed sheet; every machine-filled field flagged with its provenance; per-field accept/edit/resolve/absent/clear actions; contradiction lint runs live over the assembled proposals; acceptance is blocked while choice-sets remain unresolved or identity fields are missing.
- **Accept creates the shoe**: image imports create shoes with sheet kind "imported"; vibe imports create "authored" sheets (a generated design is not a real existing shoe — choice-sets stay legal). The source image stays attached to the run (linked to the resulting shoe), not to the shoe's image set.
- **Targeted re-ask**: for any flagged or hedged field, a one-question follow-up pass that refines just that field; refinement ends when the user stops or answers commit no new detail. Zoom/crop escalation is explicitly out of scope for v1.

## Capabilities

### New Capabilities

- `shoe-import`: draft-producer pipeline that turns a source image or intent text into a reviewed, assertive shoe sheet via gated multi-pass model interrogation with full provenance.

### Modified Capabilities

(none — sheet kind, applicability, assertiveness lint, and the deep schema land in `deepen-shoe-sheet`; this change only consumes them.)

## Impact

- New DB tables `import_runs` / `import_passes` (insert-only; drizzle push, no existing-table changes)
- New pure domain modules under `src/domain/import/` (battery selector, pass-template builder, response parser) — vitest-covered, zero I/O
- New `src/lib/import.ts` (run/pass data access) and `src/lib/vlm.ts` (Lemonade chat-completions client — local homelab inference server, sanctioned by the AGENTS generation-environment section, not a public SaaS dependency)
- New wizard/review UI at `src/app/shoes/import/` plus server actions
- Runtime dependency: Lemonade server reachable at 192.168.0.20:13305 when a run is executed; the review surface and pass log remain usable offline
- Prerequisite: `deepen-shoe-sheet` must be implemented first (applicability table, straps/deep fields, sheet kind)
