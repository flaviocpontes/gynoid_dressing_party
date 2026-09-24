"use client";

import type { SerializedStep } from "@/domain/registry";

type Props = {
  steps: SerializedStep[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
};

const ZONES: { key: "low" | "neutral" | "high"; label: string }[] = [
  { key: "low", label: "low extreme" },
  { key: "neutral", label: "neutral" },
  { key: "high", label: "high extreme" },
];

const ZONE_STYLE: Record<string, string> = {
  low: "border-sky-800 bg-sky-950/40 text-sky-300",
  neutral: "border-neutral-700 bg-neutral-800 text-neutral-300",
  high: "border-rose-800 bg-rose-950/40 text-rose-300",
};

/** Ordinal scale stepper: zone-grouped steps with phrases, anchors and an emit-fragment preview. */
export default function ScaleStepper({ steps, value, onChange }: Props) {
  const sorted = [...steps].sort((a, b) => a.rank - b.rank);
  const selected = sorted.find((s) => s.id === value);

  function stepBy(offset: number) {
    if (sorted.length === 0) return;
    const i = selected ? sorted.indexOf(selected) : -1;
    const next = i + offset;
    if (next < 0 || next >= sorted.length) return;
    onChange(sorted[next].id);
  }

  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1">
      <div
        tabIndex={0}
        role="group"
        aria-label="scale steps"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            stepBy(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            stepBy(-1);
          } else if (e.key === "Backspace" || e.key === "Delete") {
            onChange(undefined);
          }
        }}
        className="flex flex-wrap items-center gap-2 rounded border border-neutral-800 bg-neutral-900/60 p-1"
      >
        {ZONES.map(({ key, label }) => {
          const group = sorted.filter((s) => s.zone === key);
          if (group.length === 0) return null;
          return (
            <div key={key} className="flex items-center gap-0.5">
              <span className="mr-0.5 text-[9px] uppercase tracking-wide text-neutral-600">{label}</span>
              {group.map((s) => (
                <button
                  key={s.id}
                  title={`${s.phrases.join(" / ")}${s.anchors.length ? ` — ${s.anchors.join("; ")}` : ""}`}
                  aria-pressed={s.id === value}
                  onClick={() => onChange(s.id === value ? undefined : s.id)}
                  className={`h-7 w-7 rounded border text-xs font-medium ${
                    s.id === value ? "border-white bg-white text-neutral-900" : ZONE_STYLE[key]
                  }`}
                >
                  {s.rank}
                </button>
              ))}
            </div>
          );
        })}
        {value && (
          <button
            aria-label="Clear step"
            onClick={() => onChange(undefined)}
            className="ml-auto rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            ×
          </button>
        )}
      </div>
      <div className="rounded bg-neutral-900/60 px-2 py-1 text-[11px] leading-relaxed text-neutral-400">
        {selected ? (
          <>
            <span className="text-neutral-200">{selected.phrases.join(" / ")}</span>
            {selected.anchors.length > 0 && (
              <> · anchors: <span className="text-neutral-500">{selected.anchors.join(" · ")}</span></>
            )}
            <br />
            will emit: <code className="text-emerald-400">{selected.adjectives.join(", ")}</code>
          </>
        ) : (
          <em>unfilled — no clause will be emitted</em>
        )}
      </div>
    </div>
  );
}
