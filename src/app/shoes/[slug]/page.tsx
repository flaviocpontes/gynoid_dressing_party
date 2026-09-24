import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/db";
import { loadRegistrySync } from "@/domain/registry";
import type { SerializedRegistry } from "@/domain/registry";
import { shoeDetails } from "@/domain/shoe";
import { getShoeBySlug, listImages, listPrompts } from "@/lib/shoes";
import EditorWorkspace from "./EditorWorkspace";

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

  const registry: SerializedRegistry = {
    vocabTerms: Object.fromEntries(reg.vocabTerms),
    scales: Object.fromEntries(reg.stepsByScale),
  };

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
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

      <EditorWorkspace
        slug={shoe.slug}
        displayName={shoe.displayName}
        upperFamily={shoe.upperFamily ?? ""}
        sheetKind={shoe.sheetKind ?? "authored"}
        originCharacter={shoe.originCharacter ?? ""}
        appearanceTier={shoe.appearanceTier ?? ""}
        notes={shoe.notes ?? ""}
        details={details}
        registry={registry}
        images={images}
        prompts={prompts}
        proseInitial={shoe.proseDescription ?? ""}
      />
    </main>
  );
}
