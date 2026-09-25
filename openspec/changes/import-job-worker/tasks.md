## 1. Queue

- [ ] 1.1 Add the `importJobs` table to `src/db/schema.ts` (design D1) and run `npm run db:migrate`. Verify the table and its `(status, created_at)` index exist via `PRAGMA index_list(import_jobs)`.
- [ ] 1.2 Implement `src/lib/jobs.ts`: `enqueueJob` (transactional dedupe), `claimNextJob`, `completeJob`, `failJob`, `requeueStale`, `activeJobs(runId)`. Verify with integration tests on a temp DB: oldest-first claim, dedupe per `(run, kind)` (per path for `reask`), re-queueing of running jobs, and failure storing the error.

## 2. Cross-process-safe writes

- [ ] 2.1 Replace `withRunLock` with synchronous better-sqlite3 transactions for every working-sheet read-modify-write in `src/lib/import.ts` (design D3). Verify that all existing import integration tests pass. Add a test that opens two `getDb()` connections to the same temp file and interleaves a merge and a `mutateField` without losing either write.

## 3. Worker

- [ ] 3.1 Write `scripts/import-worker.ts` with the loop from design D2 (requeue on start, claim, dispatch, done/failed, 1 s idle sleep, graceful signal handling), and add the `import:worker` script to `package.json`. Verify with an integration test that drives one loop iteration with a stub VLM, covering done and failed (preflight) outcomes, plus a manual `npm run import:worker` start/stop that logs the re-queue and a clean exit on Ctrl-C.
- [ ] 3.2 Verify the spec scenario "Crashed worker's job resumes" as a test: mark a battery job running with some passes already succeeded, run `requeueStale` and the loop, and confirm that only the missing passes execute.

## 4. Actions and review surface

- [ ] 4.1 Switch the family, battery, re-ask and re-run server actions to `enqueueJob` followed by `refresh`. Verify with `npx tsc --noEmit`, and check that the action returns without calling the VLM (a test with a VLM stub that throws if called).
- [ ] 4.2 Add a `RunAutoRefresh` client component (2 s `router.refresh()` while active), job status display, the failed-job error display (including inference-unreachable), and the worker-down notice (design D4, D5). Verify with `npm run dev` and the worker running: start a battery and watch passes appear without reloading and refreshing stop at the end. Then stop the worker, start a battery, and confirm the notice appears after 15 s.

## 5. Docs and verification

- [ ] 5.1 Update README (Bootstrap) and AGENTS.md (Commands, Architecture) with `npm run import:worker`, and explain that imports need it running. Verify by reading the updated docs.
- [ ] 5.2 Run `npm test`, then do one end-to-end image import through the worker against Lemonade. Confirm the page stays responsive and shows progress throughout.
