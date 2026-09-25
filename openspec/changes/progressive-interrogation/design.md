# Design: progressive-interrogation

## Context

This builds on the state left by `import-pipeline-hardening` (see its design): a pure `applyPassToSheet` in `src/domain/import/merge.ts`; family-aware, applicability-filtered section prompts; `reparseSheet`; `isFailedResponse`; one-at-a-time execution; and user-owned fields that machine passes never overwrite. The motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- Layered, not chained: two layers (skeleton → sections), and only committed or user values cross the boundary.
- Every forwarding and conflict rule is a pure function in `src/domain/import/`, covered by tests.
- No schema change. Context is recoverable from the stored prompt text, and staleness is derived from it.

**Non-Goals:**
- Any section-to-section forwarding (e.g. the upper pass feeding the heel pass). If the skeleton proves out, that is a later change.
- A human checkpoint on the skeleton. It flows straight into the battery, and disagreements and review cover mistakes.
- Automatic resolution of conflicts. Resolving them is the reviewer's job (or `import-auto-repair`'s).

## Decisions

### D1: Skeleton fields are data, family-gated
`SKELETON_FIELDS: string[]` in `battery.ts` holds paths such as `silhouette.toeShape`, `heel.type`, the platform presence step, `shaft.heightStep` (boot families only, via `isApplicable`), and whether straps are present. The exact paths are fixed in task 1.1 against `EDITOR_SECTIONS`. The skeleton prompt reuses `fieldLine` so it matches section prompts.
Presence-style questions ("is there a platform?") are answered with the field's own value states: a step id, or `not-present` where absence is legal. No new boolean fields are introduced.
*Alternative*: let the model pick the "important" fields. Rejected because it isn't reproducible, and staleness detection needs a fixed list.

### D2: Context block is built from the working sheet, not the pass log
`buildContextBlock(sheet, family)` reads the current working sheet. For each skeleton path it emits the value when that value is a single string, a step id or `{ absent: true }`, taking a user-provenance value first. The block is rendered as:
```
Established so far (orientation only; if the source clearly shows otherwise, report it under "contextDisagreements"):
- heel.type: stiletto
- platform.heightStep: absent
```
Step ids are rendered as their first phrase, not the id. That keeps digits out of the forwarded text, and the model already sees the step list in the heel prompt.
*Alternative*: forward from the skeleton pass row's proposals. Rejected because user edits made before the sections run must win (spec: User value wins).

### D3: Disagreements use a reserved key
The answer contract gains an optional `"contextDisagreements": { "<path>": "<observed value>" }`. `parsePassResponse` validates each entry through the same field parser (so digits and step references are handled the same way) and emits `Disagreement` records. In `applyPassToSheet`:
- a machine-owned field becomes the choice-set `[forwarded, observed]` plus a note;
- a user-owned field only gets a note.
The key is ignored for paths that weren't forwarded.

### D4: Conflict merge rule in `applyPassToSheet`
For a machine proposal on a machine-owned field that already has a value:
- equal values → no change;
- the new pass key starts with `re-ask:` or `repair:` → replace;
- otherwise → union into a choice-set and record the note `cross-pass conflict: <passA> vs <passB>`.

Conflicts are unioned only for vocab and text fields. A scale field can hold only one step id, so a scale conflict keeps the earlier value and records a note (the reviewer or a re-ask resolves it). Group rows (straps, adornments) are never unioned: they are replaced by the section that owns them, which only one section does.

### D5: Staleness is derived by re-reading stored prompts
The context block is written verbatim into each section prompt between fixed markers. `staleSections(passes, sheet)` parses the block back out of each section pass's `prompt_text` and compares it with `buildContextBlock(sheet)` for the current sheet. Any section whose latest successful pass received a different block is stale. "Re-run sections" calls the battery with `force: staleKeys`, which bypasses the has-succeeded skip for those keys only.
*Alternative*: a `context_hash` column. Rejected because it's derivable, and the prompt text is the source of truth.

### D6: Execution order
`executeBattery` runs the skeleton first when no successful skeleton pass exists, then builds each section prompt from the working sheet as it stands at that moment. The skeleton result is merged before the first section is built, which one-at-a-time execution guarantees. Re-parse (from hardening) replays skeleton and sections in stored order, and doesn't need to recompute context, because the prompts already contain it.

## Risks / Trade-offs

- **[A wrong committed skeleton answer anchors every section]** → it is framed as orientation; there is an explicit disagreement channel; staleness plus re-run after the reviewer corrects it; and only single committed values are forwarded.
- **[Models rarely use the disagreement key]** → measure it. If disagreements never appear during the task 5.2 end-to-end run, the anchoring risk is real, and the next step is independent re-asking of one skeleton field per section as a check.
- **[Conflict choice-sets add review burden]** → each one is real signal, and `import-auto-repair` can resolve them with a targeted repair question.
- **[Parsing the context back out of stored prompts is brittle across template versions]** → fixed begin/end markers, versioned by `TEMPLATE_VERSION`. A prompt without markers counts as "unknown context" and is never reported stale.

## Migration Plan

No schema change. Runs started before this change have no skeleton pass. Their next battery run will skip the skeleton, because their sections have already succeeded, unless the user uses re-run. Rollback is a code revert.
