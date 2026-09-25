## Why

After `import-pipeline-hardening`, section passes know the human-confirmed family but still know nothing of each other. The heel pass can't use "this shoe has a platform", and the upper pass can't use "the heel is a stiletto". When two passes answer the same field, the later one silently overwrites the earlier one (`applyToSheet` is last-writer-wins). The result is that cross-section consistency is left entirely to the reviewer. Letting later passes build on established structure should raise both consistency and fill rate. It has to be done without letting one wrong machine answer spread through the whole sheet.

**Depends on:** `import-pipeline-hardening` (family-aware prompts, pure merge function, re-parse). Implement and archive it first.

## What Changes

- **Skeleton pass (new).** After the family checkpoint and before the section battery, one pass asks only a small, fixed set of structural fields. These are defined as data (e.g. toe shape, heel type, platform presence, strap presence, shaft presence for boot families).
- **Committed context forwarding (new).** Each section prompt carries an "established so far" block. It holds the committed skeleton answers (single values and explicit absences) plus any value the user has already set on a skeleton field. Hedged answers, unfilled fields and notes are never forwarded. The block is framed as orientation the source overrides. Skeleton fields are not asked again in section passes.
- **Disagreement becomes a decision (new).** A section pass may report that the source contradicts a forwarded value. The field then becomes a choice-set of both values with a conflict note. The existing acceptance gate turns this into a decision for the reviewer rather than a silent override.
- **Cross-pass conflicts become choice-sets (new).** When two machine passes propose different values for the same field, the field holds both as a choice-set flagged "cross-pass conflict" instead of keeping only the last one. Targeted re-asks and user edits still replace the value outright.
- **Stale context notice (new).** If a skeleton field changes after section passes used it (user edit or re-ask), the review surface says which sections ran on outdated context. It offers "re-run sections", which appends new pass rows and never rewrites old ones.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shoe-import`: adds the skeleton pass, committed context forwarding, context disagreement handling, cross-pass conflict choice-sets, and the stale-context notice with re-run. Existing requirements are unchanged, so all deltas are ADDED.

## Impact

- **Code:** `src/domain/import/battery.ts` (skeleton field list as data, skeleton prompt, context block, skeleton fields excluded from sections), `src/domain/import/parse.ts` (reserved `contextDisagreements` key), `src/domain/import/merge.ts` (conflict choice-sets; from hardening), `src/lib/import.ts` (skeleton before sections, staleness, forced section re-run), the review page (conflict flags, stale notice, re-run button).
- **Schema:** none. Context lives in the verbatim stored prompt. Staleness is derived from pass order and the current working sheet.
- **Template version:** `shoe-import/3`.
- **Cost:** one extra inference call per run (the skeleton pass). Section prompts get shorter, since skeleton fields are no longer repeated.
