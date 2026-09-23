"use client";

import { useState, useTransition } from "react";
import { setProseAction } from "@/app/actions";

export default function ProseEditor({ slug, initial }: { slug: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-lg font-semibold">Prose description</h2>
      <p className="mt-1 text-xs text-neutral-400">The canonical post-generation description, stored verbatim.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Describe the shoe as rendered…"
        className="mt-3 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
      />
      <button
        disabled={pending}
        onClick={() => start(async () => {
          await setProseAction(slug, text);
          setStatus("Saved");
        })}
        className="mt-2 rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save prose"}
      </button>
      {status && <span className="ml-2 text-xs text-green-400">{status}</span>}
    </section>
  );
}
