import { z } from "zod";
import { shoeDetails } from "@/domain/shoe";
import { setPath } from "@/lib/field-specs";
import type { Registry } from "@/domain/registry";
import { isFailedResponse, parsePassResponse, type PassNote, type Proposal } from "./parse";
import type { PassKey } from "./battery";

/** The mutable proposal assembly; validated at every mutation. */
export const workingSheetSchema = z.object({
  slug: z.string().default(""),
  displayName: z.string().default(""),
  upperFamily: z.string().nullable().default(null),
  details: shoeDetails.default({}),
  provenance: z.record(z.string()).default({}), // path -> passKey, or "user" once the user owns it
  notes: z.record(z.string()).default({}), // path -> machine note (rejections etc.)
});

export type WorkingSheet = z.infer<typeof workingSheetSchema>;

export const USER = "user";

/** A path is user-owned when the user owns it or anything nested under it (e.g. straps.0.type under straps). */
function isUserOwned(sheet: WorkingSheet, path: string): boolean {
  return Object.entries(sheet.provenance).some(
    ([k, v]) => v === USER && (k === path || k.startsWith(`${path}.`)),
  );
}

/**
 * Merge one parsed pass into the working sheet (pure). Machine proposals never
 * overwrite a user-owned field, except a live re-ask on its own field: the user
 * asked for it explicitly (replay during re-parse passes `liveReAsk: false`, so
 * a later user edit keeps the final word). A re-ask that proposes nothing for
 * its field clears the old value.
 */
export function applyPassToSheet(
  input: WorkingSheet,
  passKey: string,
  parsed: { proposals: Proposal[]; notes: PassNote[] },
  opts: { liveReAsk?: boolean } = {},
): WorkingSheet {
  const sheet = structuredClone(input);
  const reAskPath = passKey.startsWith("re-ask:") ? passKey.slice("re-ask:".length) : null;
  const owned = (path: string) => isUserOwned(sheet, path) && !(opts.liveReAsk && path === reAskPath);
  for (const p of parsed.proposals) {
    if (owned(p.path)) continue;
    if (p.path === "upperFamily") {
      sheet.upperFamily = typeof p.value === "string" ? p.value : sheet.upperFamily;
    } else {
      sheet.details = setPath(sheet.details, p.path, p.value) as WorkingSheet["details"];
    }
    sheet.provenance[p.path] = passKey;
    delete sheet.notes[p.path];
  }
  for (const n of parsed.notes) {
    if (n.path) sheet.notes[n.path] = n.note;
  }
  if (reAskPath && !owned(reAskPath) && !parsed.proposals.some((p) => p.path === reAskPath)) {
    sheet.details = setPath(sheet.details, reAskPath, undefined) as WorkingSheet["details"];
    delete sheet.provenance[reAskPath];
  }
  return sheet;
}

export type StoredPass = { passKey: string; responseText: string | null };

/**
 * Rebuild machine proposals from stored responses with the current parser
 * (pure, inference-free). Identity, the confirmed family, and user-owned
 * fields (including user clears) survive; machine fields and notes are
 * dropped and replayed from every successful non-family pass in stored order.
 */
export function reparseSheet(input: WorkingSheet, passes: StoredPass[], reg: Registry): WorkingSheet {
  let sheet = structuredClone(input);
  for (const [path, owner] of Object.entries(sheet.provenance)) {
    if (owner === USER || isUserOwned(sheet, path)) continue;
    if (path !== "upperFamily") {
      sheet.details = setPath(sheet.details, path, undefined) as WorkingSheet["details"];
    }
    delete sheet.provenance[path];
  }
  sheet.notes = {};
  for (const p of passes) {
    if (p.passKey === "family" || isFailedResponse(p.responseText)) continue;
    const parsed = parsePassResponse(p.passKey as PassKey, p.responseText ?? "", reg);
    sheet = applyPassToSheet(sheet, p.passKey, parsed);
  }
  return sheet;
}
