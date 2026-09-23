import { createShoeAction } from "@/app/actions";

export default function NewShoePage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-bold">New Shoe</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Identity only is enough — every detail section starts unfilled.
      </p>
      <form action={createShoeAction} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="displayName">Display name *</label>
          <input id="displayName" name="displayName" required
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="slug">Slug * (kebab-case)</label>
          <input id="slug" name="slug" required pattern="[a-z0-9][a-z0-9-]*"
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="upperFamily">Upper family</label>
          <input id="upperFamily" name="upperFamily" list="upper-family-list" placeholder="pump, mary-jane, boot…"
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" />
        </div>
        <datalist id="upper-family-list">
          <option value="pump" /><option value="mary-jane" /><option value="t-strap" />
          <option value="slingback" /><option value="mule" /><option value="sandal" />
          <option value="loafer" /><option value="oxford" /><option value="derby" />
          <option value="brogue" /><option value="clog" /><option value="boot" />
          <option value="bootie" /><option value="shootie" /><option value="sneaker" />
          <option value="d'orsay" /><option value="spectator" />
        </datalist>
        <button className="rounded bg-neutral-100 px-4 py-2 font-medium text-neutral-900 hover:bg-white">
          Create
        </button>
      </form>
    </main>
  );
}
