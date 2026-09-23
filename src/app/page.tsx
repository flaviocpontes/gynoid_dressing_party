import Link from "next/link";
import { getDb } from "@/db/db";
import { loadRegistrySync } from "@/domain/registry";
import { listShoes } from "@/lib/shoes";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

export default async function GalleryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const db = getDb();
  const reg = loadRegistrySync(db);
  const filters = {
    upperFamily: one(sp.upperFamily),
    heelType: one(sp.heelType),
    heelZone: one(sp.heelZone) as "low" | "neutral" | "high" | undefined,
    platformZone: one(sp.platformZone) as "low" | "neutral" | "high" | undefined,
    lacquer: one(sp.lacquer),
    originCharacter: one(sp.originCharacter),
    q: one(sp.q),
  };
  const shoes = await listShoes(db, reg, filters);
  const upperFamilies = reg.vocabTerms.get("upper_family") ?? [];
  const heelTypes = reg.vocabTerms.get("heel_type") ?? [];
  const lacquers = reg.vocabTerms.get("outsole_lacquer_color") ?? [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Shoe Assets</h1>
        <Link href="/shoes/new" className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
          + New shoe
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2 text-sm" method="get">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search name or slug…"
          className="w-48 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5"
        />
        <select name="upperFamily" defaultValue={filters.upperFamily ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">upper family: any</option>
          {upperFamilies.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select name="heelType" defaultValue={filters.heelType ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">heel type: any</option>
          {heelTypes.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select name="heelZone" defaultValue={filters.heelZone ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">heel height: any</option>
          <option value="low">low zone</option>
          <option value="neutral">mid zone</option>
          <option value="high">high zone</option>
        </select>
        <select name="platformZone" defaultValue={filters.platformZone ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">platform height: any</option>
          <option value="low">low zone</option>
          <option value="neutral">mid zone</option>
          <option value="high">high zone</option>
        </select>
        <select name="lacquer" defaultValue={filters.lacquer ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">outsole lacquer: any</option>
          {lacquers.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="rounded bg-neutral-100 px-3 py-1.5 font-medium text-neutral-900 hover:bg-white">Filter</button>
        <Link href="/" className="text-neutral-400 hover:text-neutral-200">clear</Link>
      </form>

      {shoes.length === 0 ? (
        <p className="mt-10 text-center text-neutral-500">
          No shoes yet. Create the first one — identity only is enough.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shoes.map((s) => (
            <Link key={s.id} href={`/shoes/${s.slug}`} className="group rounded-lg border border-neutral-800 bg-neutral-900 p-3 hover:border-neutral-500">
              {s.cardImagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/images/${s.cardImagePath.replace(/^data\/images\//, "")}`}
                  alt={s.displayName}
                  className="aspect-square w-full rounded object-contain"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded bg-neutral-800 text-4xl text-neutral-600">
                  👠
                </div>
              )}
              <div className="mt-2 truncate text-sm font-medium group-hover:text-white">{s.displayName}</div>
              <div className="flex flex-wrap gap-1 text-[11px] text-neutral-400">
                {s.upperFamily && <span className="rounded bg-neutral-800 px-1.5 py-0.5">{s.upperFamily}</span>}
                {s.heelType && <span className="rounded bg-neutral-800 px-1.5 py-0.5">{s.heelType}</span>}
                {s.outsoleLacquerName && <span className="rounded bg-neutral-800 px-1.5 py-0.5">{s.outsoleLacquerName}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
