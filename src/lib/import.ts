import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/db";
import { importPasses, importRuns } from "@/db/schema";
import { setPath } from "@/lib/field-specs";
import type { Registry } from "@/domain/registry";
import {
  buildPassPrompt,
  selectBattery,
  type PassKey,
  type PromptSource,
  type SectionPassKey,
} from "@/domain/import/battery";
import { isFailedResponse, parsePassResponse, normalizeTerm, type Proposal } from "@/domain/import/parse";
import { vlmHealth } from "@/lib/vlm";
import { applyPassToSheet, reparseSheet, workingSheetSchema, type WorkingSheet } from "@/domain/import/merge";

export type ImportRunRow = typeof importRuns.$inferSelect;
export type ImportPassRow = typeof importPasses.$inferSelect;

// ---- working sheet -----------------------------------------------------------

export { workingSheetSchema, type WorkingSheet };

export function readWorkingSheet(run: ImportRunRow): WorkingSheet {
  const raw = run.workingSheet && run.workingSheet.trim() ? JSON.parse(run.workingSheet) : {};
  return workingSheetSchema.parse(raw);
}

/** All filled leaf paths, descending into array rows with indexed paths. */
export function sheetFieldPaths(sheet: WorkingSheet): string[] {
  const out: string[] = [];
  const walk = (obj: unknown, prefix: string) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        if (v.length) out.push(path);
        v.forEach((row, i) => walk(row, `${path}.${i}`));
      } else if (v && typeof v === "object") {
        walk(v, path);
      } else if (v !== null && v !== undefined && v !== "") {
        out.push(path);
      }
    }
  };
  walk(sheet.details, "");
  return out;
}

/** Paths still holding an unresolved choice-set (array of >= 2 strings; entity rows are not choice-sets). */
export function unresolvedChoicePaths(sheet: WorkingSheet): string[] {
  const out: string[] = [];
  const walk = (obj: unknown, prefix: string) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        if (v.length && v.every((el) => typeof el === "string")) out.push(path);
        else v.forEach((row, i) => walk(row, `${path}.${i}`));
      } else if (v && typeof v === "object") {
        walk(v, path);
      }
    }
  };
  walk(sheet.details, "");
  return out;
}

// ---- data access -------------------------------------------------------------

function id(): string {
  return crypto.randomUUID();
}

export async function createRun(
  db: Db,
  input: { sourceType: "image" | "intent"; sourceImagePath?: string | null; sourceIntentText?: string | null },
): Promise<ImportRunRow> {
  const now = Date.now();
  const rows = await db
    .insert(importRuns)
    .values({
      id: id(),
      sourceType: input.sourceType,
      sourceImagePath: input.sourceImagePath ?? null,
      sourceIntentText: input.sourceIntentText ?? null,
      workingSheet: "{}",
      status: "open",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function getRun(db: Db, runId: string): Promise<ImportRunRow | null> {
  const rows = await db.select().from(importRuns).where(eq(importRuns.id, runId)).limit(1);
  return rows[0] ?? null;
}

export async function listRuns(db: Db, status = "open"): Promise<ImportRunRow[]> {
  return db
    .select()
    .from(importRuns)
    .where(eq(importRuns.status, status))
    .orderBy(desc(importRuns.updatedAt));
}

export async function appendPass(
  db: Db,
  runId: string,
  input: {
    passKey: PassKey | string;
    templateVersion: string;
    promptText: string;
    responseText?: string | null;
    finishReason?: string | null;
    proposedFields?: Proposal[];
  },
): Promise<ImportPassRow> {
  const rows = await db
    .insert(importPasses)
    .values({
      id: id(),
      runId,
      passKey: input.passKey,
      templateVersion: input.templateVersion,
      promptText: input.promptText,
      responseText: input.responseText ?? null,
      proposedFields: JSON.stringify(input.proposedFields ?? []),
      finishReason: input.finishReason ?? null,
      createdAt: Date.now(),
    })
    .returning();
  await db.update(importRuns).set({ updatedAt: Date.now() }).where(eq(importRuns.id, runId));
  return rows[0]!;
}

export async function listPasses(db: Db, runId: string): Promise<ImportPassRow[]> {
  return db
    .select()
    .from(importPasses)
    .where(eq(importPasses.runId, runId))
    .orderBy(importPasses.createdAt);
}

async function writeWorkingSheet(db: Db, runId: string, sheet: WorkingSheet): Promise<void> {
  const validated = workingSheetSchema.parse(sheet); // zod at every mutation boundary
  await db
    .update(importRuns)
    .set({ workingSheet: JSON.stringify(validated), updatedAt: Date.now() })
    .where(eq(importRuns.id, runId));
}

export async function confirmFamily(db: Db, runId: string, family: string): Promise<void> {
  await db
    .update(importRuns)
    .set({ family, updatedAt: Date.now() })
    .where(and(eq(importRuns.id, runId), eq(importRuns.status, "open")));
  const run = await getRun(db, runId);
  if (run) {
    const sheet = readWorkingSheet(run);
    sheet.upperFamily = family;
    await writeWorkingSheet(db, runId, sheet);
  }
}

export async function acceptRun(db: Db, runId: string, resultShoeId: string): Promise<void> {
  await db
    .update(importRuns)
    .set({ status: "accepted", resultShoeId, updatedAt: Date.now() })
    .where(eq(importRuns.id, runId));
}

export async function discardRun(db: Db, runId: string): Promise<void> {
  await db.update(importRuns).set({ status: "discarded", updatedAt: Date.now() }).where(eq(importRuns.id, runId));
}

// ---- pipeline execution ------------------------------------------------------

/** Reachability check run before any pass is sent; throws InferenceUnreachableError. */
export type PreflightFn = () => Promise<void>;

export type VlmFn = (req: { prompt: string; imagePath?: string }) => Promise<{ text: string; finishReason: string | null }>;

// ponytail: in-process per-run lock serializes working-sheet read-modify-write
// under the parallel battery; a db-level lock if this ever goes multi-process.
const sheetLocks = new Map<string, Promise<unknown>>();

function withRunLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sheetLocks.get(runId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  sheetLocks.set(runId, next.catch(() => {}));
  return next;
}

async function applyToSheet(
  db: Db,
  runId: string,
  passKey: string,
  proposals: Proposal[],
  notes: { path: string | null; note: string }[],
): Promise<void> {
  await withRunLock(runId, async () => {
    const fresh = await getRun(db, runId);
    if (!fresh || fresh.status !== "open") return;
    const sheet = applyPassToSheet(readWorkingSheet(fresh), passKey, { proposals, notes }, { liveReAsk: true });
    await writeWorkingSheet(db, runId, sheet);
  });
}

/** Build -> interrogate -> parse -> persist one pass. Failures become pass rows with empty proposals. */
async function executePass(
  db: Db,
  run: ImportRunRow,
  passKey: PassKey,
  reg: Registry,
  vlm: VlmFn,
  opts: { candidates?: string[] } = {},
): Promise<void> {
  const source: PromptSource =
    run.sourceType === "intent" ? { kind: "intent", text: run.sourceIntentText ?? "" } : { kind: "image" };
  const { templateVersion, prompt } = buildPassPrompt(passKey, reg, { ...opts, source });
  let responseText: string;
  let finishReason: string | null = null;
  let parsed: { proposals: Proposal[]; notes: { path: string | null; note: string }[] } = {
    proposals: [],
    notes: [],
  };
  try {
    ({ text: responseText, finishReason } = await vlm({ prompt, imagePath: run.sourceImagePath ?? undefined }));
    parsed = parsePassResponse(passKey, responseText, reg);
  } catch (e) {
    responseText = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  await appendPass(db, run.id, {
    passKey,
    templateVersion,
    promptText: prompt,
    responseText,
    finishReason,
    proposedFields: parsed.proposals,
  });
  await applyToSheet(db, run.id, passKey, parsed.proposals, parsed.notes);
}

export async function executeFamilyPass(
  db: Db,
  runId: string,
  reg: Registry,
  vlm: VlmFn,
  preflight: PreflightFn = () => vlmHealth(),
): Promise<void> {
  const run = await getRun(db, runId);
  if (!run || run.sourceType !== "image" || run.status !== "open") return;
  await preflight();
  await executePass(db, run, "family", reg, vlm);
}

/** Battery gated on the confirmed family; runs missing section passes with bounded parallelism. */
export async function executeBattery(
  db: Db,
  runId: string,
  reg: Registry,
  vlm: VlmFn,
  preflight: PreflightFn = () => vlmHealth(),
): Promise<void> {
  const run = await getRun(db, runId);
  if (!run || run.status !== "open" || !run.family) return;
  const existing = new Set(
    (await listPasses(db, runId))
      .filter((p) => !isFailedResponse(p.responseText)) // failed passes (errors, empty, no JSON) are retryable
      .map((p) => p.passKey),
  );
  const pending = selectBattery(run.family).filter((k) => !existing.has(k));
  if (!pending.length) return;
  await preflight();
  // one inference request at a time (user directive — the single-slot server wedges under bursts);
  // passes still persist individually as they settle
  for (const k of pending) {
    await executePass(db, run, k as SectionPassKey, reg, vlm);
  }
}

/** Vibe path: intent runs collapse the battery into one full-template text pass. */
export async function executeVibePass(db: Db, runId: string, reg: Registry, vlm: VlmFn): Promise<void> {
  const run = await getRun(db, runId);
  if (!run || run.sourceType !== "intent" || run.status !== "open") return;
  await executePass(db, run, "vibe", reg, vlm);
}

export async function executeReAsk(
  db: Db,
  runId: string,
  fieldPath: string,
  reg: Registry,
  vlm: VlmFn,
  preflight: PreflightFn = () => vlmHealth(),
): Promise<void> {
  const run = await getRun(db, runId);
  if (!run || run.status !== "open") return;
  await preflight();
  const sheet = readWorkingSheet(run);
  const current = sheet.details ? (sheet.details as Record<string, unknown>) : {};
  const value = fieldPath.split(".").reduce<unknown>((acc, k) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined;
  }, current);
  const candidates = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  await executePass(db, run, `re-ask:${fieldPath}`, reg, vlm, { candidates });
}

/** Re-apply the current parser to every stored pass of an open run (no inference, pass rows untouched). */
export async function reparseRun(db: Db, runId: string, reg: Registry): Promise<void> {
  await withRunLock(runId, async () => {
    const run = await getRun(db, runId);
    if (!run || run.status !== "open") return;
    const passes = await listPasses(db, runId);
    await writeWorkingSheet(db, runId, reparseSheet(readWorkingSheet(run), passes, reg));
  });
}

// ---- review mutations --------------------------------------------------------

export type FieldMutation =
  | { op: "accept"; path: string }
  | { op: "edit"; path: string; value: string }
  | { op: "resolve"; path: string; value: string }
  | { op: "absent"; path: string }
  | { op: "clear"; path: string };

/** Caller resolves the field's vocabulary terms from the registry (zod-free path stays thin). */
export async function mutateField(
  db: Db,
  runId: string,
  mutation: FieldMutation,
  vocabTerms?: string[],
): Promise<void> {
  const run = await getRun(db, runId);
  if (!run || run.status !== "open") return;
  const sheet = readWorkingSheet(run);
  switch (mutation.op) {
    case "accept":
      sheet.provenance[mutation.path] = "user";
      break;
    case "edit":
    case "resolve": {
      const value = normalizeTerm(mutation.value, vocabTerms);
      sheet.details = setPath(sheet.details, mutation.path, value) as WorkingSheet["details"];
      sheet.provenance[mutation.path] = "user";
      delete sheet.notes[mutation.path];
      break;
    }
    case "absent":
      sheet.details = setPath(sheet.details, mutation.path, { absent: true }) as WorkingSheet["details"];
      sheet.provenance[mutation.path] = "user";
      delete sheet.notes[mutation.path];
      break;
    case "clear":
      // the user owns the clear, so re-parse never resurrects the machine value
      sheet.details = setPath(sheet.details, mutation.path, undefined) as WorkingSheet["details"];
      sheet.provenance[mutation.path] = "user";
      delete sheet.notes[mutation.path];
      break;
  }
  await writeWorkingSheet(db, runId, sheet);
}

export async function setIdentity(
  db: Db,
  runId: string,
  identity: { slug?: string; displayName?: string; upperFamily?: string | null },
): Promise<void> {
  const run = await getRun(db, runId);
  if (!run || run.status !== "open") return;
  const sheet = readWorkingSheet(run);
  if (identity.slug !== undefined) sheet.slug = identity.slug.trim();
  if (identity.displayName !== undefined) sheet.displayName = identity.displayName.trim();
  if (identity.upperFamily !== undefined) sheet.upperFamily = identity.upperFamily;
  await writeWorkingSheet(db, runId, sheet);
}

// ---- acceptance (gate server-side; lint warnings never block) ----------------

export type AcceptResult = { ok: true; shoeId: string; slug: string } | { ok: false; error: string };

export async function acceptRunFlow(db: Db, runId: string): Promise<AcceptResult> {
  const run = await getRun(db, runId);
  if (!run || run.status !== "open") return { ok: false, error: "run is not open" };
  const sheet = readWorkingSheet(run);
  const choices = unresolvedChoicePaths(sheet);
  if (choices.length) {
    return { ok: false, error: `unresolved choice-sets remain: ${choices.join(", ")}` };
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(sheet.slug)) {
    return { ok: false, error: "identity incomplete: slug must be kebab-case" };
  }
  if (!sheet.displayName.trim()) {
    return { ok: false, error: "identity incomplete: display name required" };
  }
  const { createShoe } = await import("@/lib/shoes");
  const shoe = await createShoe(db, {
    slug: sheet.slug,
    displayName: sheet.displayName,
    upperFamily: sheet.upperFamily ?? undefined,
    sheetKind: run.sourceType === "image" ? "imported" : "authored",
    details: sheet.details,
  });
  await acceptRun(db, runId, shoe.id);
  return { ok: true, shoeId: shoe.id, slug: shoe.slug };
}

/** Pass rows for the given keys (battery progress display). */
export async function passesForKeys(db: Db, runId: string, keys: string[]): Promise<ImportPassRow[]> {
  if (!keys.length) return [];
  return db
    .select()
    .from(importPasses)
    .where(and(eq(importPasses.runId, runId), inArray(importPasses.passKey, keys)));
}
