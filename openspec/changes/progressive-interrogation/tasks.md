## 1. Skeleton definition and prompt

- [ ] 1.1 Define `SKELETON_FIELDS` in `src/domain/import/battery.ts`, choosing concrete paths from `EDITOR_SECTIONS` (toe shape, heel type, platform presence, strap presence, shaft height gated to boot families) (design D1). Verify with a test that every path resolves via `resolveFieldSpec`, and that `isApplicable("pump", …)` excludes the shaft entry.
- [ ] 1.2 Add the `skeleton` pass key and prompt, and exclude skeleton paths from section field listings. Bump `TEMPLATE_VERSION` to `shoe-import/3`. Verify with tests: the pump skeleton prompt lists no shaft field, and no section prompt lists a skeleton path.

## 2. Context forwarding

- [ ] 2.1 Implement a pure `buildContextBlock(sheet, family, reg)`: committed single values and absences only, user value first, step ids rendered as their first phrase, wrapped in fixed begin/end markers (design D2). Verify with tests for the spec scenarios "Committed value forwarded", "Hedge not forwarded" and "User value wins", plus an assertion that the block contains no digits.
- [ ] 2.2 Inject the block into section prompts after the family line, and add the optional `contextDisagreements` key to the answer contract. Verify with a test that a heel prompt built from a sheet with heel type "stiletto" contains the block and the key instructions.

## 3. Merge rules

- [ ] 3.1 Parse `contextDisagreements` in `parsePassResponse` through the field parser, ignoring non-forwarded paths (design D3). Verify with tests: a valid disagreement is emitted; a digit-bearing disagreement is rejected with a note; a disagreement on a non-forwarded path is ignored.
- [ ] 3.2 Extend `applyPassToSheet` with the disagreement and conflict rules: vocab and text fields union, scale fields keep the earlier value plus a note, group rows are replaced, `re-ask:` and `repair:` replace, user-owned fields only get notes (design D3, D4). Verify with tests for each spec scenario under "Context disagreement becomes a decision" and "Cross-pass conflicts become choice-sets".

## 4. Orchestration and staleness

- [ ] 4.1 Run the skeleton first in `executeBattery`, and build each section prompt from the working sheet as it stands (design D6). Verify with an integration test: pass order is skeleton, then sections; the stored heel prompt contains the committed skeleton heel type.
- [ ] 4.2 Implement a pure `staleSections(passes, sheet, family, reg)` and a `force` option on `executeBattery` (design D5). Verify with integration tests for "Edited skeleton marks sections stale" and "Re-run appends": row count grows, and earlier rows are byte-identical.

## 5. Review surface and verification

- [ ] 5.1 Review page: a conflict badge on fields with a cross-pass or disagreement note, a stale-sections notice with a "re-run sections" button, and the skeleton pass shown first in the pass log. Verify with `npx tsc --noEmit`, and by running `npm run dev` and using a stubbed or real run to see the badge, the notice and the re-run.
- [ ] 5.2 Run `npm test`. Then do one end-to-end image import against Lemonade, and record in the archive notes: fill rate compared with the post-hardening baseline, the number of conflicts, and the number of disagreements reported.
