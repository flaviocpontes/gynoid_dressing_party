"use client";

import type { ReactNode } from "react";
import type { FieldSpec } from "@/lib/field-specs";

type Props = {
  groupPath: string;
  label: string;
  rows: Record<string, unknown>[];
  rowFields: FieldSpec[];
  onRowsChange: (rows: Record<string, unknown>[]) => void;
  renderField: (spec: FieldSpec, absPath: string) => ReactNode;
};

/** Structured repeatable rows: per-field widgets via renderField, with add/remove/reorder. */
export default function GroupRows({ groupPath, label, rows, rowFields, onRowsChange, renderField }: Props) {
  function move(i: number, j: number) {
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onRowsChange(next);
  }

  const btn =
    "rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-30";

  return (
    <div id={`f-${groupPath}`} className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="rounded border border-neutral-800 bg-neutral-900/40 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300">
              {label} {i + 1}
            </span>
            <div className="flex gap-1">
              <button aria-label="Move row up" disabled={i === 0} onClick={() => move(i, i - 1)} className={btn}>↑</button>
              <button aria-label="Move row down" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} className={btn}>↓</button>
              <button aria-label="Remove row" onClick={() => onRowsChange(rows.filter((_, j) => j !== i))} className={btn}>✕</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {rowFields.map((rf) => renderField(rf, `${groupPath}.${i}.${rf.path}`))}
          </div>
        </div>
      ))}
      <button
        onClick={() => onRowsChange([...rows, {}])}
        className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
      >
        + add {label.toLowerCase()} row
      </button>
    </div>
  );
}
