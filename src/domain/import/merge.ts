import { z } from "zod";
import { shoeDetails } from "@/domain/shoe";
import { setPath } from "@/lib/field-specs";
import type { PassNote, Proposal } from "./parse";

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

function isUserOwned(sheet: WorkingSheet, path: string): boolean {
  return sheet.provenance[path] === USER;
}

/**
 * Merge one parsed pass into the working sheet (pure). Machine proposals never
 * overwrite a user-owned field; a re-ask that proposes nothing for its field
 * clears the old machine proposal.
 */
export function applyPassToSheet(
  input: WorkingSheet,
  passKey: string,
  parsed: { proposals: Proposal[]; notes: PassNote[] },
): WorkingSheet {
  const sheet = structuredClone(input);
  for (const p of parsed.proposals) {
    if (isUserOwned(sheet, p.path)) continue;
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
  if (passKey.startsWith("re-ask:")) {
    const path = passKey.slice("re-ask:".length);
    if (!isUserOwned(sheet, path) && !parsed.proposals.some((p) => p.path === path)) {
      sheet.details = setPath(sheet.details, path, undefined) as WorkingSheet["details"];
      delete sheet.provenance[path];
    }
  }
  return sheet;
}
