import { and, desc, eq, like, or, sql } from "drizzle-orm";
import type { Db } from "../db/db";
import { shoeImages, shoePrompts, shoes } from "../db/schema";
import type { ShoeCreateInput, ShoeUpdateInput } from "@/domain/shoe";
import { normalizeFieldValue } from "@/domain/shoe";
import type { Registry } from "@/domain/registry";
import { getStep } from "@/domain/registry";

export type ShoeRow = typeof shoes.$inferSelect;
export type ShoeImageRow = typeof shoeImages.$inferSelect;
export type ShoePromptRow = typeof shoePrompts.$inferSelect;

function id(): string {
  return crypto.randomUUID();
}

function firstValue(v: unknown): string | null {
  const norm = normalizeFieldValue(v as never);
  if (!norm) return null;
  if (Array.isArray(norm)) return norm[0] ?? null;
  if (typeof norm === "object") return null;
  return norm as string;
}

export async function createShoe(db: Db, input: ShoeCreateInput): Promise<ShoeRow> {
  const d = input.details ?? {};
  const now = Date.now();
  const row = {
    id: id(),
    slug: input.slug,
    displayName: input.displayName,
    originCharacter: input.originCharacter ?? null,
    upperFamily: input.upperFamily ?? null,
    heelType: firstValue(d.heel?.type),
    heelHeightStep: d.heel?.heightStep ?? null,
    platformHeightStep: d.platform?.heightStep ?? null,
    outsoleLacquerName: firstValue(d.outsole?.lacquerColor),
    styleFamily: input.styleFamily ? JSON.stringify(input.styleFamily) : null,
    appearanceTier: input.appearanceTier ?? null,
    details: d && Object.keys(d).length ? JSON.stringify(d) : null,
    notes: input.notes ?? null,
    proseDescription: input.proseDescription ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(shoes).values(row);
  return row as ShoeRow;
}

export async function updateShoe(db: Db, slug: string, input: ShoeUpdateInput): Promise<ShoeRow | null> {
  const existing = await getShoeBySlug(db, slug);
  if (!existing) return null;
  const d = input.details ?? {};
  const now = Date.now();
  const patch: Record<string, unknown> = {
    slug: input.slug,
    displayName: input.displayName,
    originCharacter: input.originCharacter ?? null,
    upperFamily: input.upperFamily ?? null,
    heelType: firstValue(d.heel?.type),
    heelHeightStep: d.heel?.heightStep ?? null,
    platformHeightStep: d.platform?.heightStep ?? null,
    outsoleLacquerName: firstValue(d.outsole?.lacquerColor),
    styleFamily: input.styleFamily ? JSON.stringify(input.styleFamily) : null,
    appearanceTier: input.appearanceTier ?? null,
    details: d && Object.keys(d).length ? JSON.stringify(d) : null,
    notes: input.notes ?? null,
    updatedAt: now,
  };
  // prose has its own editor/action; only touch it when explicitly provided
  if (input.proseDescription !== undefined) patch.proseDescription = input.proseDescription;
  await db.update(shoes).set(patch).where(eq(shoes.id, existing.id));
  return { ...existing, ...patch } as ShoeRow;
}

export async function getShoeBySlug(db: Db, slug: string): Promise<ShoeRow | null> {
  const rows = await db.select().from(shoes).where(eq(shoes.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getShoeById(db: Db, shoeId: string): Promise<ShoeRow | null> {
  const rows = await db.select().from(shoes).where(eq(shoes.id, shoeId)).limit(1);
  return rows[0] ?? null;
}

export type GalleryFilters = {
  upperFamily?: string;
  heelType?: string;
  heelZone?: "low" | "neutral" | "high";
  platformZone?: "low" | "neutral" | "high";
  lacquer?: string;
  originCharacter?: string;
  q?: string;
};

export type GalleryItem = ShoeRow & { cardImagePath: string | null };

export async function listShoes(db: Db, reg: Registry, f: GalleryFilters = {}): Promise<GalleryItem[]> {
  const conds = [];
  if (f.upperFamily) conds.push(eq(shoes.upperFamily, f.upperFamily));
  if (f.heelType) conds.push(eq(shoes.heelType, f.heelType));
  if (f.heelZone) {
    const stepIds = [...reg.steps.values()]
      .filter((s) => s.scaleId === "shoes.heel_height" && s.zone === f.heelZone)
      .map((s) => s.id);
    conds.push(sql`${shoes.heelHeightStep} in (${sql.join(stepIds.map((s) => sql`${s}`), sql`, `)})`);
  }
  if (f.platformZone) {
    const stepIds = [...reg.steps.values()]
      .filter((s) => s.scaleId === "shoes.platform_height" && s.zone === f.platformZone)
      .map((s) => s.id);
    conds.push(sql`${shoes.platformHeightStep} in (${sql.join(stepIds.map((s) => sql`${s}`), sql`, `)})`);
  }
  if (f.lacquer) conds.push(eq(shoes.outsoleLacquerName, f.lacquer));
  if (f.originCharacter) conds.push(eq(shoes.originCharacter, f.originCharacter));
  if (f.q) {
    const qLike = `%${f.q}%`;
    conds.push(or(like(shoes.displayName, qLike), like(shoes.slug, qLike)));
  }

  const rows = await db
    .select()
    .from(shoes)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(shoes.updatedAt));

  const cards = new Map<string, string>();
  for (const img of await db.select().from(shoeImages)) {
    if (img.approved && img.kind === "product-shot" && !cards.has(img.shoeId)) {
      cards.set(img.shoeId, img.filePath);
    }
  }
  return rows.map((r) => ({ ...r, cardImagePath: cards.get(r.id) ?? null }));
}

// ---- images ----------------------------------------------------------------

export async function addImage(
  db: Db,
  shoeId: string,
  filePath: string,
  opts: { kind?: string; passNumber?: number } = {},
): Promise<ShoeImageRow> {
  const row = {
    id: id(),
    shoeId,
    filePath,
    kind: opts.kind ?? "product-shot",
    passNumber: opts.passNumber ?? 1,
    approved: 0,
    overlay: null,
    createdAt: Date.now(),
  };
  await db.insert(shoeImages).values(row);
  return row;
}

/** Approving a product-shot unapproves other product-shots (one card per shoe). */
export async function approveImage(db: Db, imageId: string): Promise<void> {
  const rows = await db.select().from(shoeImages).where(eq(shoeImages.id, imageId)).limit(1);
  const img = rows[0];
  if (!img) return;
  await db
    .update(shoeImages)
    .set({ approved: 0 })
    .where(and(eq(shoeImages.shoeId, img.shoeId), eq(shoeImages.kind, img.kind)));
  await db.update(shoeImages).set({ approved: 1 }).where(eq(shoeImages.id, imageId));
}

export async function unapproveImage(db: Db, imageId: string): Promise<void> {
  await db.update(shoeImages).set({ approved: 0 }).where(eq(shoeImages.id, imageId));
}

export async function setImageOverlay(
  db: Db,
  imageId: string,
  overlay: { resolved?: Record<string, string>; deviations?: string[]; defects?: string[] },
): Promise<void> {
  await db
    .update(shoeImages)
    .set({ overlay: JSON.stringify(overlay) })
    .where(eq(shoeImages.id, imageId));
}

export async function listImages(db: Db, shoeId: string): Promise<ShoeImageRow[]> {
  return db.select().from(shoeImages).where(eq(shoeImages.shoeId, shoeId));
}

// ---- prompt snapshots (append-only) ----------------------------------------

export async function snapshotPrompt(db: Db, shoeId: string, text: string): Promise<ShoePromptRow> {
  const row = { id: id(), shoeId, text, createdAt: Date.now(), usedAt: Date.now() };
  await db.insert(shoePrompts).values(row);
  return row;
}

export async function listPrompts(db: Db, shoeId: string): Promise<ShoePromptRow[]> {
  return db
    .select()
    .from(shoePrompts)
    .where(eq(shoePrompts.shoeId, shoeId))
    .orderBy(desc(shoePrompts.createdAt));
}

// ---- prose -----------------------------------------------------------------

export async function setProse(db: Db, shoeId: string, text: string): Promise<void> {
  await db.update(shoes).set({ proseDescription: text, updatedAt: Date.now() }).where(eq(shoes.id, shoeId));
}

export function parseDetails(row: ShoeRow): Record<string, unknown> {
  return row.details ? JSON.parse(row.details) : {};
}

export { getStep };
