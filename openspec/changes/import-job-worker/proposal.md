## Why

Every interrogation runs inside a server action. The family pass, the whole battery and each re-ask block one HTTP request until the model finishes. Per-pass rows are saved as they complete, but the page only re-renders when the action returns, so the user watches a spinner for the whole battery. Leaving or reloading the page does not cancel or report the work. `import-pipeline-hardening`, `progressive-interrogation` and `import-auto-repair` each add inference calls per run (skeleton, repairs, retries), which makes this worse. The roadmap's bulk import of the existing ~389-sheet corpus can't run through request-bound actions at all.

**Depends on:** `import-pipeline-hardening` (preflight and failed-pass semantics move into the worker). It is independent of the other two changes and can land before or after them.

## What Changes

- **Import jobs (new).** Starting a family pass, battery, re-ask or re-run enqueues a job and returns immediately. Jobs are persisted with status (queued, running, done, failed), the error message and timestamps.
- **Import worker process (new).** `npm run import:worker` runs a long-lived process. It claims one job at a time, which matches the one-request-at-a-time server, and runs it through the existing pipeline functions. Jobs left running by a crashed or stopped worker are re-queued when the worker starts.
- **Live progress (new).** While a run has a queued or running job, the review page refreshes itself. Each pass shows up as it lands, along with the job's state.
- **Worker-down notice (new).** If a job stays queued for more than 15 seconds and nothing is running, the page says the worker appears to be stopped and shows the command that starts it.
- **Cross-process-safe sheet writes.** Working-sheet read-modify-write moves from the in-process lock to a SQLite write transaction, because the worker and the web server now both write it.
- **Preflight moves into the job.** An unreachable inference server fails the job with the hardening preflight error. The error appears on the review page, and no pass rows are written.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shoe-import`: adds "Background interrogation jobs", "Live progress on the review surface" and "Worker availability notice". Existing requirements are unchanged. The hardening preflight requirement is still met, with the job failure as the surfaced error.

## Impact

- **Code:** `src/db/schema.ts` (`import_jobs` table), `src/lib/jobs.ts` (new: enqueue, claim, complete, fail, requeue stale), `scripts/import-worker.ts` (new), `src/lib/import.ts` (transactional sheet writes replace `withRunLock`), `src/app/shoes/import/actions.ts` (enqueue instead of execute), the review page plus a small client component that refreshes the page while jobs are active.
- **Scripts:** `package.json` gains `"import:worker": "tsx scripts/import-worker.ts"`. There are no new dependencies.
- **Operations:** running imports now takes two processes (`npm run dev` and `npm run import:worker`). README and AGENTS.md need updating.
- **Enables:** a later bulk-import change, which can enqueue many runs.
