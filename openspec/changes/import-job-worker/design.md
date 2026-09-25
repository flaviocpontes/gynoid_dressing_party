# Design: import-job-worker

## Context

- **Where interrogation runs.** Server actions in `src/app/shoes/import/actions.ts` call `executeFamilyPass`, `executeBattery` and `executeReAsk` from `src/lib/import.ts` and await them. The page is re-rendered only through `revalidatePath` when the action returns.
- **Current lock.** Working-sheet updates are serialized by `withRunLock`, a promise chain held in a module-level `Map`. It only protects writers inside the same Node process.
- **Database.** `src/db/db.ts` opens better-sqlite3 with `journal_mode = WAL`, so a second process can read and write safely. SQLite allows one writer at a time, and a `BEGIN IMMEDIATE` transaction takes the write lock up front.
- **Server.** The Lemonade server has one LLM slot. Pipeline functions already take their dependencies (`db`, `reg`, `vlm`, and `preflight` after hardening) as arguments, so a worker can call them as they are.

The motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- No new dependencies. SQLite is the queue, `tsx` runs the worker, and polling does the live updates.
- The pipeline functions stay as they are. The worker is a thin loop around them.
- Crash-safe by construction: a job re-run executes only missing or failed passes, which the battery already guarantees.

**Non-Goals:**
- Cancelling a running job mid-inference.
- Priorities, multiple workers, or remote workers.
- Starting the worker automatically from `npm run dev`. Two explicit processes keep the model simple, and the availability notice covers forgetting.
- Bulk import itself. That is a later change.

## Decisions

### D1: `import_jobs` table as the queue
Columns: `id`, `run_id` (FK, cascade), `kind` (`family | battery | reask | rerun`), `args` (JSON, e.g. `{ path }` for a re-ask, `{ force: [...] }` for a re-run), `status`, `error`, `created_at`, `started_at`, `finished_at`. There is an index on `(status, created_at)`.
- **Claim:** one transaction that selects the oldest queued job and updates it to running with `started_at` set. This is safe because only one worker exists, and the transaction still guards against a stray second worker.
- **Dedupe:** enqueue checks for a queued or running job with the same `run_id` and `kind` inside the same transaction. Re-asks for different paths are not duplicates, so `args.path` is part of the key for `reask`.

*Alternative*: an in-process queue inside the Next server. Rejected because Next dev reloads modules and restarts, which would lose jobs, and bulk import needs durability.

### D2: The worker loop
`scripts/import-worker.ts`:
- On start, it re-queues running jobs, then loops: claim → dispatch by kind to the existing pipeline function (with `getDb()`, `loadRegistrySync`, `vlmChat` and `vlmHealth`) → mark done, or mark failed with `error.message`.
- It sleeps 1 s when the queue is empty and handles `SIGINT`/`SIGTERM` by finishing the current job first.
- The registry is reloaded per job, which is cheap and picks up seed changes.
- Preflight failures (`InferenceUnreachableError`) fail the job and write no pass rows, because preflight runs before any pass (hardening D6).

### D3: Transactions replace `withRunLock`
The working-sheet read-modify-write (`applyToSheet`, `mutateField`, `setIdentity`, `reparseRun`, `confirmFamily`) runs inside `db.transaction(() => { read; compute; write })` using better-sqlite3's synchronous transaction, which begins as `IMMEDIATE`. The merge logic is pure and synchronous (hardening D5), so the transaction body needs no `await`. `withRunLock` is deleted.
*Alternative*: keep the lock and route all writes through the worker. Rejected because review edits must stay instant, and the database already provides the lock.

### D4: Live progress by polling
A client component, `<RunAutoRefresh active={hasActiveJob} />`, calls `router.refresh()` every 2 s while `active` is true. The server page computes `hasActiveJob` from `import_jobs` on each render, so the loop stops by itself when the last job finishes. Pass rows appear because the page is fully server-rendered.
*Alternative*: SSE streaming. Rejected because it adds a route and connection handling, and 2 s polling of a local SQLite-backed page is cheap for a single user.

### D5: Availability notice is derived
The page shows the notice when the run's oldest queued job has `created_at` more than 15 s ago and no job in the table is running. No heartbeat table is needed. A long job for another run shows up as a running job and correctly suppresses the notice.

## Risks / Trade-offs

- **[Two processes to remember]** → the notice names the command, and README and AGENTS.md list both.
- **[A job re-queued after a crash re-sends a pass that had already been sent but not stored]** → one duplicate inference call at most. Pass rows are stored after the response arrives, so there is never a half-written row.
- **[A write transaction blocks while the other process writes]** → better-sqlite3 waits up to its default busy timeout (5 s). Transactions are microseconds of pure computation plus one JSON write, and inference never runs inside a transaction.
- **[`router.refresh()` every 2 s re-renders the whole review page]** → acceptable for a single user. Revisit only if the review page gets heavy.

## Migration Plan

1. `npm run db:migrate` adds `import_jobs`.
2. Deploy is a restart plus starting `npm run import:worker`.
3. There are no open runs to migrate. The first action after the upgrade enqueues work.
4. Rollback is a code revert (actions execute inline again). The `import_jobs` table can stay or be dropped.
