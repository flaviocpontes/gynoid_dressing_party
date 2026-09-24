import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/db";
import { loadRegistrySync, type Registry } from "@/domain/registry";
import { lintShoe } from "@/domain/lint";
import { selectBattery, resolveFieldSpec } from "@/domain/import/battery";
import { ABSENCE_ALLOWED } from "@/domain/shoe";
import { getRun, listPasses, readWorkingSheet, unresolvedChoicePaths, type WorkingSheet } from "@/lib/import";
import {
  runFamilyPassAction,
  confirmFamilyAction,
  runBatteryAction,
  runVibePassAction,
  reAskAction,
  mutateFieldAction,
  setIdentityAction,
  acceptRunAction,
  discardRunAction,
} from "../actions";

export const dynamic = "force-dynamic";

type Entry = {
  path: string;
  label: string;
  kind: "value" | "choice" | "absent";
  value: string;
  candidates?: string[];
};

function displayEntries(sheet: WorkingSheet): Entry[] {
  const out: Entry[] = [];
  const walk = (obj: unknown, prefix: string) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const path = prefix ? `${prefix}.${k}` : k;
      const label = resolveFieldSpec(path)?.label ?? path;
      if (Array.isArray(v)) {
        if (v.length && v.every((el) => typeof el === "string")) {
          out.push({ path, label, kind: "choice", value: v.join(" / "), candidates: v });
        } else {
          v.forEach((row, i) => walk(row, `${path}.${i}`));
        }
      } else if (v && typeof v === "object" && "absent" in v) {
        out.push({ path, label, kind: "absent", value: "absent" });
      } else if (v && typeof v === "object") {
        walk(v, path);
      } else if (v !== null && v !== undefined && v !== "") {
        out.push({ path, label, kind: "value", value: String(v) });
      }
    }
  };
  walk(sheet.details, "");
  return out;
}

function flatPath(path: string): string {
  return path.replace(/\.\d+\./g, ".").replace(/\.\d+$/, "");
}

const btn = "rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-40";
const input = "rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs";

function FieldEditor({ runId, entry, reg, sheet, passes }: {
  runId: string;
  entry: Entry;
  reg: Registry;
  sheet: WorkingSheet;
  passes: Awaited<ReturnType<typeof listPasses>>;
}) {
  const spec = resolveFieldSpec(entry.path);
  const provenance = sheet.provenance[entry.path];
  const note = sheet.notes[entry.path];
  const sourcePass =
    provenance && provenance !== "user"
      ? [...passes].reverse().find((p) => p.passKey === provenance)
      : undefined;
  const absenceLegal = spec ? ABSENCE_ALLOWED.has(spec.path) : false;

  const vocabId = spec?.kind === "vocab" ? spec.vocab : undefined;
  const terms = vocabId ? (reg.vocabTerms.get(vocabId) ?? []) : [];
  const scaleId = spec?.kind === "scale" ? spec.scale : undefined;
  const steps = scaleId
    ? (reg.stepsByScale.get(scaleId) ?? []).map((s) => ({ id: s.id, label: `${s.id} (${s.zone})` }))
    : [];

  return (
    <li className="border-b border-neutral-800 px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{entry.label}</span>
        <code className="text-[11px] text-neutral-500">{entry.path}</code>
        {entry.kind === "choice" && (
          <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[11px] text-amber-300">choice-set — resolve to accept</span>
        )}
        {entry.kind === "absent" && (
          <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-300">absent</span>
        )}
        {provenance && (
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-400">
            {provenance === "user" ? "user" : `machine: ${provenance}`}
          </span>
        )}
      </div>

      <div className="mt-1 text-sm text-neutral-200">{entry.kind === "absent" ? "explicitly not present" : entry.value}</div>
      {note && <div className="mt-1 text-xs text-amber-400">note: {note}</div>}

      {sourcePass && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-neutral-500">provenance — pass {sourcePass.passKey}</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-neutral-950 p-2 text-[11px] text-neutral-400">{sourcePass.responseText}</pre>
        </details>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {entry.kind !== "absent" && (
          <form action={mutateFieldAction} className="flex items-center gap-1.5">
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="path" value={entry.path} />
            <input type="hidden" name="op" value={entry.kind === "choice" ? "resolve" : "edit"} />
            {steps.length > 0 ? (
              <select name="value" defaultValue="" className={input}>
                <option value="">{entry.kind === "choice" ? "pick a step…" : "change step…"}</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            ) : (
              <>
                <input name="value" list={`dl-${vocabId ?? "none"}`} placeholder={entry.kind === "choice" ? "resolve to…" : "edit…"} className={input} />
                {vocabId && (
                  <datalist id={`dl-${vocabId}`}>
                    {terms.map((t) => <option key={t} value={t} />)}
                  </datalist>
                )}
              </>
            )}
            <button className={btn}>save</button>
          </form>
        )}
        {entry.kind === "value" && (
          <form action={mutateFieldAction}>
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="path" value={entry.path} />
            <input type="hidden" name="op" value="accept" />
            <button className={btn}>accept</button>
          </form>
        )}
        <form action={reAskAction}>
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="path" value={entry.path} />
          <button className={btn}>re-ask</button>
        </form>
        {entry.kind !== "absent" && (
          <form action={mutateFieldAction}>
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="path" value={entry.path} />
            <input type="hidden" name="op" value="clear" />
            <button className={btn}>clear</button>
          </form>
        )}
        {entry.kind !== "absent" && absenceLegal && (
          <form action={mutateFieldAction}>
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="path" value={entry.path} />
            <input type="hidden" name="op" value="absent" />
            <button className={btn}>mark absent</button>
          </form>
        )}
      </div>
    </li>
  );
}

export default async function ImportRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const db = getDb();
  const run = await getRun(db, runId);
  if (!run) notFound();
  const reg = loadRegistrySync(db);
  const passes = await listPasses(db, runId);
  const sheet = readWorkingSheet(run);
  const families = reg.vocabTerms.get("upper_family") ?? [];

  const isImage = run.sourceType === "image";
  const sheetKind = isImage ? "imported" : "authored";
  const familyPass = passes.find((p) => p.passKey === "family");
  const vibePass = passes.find((p) => p.passKey === "vibe");
  const batteryKeys = run.family ? selectBattery(run.family) : [];
  const passByKey = new Map(passes.filter((p) => !(p.responseText ?? "").startsWith("error:")).map((p) => [p.passKey, p]));
  const pendingBattery = batteryKeys.filter((k) => !passByKey.has(k));
  const warnings = lintShoe({ upperFamily: sheet.upperFamily, details: sheet.details, sheetKind }, reg);
  const choices = unresolvedChoicePaths(sheet);
  const identityOk = /^[a-z0-9][a-z0-9-]*$/.test(sheet.slug) && sheet.displayName.trim().length > 0;
  const gateOk = choices.length === 0 && identityOk;
  const entries = displayEntries(sheet);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          {isImage ? "Photo import" : "Vibe import"}
          <span className="ml-3 rounded bg-neutral-800 px-2 py-0.5 text-xs font-normal text-neutral-400">
            {run.status}
            {run.status === "open" && (run.family ? ` — family: ${run.family}` : " — awaiting family")}
          </span>
        </h1>
        <Link href="/shoes/import" className="text-sm text-neutral-400 hover:text-neutral-200">all runs</Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* source + wizard column */}
        <div className="space-y-4">
          <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
            <h2 className="text-sm font-medium">Source</h2>
            {run.sourceImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={run.sourceImagePath.replace(/^data\/images\//, "/api/images/")}
                alt="import source"
                className="mt-2 w-full rounded border border-neutral-800"
              />
            ) : (
              <p className="mt-2 text-sm text-neutral-300">{run.sourceIntentText}</p>
            )}
          </section>

          {run.status === "open" && (
            <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
              <h2 className="text-sm font-medium">Wizard</h2>

              {isImage && !run.family && !familyPass && (
                <form action={runFamilyPassAction} className="mt-2">
                  <input type="hidden" name="runId" value={run.id} />
                  <button className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
                    Run family pass
                  </button>
                  <p className="mt-1 text-xs text-neutral-500">Pass 0: gross architecture only.</p>
                </form>
              )}

              {isImage && !run.family && familyPass && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm">
                    Proposed family:{" "}
                    <span className="font-medium">{sheet.upperFamily ?? "—"}</span>
                  </p>
                  <form action={confirmFamilyAction} className="flex items-center gap-2">
                    <input type="hidden" name="runId" value={run.id} />
                    <select name="family" defaultValue={sheet.upperFamily ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm">
                      {families.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <button className={btn}>confirm family</button>
                  </form>
                  <details>
                    <summary className="cursor-pointer text-xs text-neutral-500">raw pass 0 response</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-neutral-950 p-2 text-[11px] text-neutral-400">{familyPass.responseText}</pre>
                  </details>
                </div>
              )}

              {isImage && run.family && pendingBattery.length > 0 && (
                <form action={runBatteryAction} className="mt-2">
                  <input type="hidden" name="runId" value={run.id} />
                  <button className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
                    Run battery ({batteryKeys.length} passes)
                  </button>
                  <ul className="mt-2 space-y-1 text-xs">
                    {batteryKeys.map((k) => {
                      const p = passByKey.get(k);
                      const failed = p?.responseText?.startsWith("error:");
                      return (
                        <li key={k} className="flex items-center justify-between">
                          <span className="text-neutral-400">{k}</span>
                          <span className={failed ? "text-red-400" : p ? "text-green-400" : "text-neutral-600"}>
                            {failed ? "failed" : p ? "done" : "pending"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </form>
              )}

              {!isImage && !vibePass && (
                <form action={runVibePassAction} className="mt-2">
                  <input type="hidden" name="runId" value={run.id} />
                  <button className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
                    Generate draft
                  </button>
                  <p className="mt-1 text-xs text-neutral-500">One full-template design pass from the intent.</p>
                </form>
              )}
            </section>
          )}

          <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
            <h2 className="text-sm font-medium">Pass log ({passes.length})</h2>
            <ul className="mt-2 space-y-2">
              {passes.map((p) => (
                <li key={p.id}>
                  <details>
                    <summary className="cursor-pointer text-xs text-neutral-400">
                      {p.passKey} <span className="text-neutral-600">· {p.templateVersion}</span>
                    </summary>
                    <div className="mt-1 space-y-1">
                      <pre className="max-h-60 overflow-auto rounded bg-neutral-950 p-2 text-[11px] text-neutral-300">{p.promptText}</pre>
                      <pre className="max-h-60 overflow-auto rounded bg-neutral-950 p-2 text-[11px] text-neutral-500">{p.responseText}</pre>
                    </div>
                  </details>
                </li>
              ))}
              {passes.length === 0 && <li className="text-xs text-neutral-600">no passes yet</li>}
            </ul>
          </section>
        </div>

        {/* review column */}
        <div className="space-y-4">
          {run.status === "accepted" && (
            <section className="rounded border border-green-800 bg-green-950/40 p-4 text-sm text-green-300">
              Run accepted — the shoe was created with sheet kind <strong>{sheetKind}</strong>.
              <Link href="/" className="ml-2 underline">gallery</Link>
            </section>
          )}
          {run.status === "discarded" && (
            <section className="rounded border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-400">
              Run discarded — no shoe was created.
            </section>
          )}

          <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
            <h2 className="text-sm font-medium">Identity</h2>
            <form action={setIdentityAction} className="mt-2 grid gap-2 sm:grid-cols-3">
              <input type="hidden" name="runId" value={run.id} />
              <input name="slug" defaultValue={sheet.slug} placeholder="slug (kebab-case)" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm" />
              <input name="displayName" defaultValue={sheet.displayName} placeholder="display name" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm" />
              <select name="upperFamily" defaultValue={sheet.upperFamily ?? ""} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm">
                <option value="">family: unset</option>
                {families.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <button className={`${btn} justify-self-start`}>save identity</button>
            </form>
          </section>

          {warnings.length > 0 && (
            <section className="rounded border border-amber-800 bg-amber-950/30 p-4">
              <h2 className="text-sm font-medium text-amber-300">Lint ({warnings.length}) — warnings do not block acceptance</h2>
              <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
                {warnings.map((w, i) => (
                  <li key={i}><code className="text-amber-400">{w.field}</code>: {w.message}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded border border-neutral-700 bg-neutral-900">
            <h2 className="px-4 pt-4 text-sm font-medium">Proposed sheet ({entries.length} filled)</h2>
            <ul className="mt-2">
              {entries.map((e) => (
                <FieldEditor key={e.path} runId={run.id} entry={e} reg={reg} sheet={sheet} passes={passes} />
              ))}
              {entries.length === 0 && (
                <li className="px-4 pb-4 text-xs text-neutral-600">nothing proposed yet</li>
              )}
            </ul>
          </section>

          {run.status === "open" && (
            <section className="rounded border border-neutral-700 bg-neutral-900 p-4">
              <h2 className="text-sm font-medium">Accept or discard</h2>
              {gateOk ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Gate clear: no unresolved choice-sets, slug and display name present.
                </p>
              ) : (
                <ul className="mt-1 list-inside list-disc text-xs text-amber-400">
                  {choices.length > 0 && <li>unresolved choice-sets: {choices.join(", ")}</li>}
                  {!identityOk && <li>identity incomplete (kebab-case slug + display name required)</li>}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <form action={acceptRunAction}>
                  <input type="hidden" name="runId" value={run.id} />
                  <button className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white">
                    Accept as {sheetKind} sheet
                  </button>
                </form>
                <form action={discardRunAction}>
                  <input type="hidden" name="runId" value={run.id} />
                  <button className={btn}>discard run</button>
                </form>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
