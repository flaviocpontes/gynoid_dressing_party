"use client";

import { useId, useMemo, useState } from "react";
import { filterTerms } from "@/domain/registry";
import type { FieldValue } from "@/domain/shoe";
import { isAbsent, isChoice, normalizeFieldValue } from "@/domain/shoe";

type Props = {
  terms: string[];
  customTerms?: string[];
  value: FieldValue | null | undefined;
  onChange: (v: FieldValue | undefined) => void;
  onCustom?: (term: string) => void;
  allowChoice?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

const MAX_VISIBLE = 60;

/** Vocabulary combobox: type-to-filter, keyboard navigation, custom terms, chip mode for choice-sets. */
export default function VocabCombo({
  terms,
  customTerms = [],
  value,
  onChange,
  onCustom,
  allowChoice,
  disabled,
  placeholder,
}: Props) {
  const norm = normalizeFieldValue(value ?? null);
  const absent = isAbsent(norm);
  const chips = isChoice(norm) ? norm : null;
  const single = typeof norm === "string" ? norm : "";

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const all = useMemo(() => [...terms, ...customTerms], [terms, customTerms]);
  const filtered = useMemo(() => filterTerms(all, query), [all, query]);
  const listId = useId();

  function commit(term: string) {
    if (allowChoice) {
      const current = chips ?? (single ? [single] : []);
      const next = current.includes(term) ? current : [...current, term];
      onChange(next.length >= 2 ? next : next[0]);
    } else {
      onChange(term);
    }
    if (!all.includes(term)) onCustom?.(term);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
      } else if (filtered.length) {
        setActive((a) => (a + 1) % filtered.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open && filtered.length) setActive((a) => (a - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered.length && filtered[active] !== undefined) commit(filtered[active]);
      else if (query.trim()) commit(query.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showChips = allowChoice && (chips !== null || !!single);
  const chipList = chips ?? (single ? [single] : []);

  function removeChip(term: string) {
    const next = chipList.filter((c) => c !== term);
    onChange(next.length >= 2 ? next : next[0] ?? undefined);
  }

  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1">
      {showChips && chipList.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chipList.map((c) => (
            <span
              key={c}
              title={terms.includes(c) ? c : `${c} (custom term)`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                terms.includes(c)
                  ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                  : "border-amber-700 bg-amber-950/50 text-amber-200"
              }`}
            >
              {c}
              {!terms.includes(c) && <span className="text-[9px] uppercase opacity-70">custom</span>}
              <button
                aria-label={`Remove ${c}`}
                disabled={disabled}
                onClick={() => removeChip(c)}
                className="ml-0.5 text-neutral-400 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative flex items-center gap-1">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] !== undefined ? `${listId}-${active}` : undefined}
          disabled={disabled || absent}
          value={allowChoice ? query : focused ? query : single}
          placeholder={placeholder ?? (allowChoice ? "add alternative…" : "type to filter…")}
          onFocus={() => {
            setFocused(true);
            setQuery(allowChoice ? "" : single);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
            setOpen(false);
            // commit free text as a custom value (single mode only; chip adds are explicit)
            if (!allowChoice && query.trim() && query !== single) commit(query.trim());
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-36 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs disabled:opacity-40"
        />
        {!allowChoice && single && !disabled && !absent && (
          <button
            aria-label="Clear value"
            onClick={() => onChange(undefined)}
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            ×
          </button>
        )}
        {!allowChoice && single && !terms.includes(single) && (
          <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[9px] uppercase text-amber-300">custom</span>
        )}
        {open && filtered.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-full left-0 z-20 mt-1 max-h-56 w-full min-w-64 overflow-auto rounded border border-neutral-700 bg-neutral-900 py-1 shadow-lg"
          >
            {filtered.slice(0, MAX_VISIBLE).map((t, i) => (
              <li
                key={t}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(t)}
                className={`cursor-pointer px-2 py-1 text-xs ${
                  i === active ? "bg-neutral-700 text-white" : "text-neutral-300"
                } ${terms.includes(t) ? "" : "text-amber-300"}`}
              >
                {t}
                {!terms.includes(t) && <span className="ml-1 text-[9px] uppercase opacity-70">custom</span>}
              </li>
            ))}
            {filtered.length > MAX_VISIBLE && (
              <li className="px-2 py-1 text-[10px] text-neutral-500">
                …{filtered.length - MAX_VISIBLE} more — keep typing
              </li>
            )}
          </ul>
        )}
        {open && query.trim() && filtered.length === 0 && (
          <div className="absolute top-full left-0 z-20 mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-400 shadow-lg">
            press Enter to use “{query.trim()}” as a custom term
          </div>
        )}
      </div>
    </div>
  );
}
