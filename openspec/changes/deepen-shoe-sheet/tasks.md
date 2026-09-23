# Tasks: deepen-shoe-sheet

## 1. Vocabulary harvest

- [ ] 1.1 Write `scripts/harvest_legacy_vocabs.py` that parses the legacy shoe sheet template (throat, quarter style, topline finish, toe box structure, heel seat, heel breast finish, heel breast profile, welt type, welt visibility, outsole style, outsole finish, insole cushioning, counter rigidity, counter grip, hardware type, strap type, strap anchor, strap closure, transition wrap, transition edge) into kebab-case `{value}` entries and writes `seed/vocabularies_deep.json`; verify by running it and inspecting the diff for term quality
- [ ] 1.2 Extend `scripts/seed.ts` to load `seed/vocabularies_deep.json` alongside the existing file (deduping by vocabulary id); verify `npm run db:seed` loads the new vocabularies and the registry lookup returns throat terms

## 2. Schema deepening

- [ ] 2.1 Extend `shoeDetails` in `src/domain/shoe.ts`: heel breast profile, lift internal, counter section (rigidity, grip), hardware section (type, finish), outsole style and finish, insole cushioning, transition section (wrap, edge), and expose top-piece shape/acoustic already present; add vitest cases parsing each new field and rejecting unknown absence paths
- [ ] 2.2 Add `straps` array to `shoeDetails` (type required per row; widthStep, material, hardwareFinish, anchor, closure, note optional) following the adornments pattern; verify with vitest that a full strap row parses, an empty array is dropped like adornments, and a type-less row is rejected
- [ ] 2.3 Add `sheetKind` ("authored" | "imported", default "authored") to `shoeCreateInput`/`shoeUpdateInput` and a `sheet_kind` column to `src/db/schema.ts`; verify `npm run db:migrate` applies and existing shoes read back as "authored"

## 3. Applicability

- [ ] 3.1 Create `src/domain/applicability.ts` with the family-group → N/A-paths data table (launch scope: shaft gated to boot/bootie/shootie) and `isApplicable(family, path)` lookup; verify with vitest that shaft paths are inapplicable for pump/sandal and applicable for boot, and ungated paths (straps, heel) are applicable everywhere

## 4. Compiler clauses

- [ ] 4.1 Add the straps clause emitter (sheet order, width adjectives with extreme-zone stacking via `getStep`, material/hardware/anchor/closure joined naturally) placed after the upper narrative; verify with vitest fixtures covering two-strap order, stacked top-zone width, and absence of the clause when no straps
- [ ] 4.2 Add transition, counter, hardware, outsole-style/finish, and heel-clause extension (breast finish/profile, lift external/internal) emitters in fixed house order; verify with vitest that each clause emits only when its fields are filled and that a sheet with no new fields compiles byte-identically to the previous compiler output
- [ ] 4.3 Assert the no-numbers invariant holds over all new clause paths: vitest property-style check that compiled fixtures for new fields contain no digits (mirrors `containsDigits` usage)

## 5. Lint rules

- [ ] 5.1 Add applicability-violation warnings driven by `APPLICABILITY` and the absence-vs-filled relation table (first pair: fastening absent vs straps with closure filled); verify with vitest that shaft-on-pump warns, shaft-unfilled-on-pump stays silent, and the boot-missing-shaft rule still fires
- [ ] 5.2 Add assertiveness warnings for imported sheets (unresolved choice-sets) keyed off `sheetKind`; verify with vitest that imported + choice-set warns, authored + choice-set stays silent, and warnings never block (lint returns, not throws)

## 6. Editor exposure (minimal)

- [ ] 6.1 Extend `src/lib/field-specs.ts` with the new sections/fields and a `kind: "group"` spec for straps; render group rows in `ShoeEditor` with existing widgets plus add/remove row buttons, and a sheet-kind selector in the identity block; verify by editing a shoe in the dev server, filling a strap row and a throat value, saving, and seeing values round-trip

## 7. Integration verification

- [ ] 7.1 Run `npm test` (all suites green), `npm run build` (clean typecheck), and a manual end-to-end pass: seed → edit shoe with straps/transition/deep heel → lint shows no false positives on a clean pump sheet → compile shows new clauses → "Mark used" snapshot retains text after further edits
