"use client";

import { useState, useTransition } from "react";
import { compilePromptAction, snapshotPromptAction } from "@/app/actions";

export default function CompilerPanel({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-lg font-semibold">Generation prompt</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Compiled from filled fields only. Hand-edit freely; &quot;Mark used&quot; snapshots the text verbatim.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => start(async () => { setText(await compilePromptAction(slug)); setStatus(null); })}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
        >
          Compile
        </button>
        <button
          disabled={pending || !text.trim()}
          onClick={() => start(async () => {
            await snapshotPromptAction(slug, text);
            setStatus("Snapshot saved — it will survive future sheet edits.");
          })}
          className="rounded border border-neutral-600 px-3 py-1.5 text-sm hover:border-neutral-300 disabled:opacity-50"
        >
          Mark used
        </button>
        {status && <span className="self-center text-xs text-green-400">{status}</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Press Compile, or paste a hand-written prompt here…"
        className="mt-3 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs"
      />
    </section>
  );
}
