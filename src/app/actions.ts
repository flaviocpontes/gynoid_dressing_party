"use server";

import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/db";
import { loadRegistrySync } from "@/domain/registry";
import { shoeCreateInput, shoeUpdateInput, shoeDetails } from "@/domain/shoe";
import { compileShoePrompt } from "@/domain/compile";
import { lintShoe } from "@/domain/lint";
import {
  createShoe, updateShoe, getShoeBySlug, addImage, approveImage, unapproveImage,
  setImageOverlay, snapshotPrompt, setProse,
} from "@/lib/shoes";

function appDb() {
  return getDb();
}

export async function createShoeAction(formData: FormData) {
  const input = shoeCreateInput.parse({
    slug: String(formData.get("slug") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    upperFamily: String(formData.get("upperFamily") ?? "").trim() || null,
  });
  await createShoe(appDb(), input);
  revalidatePath("/");
  redirect(`/shoes/${input.slug}`);
}

async function parseUpdate(formData: FormData) {
  const detailsRaw = String(formData.get("details") ?? "");
  const parsedDetails = detailsRaw ? shoeDetails.parse(JSON.parse(detailsRaw)) : {};
  return shoeUpdateInput.parse({
    slug: String(formData.get("slug") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    upperFamily: String(formData.get("upperFamily") ?? "").trim() || null,
    originCharacter: String(formData.get("originCharacter") ?? "").trim() || null,
    appearanceTier: String(formData.get("appearanceTier") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    details: parsedDetails,
  });
}

export async function updateShoeAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const slug = String(formData.get("originalSlug") ?? "");
  try {
    const input = await parseUpdate(formData);
    const updated = await updateShoe(appDb(), slug, input);
    if (!updated) return { ok: false, error: "shoe not found" };
    revalidatePath(`/shoes/${updated.slug}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function compilePromptAction(slug: string): Promise<string> {
  const db = appDb();
  const row = await getShoeBySlug(db, slug);
  if (!row) return "";
  const reg = loadRegistrySync(db);
  const details = row.details ? shoeDetails.parse(JSON.parse(row.details)) : {};
  return compileShoePrompt({ upperFamily: row.upperFamily, details }, reg);
}

export async function snapshotPromptAction(slug: string, text: string): Promise<{ ok: boolean }> {
  const db = appDb();
  const row = await getShoeBySlug(db, slug);
  if (!row) return { ok: false };
  await snapshotPrompt(db, row.id, text);
  revalidatePath(`/shoes/${slug}`);
  return { ok: true };
}

export async function addImageAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const slug = String(formData.get("slug") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no file" };
  const db = appDb();
  const row = await getShoeBySlug(db, slug);
  if (!row) return { ok: false, error: "shoe not found" };
  const ext = path.extname(file.name) || ".png";
  const name = `${crypto.randomUUID()}${ext}`;
  const dir = path.join("data", "images", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  await addImage(db, row.id, path.join("data/images", slug, name).replaceAll("\\", "/"), {
    kind: String(formData.get("kind") ?? "product-shot"),
    passNumber: Number(formData.get("passNumber") ?? 1) || 1,
  });
  revalidatePath(`/shoes/${slug}`);
  return { ok: true };
}

export async function approveImageAction(imageId: string, slug: string) {
  await approveImage(appDb(), imageId);
  revalidatePath(`/shoes/${slug}`);
  revalidatePath("/");
}

export async function unapproveImageAction(imageId: string, slug: string) {
  await unapproveImage(appDb(), imageId);
  revalidatePath(`/shoes/${slug}`);
  revalidatePath("/");
}

export async function setImageOverlayAction(
  imageId: string,
  slug: string,
  overlay: { resolved?: Record<string, string>; deviations?: string[]; defects?: string[] },
) {
  await setImageOverlay(appDb(), imageId, overlay);
  revalidatePath(`/shoes/${slug}`);
}

export async function setProseAction(slug: string, text: string): Promise<{ ok: boolean }> {
  const db = appDb();
  const row = await getShoeBySlug(db, slug);
  if (!row) return { ok: false };
  await setProse(db, row.id, text);
  revalidatePath(`/shoes/${slug}`);
  return { ok: true };
}

export async function lintShoeAction(slug: string) {
  const db = appDb();
  const row = await getShoeBySlug(db, slug);
  if (!row) return [];
  const reg = loadRegistrySync(db);
  const details = row.details ? shoeDetails.parse(JSON.parse(row.details)) : {};
  return lintShoe({ upperFamily: row.upperFamily, details }, reg);
}
