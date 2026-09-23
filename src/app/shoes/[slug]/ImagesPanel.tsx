"use client";

import { useState, useTransition } from "react";
import {
  addImageAction, approveImageAction, unapproveImageAction, setImageOverlayAction,
} from "@/app/actions";

type ImageRow = {
  id: string;
  filePath: string;
  kind: string;
  passNumber: number;
  approved: number;
  overlay: string | null;
};

function OverlayForm({ img, slug }: { img: ImageRow; slug: string }) {
  const parsed = img.overlay ? JSON.parse(img.overlay) as { resolved?: Record<string, string>; deviations?: string[]; defects?: string[] } : {};
  const [resolved, setResolved] = useState(
    Object.entries(parsed.resolved ?? {}).map(([k, v]) => `${k} = ${v}`).join("\n"),
  );
  const [deviations, setDeviations] = useState((parsed.deviations ?? []).join("\n"));
  const [defects, setDefects] = useState((parsed.defects ?? []).join("\n"));
  const [pending, start] = useTransition();

  return (
    <div className="mt-2 space-y-2 rounded border border-neutral-800 p-2">
      <textarea value={resolved} onChange={(e) => setResolved(e.target.value)} rows={2}
        placeholder={"resolved fields (key = value per line)\nheel.type = stiletto"}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs" />
      <textarea value={deviations} onChange={(e) => setDeviations(e.target.value)} rows={2}
        placeholder="deviations vs sheet (one per line)"
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs" />
      <textarea value={defects} onChange={(e) => setDefects(e.target.value)} rows={2}
        placeholder="defect observations (one per line)"
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs" />
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const toLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
          const resolvedMap: Record<string, string> = {};
          for (const line of toLines(resolved)) {
            const [k, ...rest] = line.split("=");
            if (k && rest.length) resolvedMap[k.trim()] = rest.join("=").trim();
          }
          await setImageOverlayAction(img.id, slug, {
            resolved: resolvedMap,
            deviations: toLines(deviations),
            defects: toLines(defects),
          });
        })}
        className="rounded border border-neutral-600 px-2 py-1 text-xs hover:border-neutral-300 disabled:opacity-50"
      >
        Save overlay
      </button>
    </div>
  );
}

export default function ImagesPanel({ slug, images }: { slug: string; images: ImageRow[] }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-lg font-semibold">Images</h2>
      <form
        className="mt-3 flex flex-wrap items-center gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const formEl = e.currentTarget;
          start(async () => {
            const r = await addImageAction(fd);
            setStatus(r.ok ? "Uploaded" : `Error: ${r.error}`);
            formEl.reset();
          });
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input name="file" type="file" accept="image/*" required className="text-xs" />
        <select name="kind" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs">
          <option value="product-shot">product shot</option>
          <option value="detail">detail</option>
          <option value="alternate">alternate</option>
        </select>
        <input name="passNumber" type="number" min={1} defaultValue={1} className="w-16 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs" />
        <button disabled={pending} className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white disabled:opacity-50">
          Upload
        </button>
        {status && <span className="text-xs text-neutral-400">{status}</span>}
      </form>

      {images.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No images yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {images.map((img) => (
            <div key={img.id} className="flex gap-3 rounded border border-neutral-800 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/images/${img.filePath.replace(/^data\/images\//, "")}`}
                alt={img.filePath}
                className="h-32 w-32 rounded object-contain"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5">{img.kind}</span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5">pass {img.passNumber}</span>
                  {img.approved ? (
                    <span className="rounded bg-green-900 px-1.5 py-0.5 text-green-200">approved</span>
                  ) : null}
                  <button
                    onClick={() => start(async () => {
                      img.approved
                        ? await unapproveImageAction(img.id, slug)
                        : await approveImageAction(img.id, slug);
                    })}
                    className="rounded border border-neutral-600 px-2 py-0.5 hover:border-neutral-300"
                  >
                    {img.approved ? "unapprove" : "approve"}
                  </button>
                </div>
                <OverlayForm img={img} slug={slug} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
