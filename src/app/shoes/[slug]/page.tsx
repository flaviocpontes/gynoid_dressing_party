import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/db";
import { loadRegistrySync } from "@/domain/registry";
import { lintShoe } from "@/domain/lint";
import { shoeDetails } from "@/domain/shoe";
import { getShoeBySlug, listImages, listPrompts } from "@/lib/shoes";
import ShoeEditor, { type StepOption } from "./ShoeEditor";
import CompilerPanel from "./CompilerPanel";
import ImagesPanel from "./ImagesPanel";
import ProseEditor from "./ProseEditor";

export const dynamic = "force-dynamic";

export default async function ShoeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const reg = loadRegistrySync(db);
  const shoe = await getShoeBySlug(db, slug);
  if (!shoe) notFound();

  const detailsRaw = shoe.details ? JSON.parse(shoe.details) : {};
  const details = shoeDetails.parse(detailsRaw);
  const images = await listImages(db, shoe.id);
  const prompts = await listPrompts(db, shoe.id);
  const warnings = lintShoe({ upperFamily: shoe.upperFamily, details }, reg);

  const vocabTerms: Record<string, string[]> = {};
  for (const [id, terms] of reg.vocabTerms) vocabTerms[id] = terms;
  const scales: Record<string, StepOption[]> = {};
  for (const [id, steps] of reg.stepsByScale) {
    scales[id] = steps.map((s) => ({
      id: s.id, rank: s.rank, zone: s.zone, phrases: s.phrases, anchors: s.anchors,
    }));
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{shoe.displayName}</h1>
          <p className="text-xs text-neutral-500">
            {shoe.slug}
            {shoe.originCharacter ? ` · origin: ${shoe.originCharacter}` : ""}
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← gallery</Link>
      </div>

      {warnings.length > 0 && (
        <div className="rounded border border-yellow-800 bg-yellow-950/40 p-3 text-sm text-yellow-200">
          <div className="font-medium">Lint warnings (non-blocking)</div>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}><code className="text-yellow-400">{w.field}</code> — {w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ShoeEditor
        slug={shoe.slug}
        displayName={shoe.displayName}
        upperFamily={shoe.upperFamily ?? ""}
        originCharacter={shoe.originCharacter ?? ""}
        appearanceTier={shoe.appearanceTier ?? ""}
        notes={shoe.notes ?? ""}
        details={details}
        vocabTerms={vocabTerms}
        scales={scales}
        upperFamilyTerms={vocabTerms["upper_family"] ?? []}
      />

      <CompilerPanel slug={shoe.slug} />

      {prompts.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-lg font-semibold">Prompt snapshots ({prompts.length})</h2>
          <div className="mt-2 space-y-2">
            {prompts.map((p) => (
              <details key={p.id} className="rounded border border-neutral-800 p-2">
                <summary className="cursor-pointer text-xs text-neutral-400">
                  {new Date(p.createdAt).toLocaleString()} — snapshot (immutable)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-neutral-300">{p.text}</pre>
              </details>
            ))}
          </div>
        </section>
      )}

      <ImagesPanel slug={shoe.slug} images={images} />

      <ProseEditor slug={shoe.slug} initial={shoe.proseDescription ?? ""} />
    </main>
  );
}
