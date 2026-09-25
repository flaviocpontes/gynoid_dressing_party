import Link from "next/link";
import { getDb } from "@/db/db";
import { listRuns } from "@/lib/import";
import { startImportRunAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ImportEntryPage() {
  const runs = await listRuns(getDb());

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Import a shoe</h1>
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          back to gallery
        </Link>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <form action={startImportRunAction} className="rounded border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-medium">From a photo</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Multi-pass interrogation against the homelab vision model, with a family checkpoint before the
            section battery.
          </p>
          <input
            type="file"
            name="file"
            accept="image/*"
            required
            className="mt-3 block w-full text-sm text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-neutral-700 file:px-3 file:py-1.5 file:text-sm file:text-neutral-100"
          />
          <button className="mt-3 rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
            Start image run
          </button>
        </form>

        <form action={startImportRunAction} className="rounded border border-neutral-700 bg-neutral-900 p-4">
          <h2 className="font-medium">From a design intent</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Family pass and section battery from your intent text, feeding the same review surface. Accepts as
            an authored sheet.
          </p>
          <textarea
            name="intent"
            required
            rows={3}
            placeholder="a towering black patent stripper platform pump with gold hardware"
            className="mt-3 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          />
          <button className="mt-3 rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
            Start intent run
          </button>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Open runs</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No open runs. Runs survive navigation until accepted or discarded.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-800 rounded border border-neutral-700">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <Link href={`/shoes/import/${r.id}`} className="font-medium text-neutral-100 hover:underline">
                  {r.sourceType === "image" ? "photo run" : "intent run"}
                  {r.family ? ` — ${r.family}` : r.sourceIntentText ? "" : ""}
                </Link>
                <span className="truncate text-neutral-500">
                  {r.sourceIntentText ?? r.sourceImagePath ?? r.id}
                </span>
                <span className="shrink-0 text-neutral-500">{new Date(r.updatedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
