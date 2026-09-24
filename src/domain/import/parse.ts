import type { Registry } from "@/domain/registry";
import { getScaleSteps } from "@/domain/registry";
import { ABSENCE_ALLOWED } from "@/domain/shoe";
import type { FieldSpec, GroupSpec, SectionField } from "@/lib/field-specs";
import { fieldsForPass, type PassKey } from "./battery";

export type Proposal = {
  path: string;
  value: string | string[] | { absent: true } | Record<string, unknown>[];
};

export type PassNote = { path: string | null; note: string };

export type ParsedPass = { proposals: Proposal[]; notes: PassNote[] };

const DIGITS = /\d/;

const CANNOT_DISCERN = [
  "cannot-discern",
  "cannot discern",
  "cannot tell",
  "cannot determine",
  "can't tell",
  "not discernible",
  "unclear",
];

const NOT_PRESENT = ["not-present", "not present", "none", "absent"];

/** Extract the outermost JSON object from a (possibly fenced / prose-wrapped) response. */
export function extractJsonBlock(raw: string): unknown | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/**
 * House term normalization: exact / case-insensitive / kebab-insensitive matches
 * resolve to the canonical vocabulary term; free text becomes kebab-case.
 * No fuzzy (nearest-term) snapping, ever.
 */
export function normalizeTerm(raw: string, terms?: string[]): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return s;
  const kebab = (t: string) => t.toLowerCase().replace(/\s+/g, "-");
  if (terms && terms.length) {
    if (terms.includes(s)) return s;
    const ci = terms.find((t) => t.toLowerCase() === s.toLowerCase());
    if (ci) return ci;
    const kc = terms.find((t) => kebab(t) === kebab(s));
    if (kc) return kc;
  }
  return kebab(s);
}

function isSentimental(v: string, phrases: string[]): boolean {
  const low = v.trim().toLowerCase();
  return phrases.some((p) => low === p || low.startsWith(`${p} `) || low.includes(p));
}

type FieldOutcome = { proposal?: Proposal; note?: PassNote };

function parseScaleValue(spec: FieldSpec, raw: string, reg: Registry, path: string): FieldOutcome {
  const ids = new Set(getScaleSteps(reg, spec.scale ?? "").map((s) => s.id));
  const v = raw.trim();
  if (ids.has(v)) return { proposal: { path, value: v } };
  if (DIGITS.test(v)) {
    return { note: { path, note: `digit-bearing value rejected for ${path}: "${v}" (answer must be a scale step id)` } };
  }
  return { note: { path, note: `not a step reference for ${path}: "${v}"` } };
}

function parseFieldValue(spec: FieldSpec, raw: unknown, reg: Registry, path: string): FieldOutcome {
  const terms = spec.vocab ? (reg.vocabTerms.get(spec.vocab) ?? []) : undefined;

  if (Array.isArray(raw)) {
    const kept: string[] = [];
    const notes: PassNote[] = [];
    for (const el of raw) {
      if (typeof el !== "string" || !el.trim()) continue;
      const s = el.trim();
      if (isSentimental(s, CANNOT_DISCERN)) continue; // hedged cannot-discern elements drop silently
      if (spec.kind === "scale") {
        const ids = new Set(getScaleSteps(reg, spec.scale ?? "").map((st) => st.id));
        if (ids.has(s)) kept.push(s);
        continue;
      }
      if (DIGITS.test(s)) {
        notes.push({ path, note: `digit-bearing value rejected for ${path}: "${s}"` });
        continue;
      }
      kept.push(normalizeTerm(s, terms));
    }
    if (spec.kind === "scale") {
      if (kept.length === 1) return { proposal: { path, value: kept[0] } };
      return {
        note: {
          path,
          note: raw.length > 1 ? `hedged scale answer for ${path} needs a single step id — re-ask` : `no valid step id for ${path}`,
        },
      };
    }
    const unique = [...new Set(kept.filter(Boolean))];
    if (notes.length && !unique.length) return { note: notes[0] };
    if (unique.length === 0) return { note: { path, note: `empty answer for ${path}` } };
    if (unique.length === 1) return { proposal: { path, value: unique[0] } };
    return { proposal: { path, value: unique } };
  }

  if (typeof raw !== "string") return { note: { path, note: `unusable answer type for ${path}` } };
  const s = raw.trim();
  if (!s) return {};

  if (isSentimental(s, CANNOT_DISCERN)) {
    return { note: { path, note: `cannot-discern: ${path} left unfilled` } };
  }
  if (isSentimental(s, NOT_PRESENT)) {
    if (spec.kind === "vocab" || spec.kind === "text") {
      if (ABSENCE_ALLOWED.has(spec.path)) return { proposal: { path, value: { absent: true } } };
      return { note: { path, note: `explicit absence not defined for ${spec.path}; left unfilled` } };
    }
    return { note: { path, note: `absence not legal on scale field ${path}; left unfilled` } };
  }
  if (spec.kind === "scale") return parseScaleValue(spec, s, reg, path);
  if (DIGITS.test(s)) {
    return { note: { path, note: `digit-bearing value rejected for ${path}: "${s}"` } };
  }
  return { proposal: { path, value: normalizeTerm(s, terms) } };
}

function parseGroup(
  spec: GroupSpec,
  raw: unknown,
  reg: Registry,
  path: string,
  out: { proposals: Proposal[]; notes: PassNote[] },
): void {
  if (!Array.isArray(raw)) {
    out.notes.push({ path, note: `expected a row array for ${path}` });
    return;
  }
  const rows: Record<string, unknown>[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object" || Array.isArray(el)) continue;
    const row: Record<string, unknown> = {};
    let hasType = false;
    for (const rf of spec.rowFields) {
      const v = (el as Record<string, unknown>)[rf.path];
      if (v === undefined || v === null || v === "") continue;
      const res = parseFieldValue(rf, v, reg, `${path}.${rf.path}`);
      if (res.proposal) {
        row[rf.path] = res.proposal.value;
        if (rf.path === "type") hasType = true;
      } else if (res.note) {
        out.notes.push(res.note);
      }
    }
    if (hasType) rows.push(row);
  }
  if (rows.length) out.proposals.push({ path, value: rows });
  else out.notes.push({ path, note: `no usable rows for ${path}` });
}

/** Flatten nested answer objects into dotted leaf keys (model sometimes nests despite instructions). */
function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Parse a pass response into sheet proposals + notes, implementing the
 * value-state mapping. Never trusts the JSON: unknown keys ignored,
 * everything validated against specs + registry.
 */
export function parsePassResponse(passKey: PassKey, rawText: string, reg: Registry): ParsedPass {
  const out: { proposals: Proposal[]; notes: PassNote[] } = { proposals: [], notes: [] };
  const fields = fieldsForPass(passKey);
  if (!fields.length) return { proposals: [], notes: [{ path: null, note: `unknown pass key ${passKey}` }] };

  const parsed = extractJsonBlock(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { proposals: [], notes: [{ path: null, note: "unparseable response (no JSON object found)" }] };
  }
  const obj = flatten(parsed as Record<string, unknown>);

  for (const f of fields) {
    if (f.kind === "group") {
      const v = obj[f.path];
      if (v !== undefined) parseGroup(f, v, reg, f.path, out);
      continue;
    }
    const v = obj[f.path];
    if (v === undefined || v === null || v === "") continue;
    const res = parseFieldValue(f, v, reg, f.path);
    if (res.proposal) out.proposals.push(res.proposal);
    if (res.note) out.notes.push(res.note);
  }
  return out;
}
