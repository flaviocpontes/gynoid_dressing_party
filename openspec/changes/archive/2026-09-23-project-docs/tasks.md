## 1. Documentation Artifacts

- [x] 1.1 Write `README.md` at repo root covering purpose and lineage, core domain concepts, tech stack, bootstrap, repo layout, and roadmap with multi-model generation as the next milestone — verify the file exists and contains all six sections
- [x] 1.2 Write `AGENTS.md` at repo root covering commands, architecture map, conventions, generation environment pointers (Lemonade server, legacy knowledge base), and anti-patterns — verify the file exists and contains all five sections
- [x] 1.3 Populate the `context:` block in `openspec/config.yaml` with tech stack, workflow, domain glossary, design principles, north star, and constraints — verify YAML still parses and `openspec status --change "project-docs"` runs cleanly

## 2. Verification

- [x] 2.1 Run `npm test` to confirm the documentation change breaks nothing — verify all vitest suites pass (37/37 tests pass; one suite fails at collection on clean HEAD due to a pre-existing `__dirname` path bug in `tests/registry.test.ts`, proven unrelated via git-stash re-run)
