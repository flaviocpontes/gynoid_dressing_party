import { isApplicable } from "@/domain/applicability";
import type { Registry } from "@/domain/registry";
import { getScaleSteps } from "@/domain/registry";
import {
  EDITOR_SECTIONS,
  type FieldSpec,
  type GroupSpec,
  type SectionField,
  type SectionSpec,
} from "@/lib/field-specs";

/** Stamped on every stored pass; prompts are snapshotted verbatim anyway. */
export const TEMPLATE_VERSION = "shoe-import/2";

/** Max seeded vocabulary terms listed per field; custom kebab-case terms stay legal. */
export const VOCAB_CAP = 12;

export type SectionPassKey =
  | "silhouette"
  | "upper"
  | "platform"
  | "heel"
  | "transition"
  | "straps"
  | "counter"
  | "adornments"
  | "shaft"
  | "construction"
  | "sensory";

export type PassKey = "family" | "vibe" | SectionPassKey | `re-ask:${string}`;

export const SECTION_PASS_KEYS: SectionPassKey[] = [
  "silhouette",
  "upper",
  "platform",
  "heel",
  "transition",
  "straps",
  "counter",
  "adornments",
  "shaft",
  "construction",
  "sensory",
];

const PASS_SECTION_TITLES: Record<SectionPassKey, string> = {
  silhouette: "Silhouette",
  upper: "Upper & colorway",
  platform: "Platform",
  heel: "Heel",
  transition: "Upper-platform transition",
  straps: "Straps",
  counter: "Counter & hardware",
  adornments: "Adornments",
  shaft: "Shaft (boots)",
  construction: "Construction detail",
  sensory: "Sensory",
};

/** The family pseudo-field: identity-level, not a details path. */
export const FAMILY_FIELD: FieldSpec = {
  path: "upperFamily",
  label: "Upper family",
  kind: "vocab",
  vocab: "upper_family",
};

function sectionFor(passKey: SectionPassKey): SectionSpec | undefined {
  return EDITOR_SECTIONS.find((s) => s.title === PASS_SECTION_TITLES[passKey]);
}

/** Section passes whose fields apply to the family (applicability table gating). */
export function selectBattery(family: string | null | undefined): SectionPassKey[] {
  return SECTION_PASS_KEYS.filter((k) => {
    const sec = sectionFor(k);
    if (!sec) return false;
    return sec.fields.some((f) => isApplicable(family, f.path));
  });
}

/** Fields a pass asks about (re-ask passes get their single resolved spec). */
export function fieldsForPass(passKey: PassKey): SectionField[] {
  if (passKey === "family") return [FAMILY_FIELD];
  if (passKey === "vibe") {
    return [FAMILY_FIELD, ...EDITOR_SECTIONS.flatMap((s) => s.fields)];
  }
  if (passKey.startsWith("re-ask:")) {
    const spec = resolveFieldSpec(passKey.slice("re-ask:".length));
    return spec ? [spec] : [];
  }
  const sec = sectionFor(passKey as SectionPassKey);
  return sec ? sec.fields : [];
}

/** Resolve a sheet path to its spec; numeric row indices are stripped (straps.0.type -> straps.type). */
export function resolveFieldSpec(path: string): FieldSpec | undefined {
  const flat = path.replace(/\.\d+\./g, ".").replace(/\.\d+$/, "");
  for (const sec of EDITOR_SECTIONS) {
    for (const f of sec.fields) {
      if (f.kind === "group") {
        const row = f.rowFields.find((rf) => flat === `${f.path}.${rf.path}`);
        if (row) return row;
      } else if (f.path === flat) {
        return f;
      }
    }
  }
  return undefined;
}

// ---- prompt assembly ---------------------------------------------------------

const ANSWER_CONTRACT = `Answer only about the fields listed below and only what the source supports.
Reply with a single JSON object mapping each field path to exactly one answer:
- a string: a committed answer (prefer a listed term; otherwise a short kebab-case phrase; never digits, never units, never measurements)
- an array of strings: a hedged answer naming the alternatives you cannot decide between
- "not-present": the feature is definitively absent from this shoe
- "cannot-discern": you cannot tell from this source
Omit any field you cannot see at all. Never invent detail.`;

function vocabTermsLine(spec: FieldSpec, reg: Registry): string {
  const terms = (spec.vocab ? reg.vocabTerms.get(spec.vocab) : undefined) ?? [];
  const listed = terms.slice(0, VOCAB_CAP);
  const suffix = terms.length > listed.length ? " (listing capped; other kebab-case terms are allowed)" : "";
  return listed.length ? ` Allowed terms: ${listed.join(", ")}.${suffix}` : "";
}

function scaleLines(spec: FieldSpec, reg: Registry): string[] {
  const steps = getScaleSteps(reg, spec.scale ?? "");
  if (!steps.length) return ["    (no scale steps loaded for this field)"];
  // the id is never followed by a parenthetical, which models copied into answers ("…:9 (high)")
  return steps.map(
    (s) =>
      `    - ${s.id}: ${s.phrases.join(", ")} [${s.zone} zone]${s.anchors.length ? ` — anchors: ${s.anchors.join("; ")}` : ""}`,
  );
}

function fieldLine(spec: FieldSpec, reg: Registry, indent = ""): string[] {
  if (spec.kind === "vocab") {
    return [`${indent}- ${spec.path} — ${spec.label}.${vocabTermsLine(spec, reg)}`];
  }
  if (spec.kind === "scale") {
    return [
      `${indent}- ${spec.path} — ${spec.label}. Answer with the id of the step whose anchors and phrases best match, copied exactly. Never answer with a number, measurement, or unit.`,
      ...scaleLines(spec, reg).map((l) => indent + l),
    ];
  }
  return [`${indent}- ${spec.path} — ${spec.label}. A short descriptive kebab-case phrase; never digits or units.`];
}

function groupLines(spec: GroupSpec, reg: Registry, family: string | null): string[] {
  const rows = spec.rowFields.filter((rf) => applies(family, `${spec.path}.${rf.path}`));
  return [
    `- ${spec.path} — ${spec.label}. Answer with a JSON array of row objects using these keys:`,
    ...rows.flatMap((rf) => fieldLine(rf, reg, "  ")),
    `  Rows without a committed ${spec.rowFields[0]?.path ?? "type"} are omitted.`,
  ];
}

/** Without a confirmed family nothing is filtered (vibe/legacy prompts). */
function applies(family: string | null, path: string): boolean {
  return !family || isApplicable(family, path);
}

function sectionFieldLines(sec: SectionSpec, reg: Registry, family: string | null = null): string[] {
  return sec.fields
    .filter((f) => applies(family, f.path))
    .flatMap((f) => (f.kind === "group" ? groupLines(f, reg, family) : fieldLine(f, reg)));
}

function familyLine(family: string | null): string {
  return family ? `\nThis shoe is a ${family} (confirmed).` : "";
}

/** What the run interrogates: a photograph, or a free-text design intent. */
export type PromptSource = { kind: "image" } | { kind: "intent"; text: string };

const IMAGE_SOURCE: PromptSource = { kind: "image" };

function intentBlock(source: PromptSource): string {
  return source.kind === "intent" ? `\nDesign intent: """${source.text}"""` : "";
}

function familyPrompt(reg: Registry, source: PromptSource): string {
  const terms = reg.vocabTerms.get("upper_family") ?? [];
  const opening =
    source.kind === "image"
      ? "You are determining the gross architecture of a shoe from its photograph — nothing else."
      : "You are determining the gross architecture of a shoe described by a design intent — nothing else." +
        intentBlock(source);
  return `${opening}
Weigh the overall construction: does it read as a boot (the upper rises above the ankle), a sandal (open and strapped), a pump (closed low-vamp upper on a heel), or another family?
Families: ${terms.join(", ")}.
Reply with a single JSON object with exactly one key: {"upperFamily": "<family>"} — one committed kebab-case family value.
Do not answer about toes, heels, materials, colors, or any section detail.`;
}

function sectionPrompt(passKey: SectionPassKey, reg: Registry, source: PromptSource, family: string | null): string {
  const title = PASS_SECTION_TITLES[passKey].toLowerCase();
  const opening =
    source.kind === "image"
      ? `You are interrogating the ${title} of a shoe from its photograph.`
      : `You are designing the ${title} of a shoe from a design intent, filling a structured design sheet. Commit to concrete decisions that serve the intent; hedge only where the intent is genuinely open.` +
        intentBlock(source);
  const sec = sectionFor(passKey);
  return `${opening}${familyLine(family)}
${ANSWER_CONTRACT}

## Fields
${sec ? sectionFieldLines(sec, reg, family).join("\n") : ""}`;
}

function reAskPrompt(
  fieldPath: string,
  candidates: string[],
  reg: Registry,
  source: PromptSource,
  family: string | null,
): string {
  const spec = resolveFieldSpec(fieldPath);
  const cand = candidates.length ? `Current candidates under consideration: ${candidates.join(", ")}.` : "";
  const line = spec
    ? fieldLine(spec, reg).join("\n")
    : `- ${fieldPath} — answer with a short kebab-case phrase; never digits or units.`;
  return `You are re-examining one field of a shoe. ${cand}${familyLine(family)}${intentBlock(source)}
${ANSWER_CONTRACT}
Answer only this field:
${line}`;
}

export function buildPassPrompt(
  passKey: PassKey,
  reg: Registry,
  opts: { source?: PromptSource; candidates?: string[]; family?: string | null } = {},
): { templateVersion: string; prompt: string } {
  const source = opts.source ?? IMAGE_SOURCE;
  const family = opts.family ?? null;
  let prompt: string;
  if (passKey === "vibe") throw new Error("vibe passes are retired; the key is kept only to parse legacy rows");
  if (passKey === "family") prompt = familyPrompt(reg, source);
  else if (passKey.startsWith("re-ask:"))
    prompt = reAskPrompt(passKey.slice("re-ask:".length), opts.candidates ?? [], reg, source, family);
  else prompt = sectionPrompt(passKey as SectionPassKey, reg, source, family);
  return { templateVersion: TEMPLATE_VERSION, prompt };
}
