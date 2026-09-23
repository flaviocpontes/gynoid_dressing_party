"use client";

import { useMemo, useState, useTransition } from "react";
import { updateShoeAction } from "@/app/actions";
import { EDITOR_SECTIONS, getPath, setPath, type FieldSpec } from "@/lib/field-specs";
import type { ShoeDetails, FieldValue } from "@/domain/shoe";

export type StepOption = { id: string; rank: number; zone: string; phrases: string[]; anchors: string[] };

type Props = {
  slug: string;
  displayName: string;
  upperFamily: string;
  originCharacter: string;
  appearanceTier: string;
  notes: string;
  details: ShoeDetails;
  vocabTerms: Record<string, string[]>;
  scales: Record<string, StepOption[]>;
  upperFamilyTerms: string[];
};

function valueToInput(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(" | ");
  if (typeof v === "object") return ""; // absent handled by checkbox
  return String(v);
}

export default function ShoeEditor(props: Props) {
  const [displayName, setDisplayName] = useState(props.displayName);
  const [upperFamily, setUpperFamily] = useState(props.upperFamily);
  const [originCharacter, setOriginCharacter] = useState(props.originCharacter);
  const [appearanceTier, setAppearanceTier] = useState(props.appearanceTier);
  const [notes, setNotes] = useState(props.notes);
  const [details, setDetails] = useState<Record<string, unknown>>(props.details as Record<string, unknown>);
  const [adornments, setAdornments] = useState(
    ((props.details.adornments as { type: FieldValue; placement?: FieldValue }[] | undefined) ?? [])
      .map((a) => `${Array.isArray(a.type) ? a.type.join(" | ") : a.type}${a.placement ? ` | ${Array.isArray(a.placement) ? a.placement.join(" | ") : a.placement}` : ""}`)
      .join("\n"),
  );
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const adornmentTypeTerms = props.vocabTerms["embellishment"] ?? [];
  const adornmentPlacementTerms = props.vocabTerms["adornment_placement"] ?? [];

  function buildDetails(): Record<string, unknown> {
    let d = { ...details };
    // normalize adornments from textarea
    const rows = adornments.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [type, placement] = line.split("|").map((s) => s.trim());
      return placement ? { type, placement } : { type };
    });
    d = setPath(d, "adornments", rows.length ? rows : undefined);
    return d;
  }

  function save() {
    const fd = new FormData();
    fd.set("originalSlug", props.slug);
    fd.set("slug", props.slug);
    fd.set("displayName", displayName);
    fd.set("upperFamily", upperFamily);
    fd.set("originCharacter", originCharacter);
    fd.set("appearanceTier", appearanceTier);
    fd.set("notes", notes);
    fd.set("details", JSON.stringify(buildDetails()));
    start(async () => setResult(await updateShoeAction(fd)));
  }

  const field = (spec: FieldSpec) => {
    const raw = getPath(details, spec.path);
    const isAbsent = !!raw && typeof raw === "object" && !Array.isArray(raw);
    const inputVal = valueToInput(raw);
    const listId = `dl-${spec.vocab ?? spec.scale ?? spec.path.replace(/\./g, "-")}`;
    const steps = spec.kind === "scale" ? props.scales[spec.scale!] ?? [] : [];

    return (
      <div key={spec.path} className="flex flex-wrap items-center gap-2">
        <label className="w-56 shrink-0 text-sm text-neutral-300">{spec.label}</label>
        {spec.kind === "scale" ? (
          <select
            value={typeof raw === "string" ? raw : ""}
            onChange={(e) => setDetails((d) => setPath(d, spec.path, e.target.value || undefined))}
            className="min-w-64 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          >
            <option value="">— unfilled —</option>
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rank}. {s.phrases.join(" / ")} [{s.zone}]{s.anchors.length ? ` (${s.anchors.join("; ")})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              list={listId}
              value={isAbsent ? "" : inputVal}
              disabled={isAbsent}
              placeholder={spec.allowChoice ? "value or alt1 | alt2" : ""}
              onChange={(e) => {
                let v: unknown;
                const txt = e.target.value;
                if (spec.allowChoice && txt.includes("|")) {
                  const alts = txt.split("|").map((s) => s.trim()).filter(Boolean);
                  v = alts.length >= 2 ? alts : alts[0];
                } else v = txt;
                setDetails((d) => setPath(d, spec.path, v || undefined));
              }}
              className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm disabled:opacity-40"
            />
            {spec.kind === "vocab" && (
              <datalist id={listId}>
                {(props.vocabTerms[spec.vocab!] ?? []).map((t) => <option key={t} value={t} />)}
              </datalist>
            )}
          </>
        )}
        {spec.allowAbsent && (
          <label className="flex items-center gap-1 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={isAbsent}
              onChange={(e) =>
                setDetails((d) => setPath(d, spec.path, e.target.checked ? { absent: true } : undefined))
              }
            />
            absent
          </label>
        )}
      </div>
    );
  };

  const lintFree = useMemo(() => Object.keys(details).length === 0, [details]);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-lg font-semibold">Sheet</h2>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="w-56 shrink-0 text-sm text-neutral-300">Display name *</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="w-56 shrink-0 text-sm text-neutral-300">Upper family</label>
          <input value={upperFamily} onChange={(e) => setUpperFamily(e.target.value)} list="dl-upper-family"
            className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm" />
          <datalist id="dl-upper-family">
            {props.upperFamilyTerms.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="w-56 shrink-0 text-sm text-neutral-300">Origin character</label>
          <input value={originCharacter} onChange={(e) => setOriginCharacter(e.target.value)}
            className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="w-56 shrink-0 text-sm text-neutral-300">Appearance tier</label>
          <select value={appearanceTier} onChange={(e) => setAppearanceTier(e.target.value)}
            className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm">
            <option value="">— unfilled —</option>
            <option value="source">source</option>
            <option value="public">public</option>
            <option value="private">private</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="w-56 shrink-0 text-sm text-neutral-300">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm" />
        </div>
      </div>

      {EDITOR_SECTIONS.map((section) => (
        <details key={section.title} open={section.open} className="mt-4 rounded border border-neutral-800 p-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-200">{section.title}</summary>
          <div className="mt-3 space-y-2">{section.fields.map(field)}</div>
        </details>
      ))}

      <details className="mt-4 rounded border border-neutral-800 p-3" open>
        <summary className="cursor-pointer text-sm font-medium text-neutral-200">
          Adornments (one per line: <code>type | placement</code>)
        </summary>
        <div className="mt-3 space-y-2">
          <textarea value={adornments} onChange={(e) => setAdornments(e.target.value)} rows={3}
            placeholder={`satin-bow | vamp\nsatin-bow | back-collar\ncrystal-heart-buckle | t-junction`}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-mono text-xs" />
          <div className="flex gap-4 text-xs text-neutral-500">
            <span>types: {adornmentTypeTerms.slice(0, 6).join(", ")}…</span>
            <span>placements: {adornmentPlacementTerms.join(", ")}</span>
          </div>
        </div>
      </details>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={pending}
          className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50">
          {pending ? "Saving…" : "Save sheet"}
        </button>
        {result && (
          <span className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>
            {result.ok ? "Saved" : `Error: ${result.error}`}
          </span>
        )}
        {lintFree && <span className="text-xs text-neutral-500">all detail sections unfilled — that is fine</span>}
      </div>
    </section>
  );
}
