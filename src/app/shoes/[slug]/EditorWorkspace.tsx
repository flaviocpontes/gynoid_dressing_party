"use client";

import { useMemo, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { snapshotPromptAction, updateShoeAction } from "@/app/actions";
import { absencePreviewText, compileShoeClauses, type Clause } from "@/domain/compile";
import { isApplicable } from "@/domain/applicability";
import { lintShoe } from "@/domain/lint";
import { registryFromSerialized, type SerializedRegistry } from "@/domain/registry";
import type { FieldValue, ShoeDetails } from "@/domain/shoe";
import { isAbsent, normalizeFieldValue } from "@/domain/shoe";
import {
  EDITOR_SECTIONS, getPath, sectionCounts, setPath,
  type FieldSpec, type GroupSpec,
} from "@/lib/field-specs";
import GroupRows from "./widgets/GroupRows";
import ScaleStepper from "./widgets/ScaleStepper";
import VocabCombo from "./widgets/VocabCombo";
import ImagesPanel from "./ImagesPanel";
import ProseEditor from "./ProseEditor";

type Props = {
  slug: string;
  displayName: string;
  upperFamily: string;
  sheetKind: string;
  originCharacter: string;
  appearanceTier: string;
  notes: string;
  details: ShoeDetails;
  registry: SerializedRegistry;
  images: ComponentProps<typeof ImagesPanel>["images"];
  prompts: { id: string; text: string; createdAt: number | string | Date }[];
  proseInitial: string;
};

const CLAUSE_SECTION_LABELS: Record<string, string> = {
  preamble: "preamble",
  identity: "identity / opening",
  upper: "upper & colorway",
  straps: "straps",
  transition: "transition",
  silhouette: "silhouette",
  heel: "heel",
  shaft: "shaft",
  counter: "counter",
  hardware: "hardware",
  adornments: "adornments",
  construction: "construction",
  outsole: "outsole (signature)",
  sensory: "sensory",
};

/** Collect off-vocabulary values already present in the sheet as known custom terms. */
function seedCustomTerms(details: Record<string, unknown>, ser: SerializedRegistry): Record<string, string[]> {
  const customs: Record<string, string[]> = {};
  const add = (vocabId: string, v: unknown) => {
    const base = ser.vocabTerms[vocabId] ?? [];
    for (const s of Array.isArray(v) ? v : [v]) {
      if (typeof s === "string" && s && !base.includes(s) && !(customs[vocabId] ?? []).includes(s)) {
        (customs[vocabId] ??= []).push(s);
      }
    }
  };
  for (const sec of EDITOR_SECTIONS) {
    for (const f of sec.fields) {
      if (f.kind === "group") {
        const rows = (getPath(details, f.path) as Record<string, unknown>[] | undefined) ?? [];
        for (const rf of f.rowFields) {
          if (rf.kind === "vocab") rows.forEach((r) => add(rf.vocab!, r?.[rf.path]));
        }
      } else if (f.kind === "vocab") {
        add(f.vocab!, getPath(details, f.path));
      }
    }
  }
  return customs;
}

/** Drop group rows whose type was never filled; empty arrays become unfilled. */
function normalizeDetails(d: Record<string, unknown>): Record<string, unknown> {
  let out = d;
  for (const key of ["straps", "adornments"]) {
    const rows = ((getPath(out, key) as Record<string, unknown>[] | undefined) ?? []).filter((r) => {
      const t = r?.type;
      return Array.isArray(t) ? t.length > 0 : typeof t === "string" && t.trim().length > 0;
    });
    out = setPath(out, key, rows.length ? rows : undefined);
  }
  return out;
}

function sectionOf(path: string): number | undefined {
  return EDITOR_SECTIONS.findIndex((sec) =>
    sec.fields.some((f) => path === f.path || path.startsWith(`${f.path}.`)),
  );
}

export default function EditorWorkspace(props: Props) {
  const [displayName, setDisplayName] = useState(props.displayName);
  const [upperFamily, setUpperFamily] = useState(props.upperFamily);
  const [sheetKind, setSheetKind] = useState(props.sheetKind || "authored");
  const [originCharacter, setOriginCharacter] = useState(props.originCharacter);
  const [appearanceTier, setAppearanceTier] = useState(props.appearanceTier);
  const [notes, setNotes] = useState(props.notes);
  const [details, setDetails] = useState<Record<string, unknown>>(props.details as Record<string, unknown>);
  const [customTerms, setCustomTerms] = useState<Record<string, string[]>>(() =>
    seedCustomTerms(props.details as Record<string, unknown>, props.registry),
  );
  const [openSections, setOpenSections] = useState(() => EDITOR_SECTIONS.map((s) => s.open));
  const [tab, setTab] = useState<"prompt" | "images" | "prose">("prompt");
  const [handEdit, setHandEdit] = useState<string | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      displayName: props.displayName,
      upperFamily: props.upperFamily,
      sheetKind: props.sheetKind || "authored",
      originCharacter: props.originCharacter,
      appearanceTier: props.appearanceTier,
      notes: props.notes,
      details: normalizeDetails(props.details as Record<string, unknown>),
    }),
  );
  const [pending, start] = useTransition();

  const reg = useMemo(() => registryFromSerialized(props.registry), [props.registry]);

  const clauses = useMemo(
    () => compileShoeClauses({ upperFamily: upperFamily || null, details: details as ShoeDetails }, reg),
    [details, upperFamily, reg],
  );
  const compiledText = useMemo(() => clauses.map((c) => c.text).join("\n\n"), [clauses]);
  const warnings = useMemo(
    () =>
      lintShoe(
        {
          upperFamily: upperFamily || null,
          details: details as ShoeDetails,
          sheetKind: sheetKind === "imported" ? "imported" : "authored",
        },
        reg,
      ),
    [details, upperFamily, sheetKind, reg],
  );

  const currentSnapshot = JSON.stringify({
    displayName,
    upperFamily,
    sheetKind,
    originCharacter,
    appearanceTier,
    notes,
    details: normalizeDetails(details),
  });
  const dirty = currentSnapshot !== savedSnapshot;

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as { label: string; path: string }[];
    const out: { label: string; path: string }[] = [];
    for (const sec of EDITOR_SECTIONS) {
      for (const f of sec.fields) {
        if (f.kind === "group") {
          for (const rf of f.rowFields) {
            if (
              rf.label.toLowerCase().includes(q) ||
              `${f.path}.${rf.path}`.toLowerCase().includes(q)
            ) {
              out.push({ label: `${rf.label} (${f.label}) — ${f.path}.${rf.path}`, path: f.path });
            }
          }
        } else if (f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
          out.push({ label: `${f.label} — ${f.path}`, path: f.path });
        }
      }
    }
    return out.slice(0, 10);
  }, [search]);

  function addCustom(vocabId: string, term: string) {
    setCustomTerms((c) =>
      (c[vocabId] ?? []).includes(term) ? c : { ...c, [vocabId]: [...(c[vocabId] ?? []), term] },
    );
  }

  function jumpTo(path: string) {
    const secIdx = sectionOf(path);
    if (secIdx !== undefined) {
      setOpenSections((o) => {
        if (o[secIdx]) return o;
        const n = [...o];
        n[secIdx] = true;
        return n;
      });
    }
    setTimeout(() => {
      const el = document.getElementById(`f-${path}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash-highlight");
      void el.offsetWidth; // restart the animation on repeat jumps
      el.classList.add("flash-highlight");
      window.setTimeout(() => el.classList.remove("flash-highlight"), 1800);
    }, 60);
  }

  function save() {
    const snapshotNow = currentSnapshot;
    const fd = new FormData();
    fd.set("originalSlug", props.slug);
    fd.set("slug", props.slug);
    fd.set("displayName", displayName);
    fd.set("upperFamily", upperFamily);
    fd.set("sheetKind", sheetKind);
    fd.set("originCharacter", originCharacter);
    fd.set("appearanceTier", appearanceTier);
    fd.set("notes", notes);
    fd.set("details", JSON.stringify(normalizeDetails(details)));
    start(async () => {
      const r = await updateShoeAction(fd);
      setResult(r);
      if (r.ok) setSavedSnapshot(snapshotNow);
    });
  }

  const setValue = (absPath: string, v: unknown) =>
    setDetails((d) => setPath(d, absPath, v === undefined || v === "" ? undefined : v));

  const renderField = (spec: FieldSpec, absPath = spec.path): ReactNode => {
    const raw = getPath(details, absPath);
    const norm = normalizeFieldValue((raw as FieldValue | undefined) ?? null);
    const absent = isAbsent(norm);
    return (
      <div key={absPath} id={`f-${absPath}`} className="flex min-w-56 flex-1 flex-wrap items-start gap-2 rounded-md p-1">
        <div className="w-40 shrink-0 pt-1 text-xs text-neutral-400">{spec.label}</div>
        <div className="flex min-w-40 flex-1 flex-wrap items-center gap-2">
          {spec.kind === "vocab" ? (
            <VocabCombo
              terms={props.registry.vocabTerms[spec.vocab!] ?? []}
              customTerms={customTerms[spec.vocab!] ?? []}
              value={norm}
              onChange={(v) => setValue(absPath, v)}
              onCustom={(t) => addCustom(spec.vocab!, t)}
              allowChoice={spec.allowChoice}
              disabled={absent}
            />
          ) : spec.kind === "scale" ? (
            <ScaleStepper
              steps={props.registry.scales[spec.scale!] ?? []}
              value={typeof raw === "string" ? raw : undefined}
              onChange={(v) => setValue(absPath, v)}
            />
          ) : (
            <input
              value={typeof norm === "string" ? norm : ""}
              disabled={absent}
              onChange={(e) => setValue(absPath, e.target.value)}
              className="min-w-36 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs disabled:opacity-40"
            />
          )}
          {absent && (
            <span className="text-xs italic text-neutral-400">{absencePreviewText(absPath)}</span>
          )}
          {spec.allowAbsent && (
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={absent}
                onChange={(e) => setValue(absPath, e.target.checked ? { absent: true } : undefined)}
              />
              absent
            </label>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (g: GroupSpec): ReactNode => {
    const rows = (getPath(details, g.path) as Record<string, unknown>[] | undefined) ?? [];
    return (
      <GroupRows
        key={g.path}
        groupPath={g.path}
        label={g.label.replace(/ rows$/, "")}
        rows={rows}
        rowFields={g.rowFields}
        onRowsChange={(next) => setValue(g.path, next.length ? next : undefined)}
        renderField={renderField}
      />
    );
  };

  const clauseGroups = useMemo(() => {
    const groups: { key: string; clauses: Clause[] }[] = [];
    for (const c of clauses) {
      const last = groups[groups.length - 1];
      if (last && last.key === c.sectionKey) last.clauses.push(c);
      else groups.push({ key: c.sectionKey, clauses: [c] });
    }
    return groups;
  }, [clauses]);

  const displayedPrompt = handEdit ?? compiledText;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* ---------------- left pane: sheet ---------------- */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <h2 className="text-lg font-semibold">Sheet</h2>

        {/* field search */}
        <div className="relative mt-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search fields by label or path (e.g. breast)…"
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          />
          {searchResults.length > 0 && (
            <ul className="absolute top-full left-0 z-30 mt-1 w-full rounded border border-neutral-700 bg-neutral-900 py-1 shadow-lg">
              {searchResults.map((r) => (
                <li key={r.path + r.label}>
                  <button
                    onClick={() => {
                      jumpTo(r.path);
                      setSearch("");
                    }}
                    className="block w-full px-2 py-1 text-left text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* identity */}
        <div className="mt-3 space-y-2">
          <div id="f-displayName" className="flex flex-wrap items-center gap-2 rounded-md p-1">
            <div className="w-40 shrink-0 text-xs text-neutral-400">Display name *</div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            />
          </div>
          <div id="f-upperFamily" className="flex flex-wrap items-center gap-2 rounded-md p-1">
            <div className="w-40 shrink-0 text-xs text-neutral-400">Upper family</div>
            <div className="flex min-w-48 flex-1">
              <VocabCombo
                terms={props.registry.vocabTerms["upper_family"] ?? []}
                customTerms={customTerms["upper_family"] ?? []}
                value={upperFamily || undefined}
                onChange={(v) => setUpperFamily((v as string) ?? "")}
                onCustom={(t) => addCustom("upper_family", t)}
                placeholder="pump, boot, sandal…"
              />
            </div>
          </div>
          <div id="f-sheetKind" className="flex flex-wrap items-center gap-2 rounded-md p-1">
            <div className="w-40 shrink-0 text-xs text-neutral-400">Sheet kind</div>
            <select
              value={sheetKind}
              onChange={(e) => setSheetKind(e.target.value)}
              className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            >
              <option value="authored">authored</option>
              <option value="imported">imported (assertive — lint flags unresolved choice-sets)</option>
            </select>
          </div>
          <div id="f-originCharacter" className="flex flex-wrap items-center gap-2 rounded-md p-1">
            <div className="w-40 shrink-0 text-xs text-neutral-400">Origin character</div>
            <input
              value={originCharacter}
              onChange={(e) => setOriginCharacter(e.target.value)}
              className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            />
          </div>
          <div id="f-appearanceTier" className="flex flex-wrap items-center gap-2 rounded-md p-1">
            <div className="w-40 shrink-0 text-xs text-neutral-400">Appearance tier</div>
            <select
              value={appearanceTier}
              onChange={(e) => setAppearanceTier(e.target.value)}
              className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            >
              <option value="">— unfilled —</option>
              <option value="source">source</option>
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </div>
          <div id="f-notes" className="flex flex-wrap items-center gap-2 rounded-md p-1">
            <div className="w-40 shrink-0 text-xs text-neutral-400">Notes</div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-w-48 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* detail sections */}
        {EDITOR_SECTIONS.map((section, i) => {
          const counts = sectionCounts(details, section.fields);
          const applicable = section.fields.every((f) => isApplicable(upperFamily || null, f.path));
          return (
            <details
              key={section.title}
              id={`sec-${i}`}
              open={openSections[i]}
              onToggle={(e) => {
                const open = (e.target as HTMLDetailsElement).open;
                setOpenSections((o) => (o[i] === open ? o : o.map((v, j) => (j === i ? open : v))));
              }}
              className="mt-4 rounded border border-neutral-800 p-3"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-neutral-200">
                <span>{section.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    counts.filled > 0 ? "bg-emerald-950/60 text-emerald-400" : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {counts.filled}/{counts.total}
                </span>
                {!applicable && (
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] tracking-wide text-neutral-400 uppercase">
                    N/A · not for {upperFamily || "this family"}
                  </span>
                )}
              </summary>
              <div className="mt-3 space-y-2">
                {applicable ? (
                  section.fields.map((f) => (f.kind === "group" ? renderGroup(f) : renderField(f, f.path)))
                ) : (
                  <p className="text-xs text-neutral-500">
                    This section cannot apply to {upperFamily || "this upper family"}; its fields accept no input.
                  </p>
                )}
              </div>
            </details>
          );
        })}

        {/* save footer */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-3">
          <button
            onClick={save}
            disabled={pending}
            className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save sheet"}
          </button>
          {dirty && <span className="text-xs text-amber-400">● unsaved changes</span>}
          {result && (
            <span className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>
              {result.ok ? "Saved" : `Error: ${result.error}`}
            </span>
          )}
        </div>
      </section>

      {/* ---------------- right pane: live output tabs ---------------- */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div role="tablist" aria-label="output panes" className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
          {(["prompt", "images", "prose"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded px-3 py-1.5 text-sm capitalize ${
                tab === t ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t}
              {t === "prompt" && warnings.length > 0 ? ` (${warnings.length}⚠)` : ""}
            </button>
          ))}
        </div>

        {tab === "prompt" && (
          <div className="mt-3 space-y-4">
            {/* live lint */}
            {warnings.length > 0 && (
              <div className="rounded border border-yellow-800 bg-yellow-950/40 p-3 text-sm text-yellow-200">
                <div className="font-medium">Lint warnings (live, non-blocking)</div>
                <ul className="mt-1 space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <button
                        onClick={() => jumpTo(w.field)}
                        className="text-left text-xs underline decoration-dotted hover:text-yellow-100"
                      >
                        <code className="text-yellow-400">{w.field}</code> — {w.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* compiled clauses with provenance */}
            <div>
              <h3 className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                Compiled clauses — click a source field to jump
              </h3>
              <div className="mt-2 space-y-2">
                {clauseGroups.map((g, gi) => (
                  <div key={`${g.key}-${gi}`} className="rounded border border-neutral-800 p-2">
                    <div className="text-[10px] tracking-wide text-neutral-500 uppercase">
                      {CLAUSE_SECTION_LABELS[g.key] ?? g.key}
                    </div>
                    {g.clauses.map((c) => (
                      <div key={c.text} className="mt-1">
                        <p
                          onClick={() => c.fieldPaths[0] && jumpTo(c.fieldPaths[0])}
                          className={`cursor-pointer text-xs leading-relaxed text-neutral-200 ${
                            c.fieldPaths.length ? "hover:text-white" : ""
                          }`}
                        >
                          {c.text}
                        </p>
                        {c.fieldPaths.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {c.fieldPaths.map((p) => (
                              <button
                                key={p}
                                onClick={() => jumpTo(p)}
                                title={`jump to ${p}`}
                                className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-sky-400 hover:bg-neutral-700"
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* hand-editable preview */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Prompt preview (live)</h3>
                {handEdit !== null && (
                  <button
                    onClick={() => setHandEdit(null)}
                    className="text-[10px] text-amber-400 underline decoration-dotted"
                  >
                    edited — reset to compiled
                  </button>
                )}
              </div>
              <textarea
                value={displayedPrompt}
                onChange={(e) => setHandEdit(e.target.value)}
                rows={8}
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  disabled={pending || !displayedPrompt.trim()}
                  onClick={() =>
                    start(async () => {
                      await snapshotPromptAction(props.slug, displayedPrompt);
                      setSnapshotStatus("Snapshot saved verbatim — it will survive future sheet edits.");
                    })
                  }
                  className="rounded border border-neutral-600 px-3 py-1.5 text-sm hover:border-neutral-300 disabled:opacity-50"
                >
                  Mark used
                </button>
                {snapshotStatus && <span className="text-xs text-green-400">{snapshotStatus}</span>}
              </div>
            </div>

            {/* snapshots */}
            {props.prompts.length > 0 && (
              <details className="rounded border border-neutral-800 p-2">
                <summary className="cursor-pointer text-xs text-neutral-400">
                  Prompt snapshots ({props.prompts.length}) — immutable
                </summary>
                <div className="mt-2 space-y-2">
                  {props.prompts.map((p) => (
                    <div key={p.id} className="rounded border border-neutral-800 p-2">
                      <div className="text-[10px] text-neutral-500">{new Date(p.createdAt).toLocaleString()}</div>
                      <pre className="mt-1 font-mono text-xs whitespace-pre-wrap text-neutral-300">{p.text}</pre>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {tab === "images" && <div className="mt-3"><ImagesPanel slug={props.slug} images={props.images} /></div>}
        {tab === "prose" && <div className="mt-3"><ProseEditor slug={props.slug} initial={props.proseInitial} /></div>}
      </section>
    </div>
  );
}
