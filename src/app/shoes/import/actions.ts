"use server";

import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/db";
import { loadRegistrySync } from "@/domain/registry";
import { ABSENCE_ALLOWED } from "@/domain/shoe";
import { resolveFieldSpec } from "@/domain/import/battery";
import { vlmChat, InferenceUnreachableError } from "@/lib/vlm";
import {
  createRun,
  getRun,
  confirmFamily,
  executeFamilyPass,
  executeBattery,
  executeReAsk,
  reparseRun,
  mutateField,
  setIdentity,
  acceptRunFlow,
  discardRun,
} from "@/lib/import";

function appDb() {
  return getDb();
}

function refresh(runId: string) {
  revalidatePath(`/shoes/import/${runId}`);
  revalidatePath("/shoes/import");
}

export async function startImportRunAction(formData: FormData) {
  const file = formData.get("file");
  const intent = z.string().parse(String(formData.get("intent") ?? "")).trim();
  let sourceType: "image" | "intent";
  let sourceImagePath: string | null = null;
  let sourceIntentText: string | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = path.extname(file.name) || ".png";
    const name = `${crypto.randomUUID()}${ext}`;
    fs.mkdirSync(path.join("data", "images", "imports"), { recursive: true });
    fs.writeFileSync(path.join("data", "images", "imports", name), Buffer.from(await file.arrayBuffer()));
    sourceType = "image";
    sourceImagePath = `data/images/imports/${name}`;
  } else if (intent) {
    sourceType = "intent";
    sourceIntentText = intent;
  } else {
    refresh("");
    return;
  }
  const run = await createRun(appDb(), { sourceType, sourceImagePath, sourceIntentText });
  revalidatePath("/shoes/import");
  redirect(`/shoes/import/${run.id}`);
}

/** Run an interrogation; an unreachable server lands back on the run with a visible error. */
async function interrogate(runId: string, fn: () => Promise<void>) {
  let unreachable = false;
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof InferenceUnreachableError)) throw e;
    unreachable = true;
  }
  refresh(runId);
  // always redirect so a previous error banner clears on success
  redirect(`/shoes/import/${runId}${unreachable ? "?error=inference-unreachable" : ""}`);
}

export async function runFamilyPassAction(formData: FormData) {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  await interrogate(runId, () => executeFamilyPass(appDb(), runId, loadRegistrySync(appDb()), vlmChat));
}

export async function confirmFamilyAction(formData: FormData) {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  const family = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "family must be kebab-case")
    .parse(String(formData.get("family") ?? "").trim().toLowerCase().replace(/\s+/g, "-"));
  await confirmFamily(appDb(), runId, family);
  refresh(runId);
}

export async function runBatteryAction(formData: FormData) {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  await interrogate(runId, () => executeBattery(appDb(), runId, loadRegistrySync(appDb()), vlmChat));
}

export async function reAskAction(formData: FormData) {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  const fieldPath = z.string().min(1).parse(String(formData.get("path") ?? ""));
  await interrogate(runId, () => executeReAsk(appDb(), runId, fieldPath, loadRegistrySync(appDb()), vlmChat));
}

export async function reparseRunAction(formData: FormData) {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  await reparseRun(appDb(), runId, loadRegistrySync(appDb()));
  refresh(runId);
}

const mutationInput = z.object({
  runId: z.string().min(1),
  op: z.enum(["accept", "edit", "resolve", "absent", "clear"]),
  path: z.string().min(1),
  value: z.string().optional(),
});

export async function mutateFieldAction(formData: FormData): Promise<void> {
  try {
    const input = mutationInput.parse({
      runId: String(formData.get("runId") ?? ""),
      op: String(formData.get("op") ?? ""),
      path: String(formData.get("path") ?? ""),
      value: String(formData.get("value") ?? "").trim() || undefined,
    });
    if ((input.op === "edit" || input.op === "resolve") && !input.value) return;
    if (input.op === "absent") {
      const absentSpec = resolveFieldSpec(input.path);
      if (!absentSpec || !ABSENCE_ALLOWED.has(absentSpec.path)) return;
    }
    const reg = loadRegistrySync(appDb());
    const spec = resolveFieldSpec(input.path);
    const terms = spec?.vocab ? (reg.vocabTerms.get(spec.vocab) ?? undefined) : undefined;
    await mutateField(appDb(), input.runId, { op: input.op, path: input.path, value: input.value ?? "" }, terms);
    refresh(input.runId);
  } catch {
    // boundary zod failures surface via Next error page
  }
}

const identityInput = z.object({
  runId: z.string().min(1),
  slug: z.string(),
  displayName: z.string(),
  upperFamily: z.string().optional().nullable(),
});

export async function setIdentityAction(formData: FormData): Promise<void> {
  try {
    const input = identityInput.parse({
      runId: String(formData.get("runId") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      upperFamily: String(formData.get("upperFamily") ?? "").trim() || null,
    });
    await setIdentity(appDb(), input.runId, {
      slug: input.slug,
      displayName: input.displayName,
      upperFamily: input.upperFamily,
    });
    refresh(input.runId);
  } catch {
    // boundary zod failures surface via Next error page
  }
}

export async function acceptRunAction(formData: FormData): Promise<void> {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  const res = await acceptRunFlow(appDb(), runId);
  if (!res.ok) {
    refresh(runId);
    return;
  }
  revalidatePath("/");
  revalidatePath("/shoes/import");
  redirect(`/shoes/${res.slug}`);
}

export async function discardRunAction(formData: FormData) {
  const runId = z.string().min(1).parse(String(formData.get("runId") ?? ""));
  const run = await getRun(appDb(), runId);
  await discardRun(appDb(), runId);
  revalidatePath("/shoes/import");
  revalidatePath("/");
  if (run?.sourceType === "image" && run.sourceImagePath) {
    // source image stays on disk (run row retains the reference); nothing else to clean
  }
  redirect("/shoes/import");
}
