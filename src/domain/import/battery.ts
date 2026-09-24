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
export const TEMPLATE_VERSION = "shoe-import/1";

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
  return steps.map(
    (s) =>
      `    - ${s.id} (${s.zone}): ${s.phrases.join(", ")}${s.anchors.length ? ` — anchors: ${s.anchors.join("; ")}` : ""}`,
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

function groupLines(spec: GroupSpec, reg: Registry): string[] {
  return [
    `- ${spec.path} — ${spec.label}. Answer with a JSON array of row objects using these keys:`,
    ...spec.rowFields.flatMap((rf) => fieldLine(rf, reg, "  ")),
    `  Rows without a committed ${spec.rowFields[0]?.path ?? "type"} are omitted.`,
  ];
}

function sectionFieldLines(sec: SectionSpec, reg: Registry): string[] {
  return sec.fields.flatMap((f) => (f.kind === "group" ? groupLines(f, reg) : fieldLine(f, reg)));
}

function familyPrompt(reg: Registry): string {
  const terms = reg.vocabTerms.get("upper_family") ?? [];
  return `You are determining the gross architecture of a shoe from its photograph — nothing else.
Weigh the overall construction: does it read as a boot (the upper rises above the ankle), a sandal (open and strapped), a pump (closed low-vamp upper on a heel), or another family?
Families: ${terms.join(", ")}.
Reply with a single JSON object with exactly one key: {"upperFamily": "<family>"} — one committed kebab-case family value.
Do not answer about toes, heels, materials, colors, or any section detail.`;
}

function vibePrompt(intent: string, reg: Registry): string {
  return `You are designing a shoe from a design intent, filling a structured design sheet. Commit to concrete decisions that serve the intent; hedge only where the intent is genuinely open.
Design intent: """${intent}"""

Fill in as many fields as the design intent supports — cover every section, and only omit fields the intent truly cannot determine. Do not answer with a single field when more are decidable.

${ANSWER_CONTRACT}

## Identity
${fieldLine(FAMILY_FIELD, reg).join("\n")}

## Sections
${EDITOR_SECTIONS.flatMap((s) => sectionFieldLines(s, reg)).join("\n")}`;
}

function reAskPrompt(fieldPath: string, candidates: string[], reg: Registry): string {
  const spec = resolveFieldSpec(fieldPath);
  const cand = candidates.length ? `Current candidates under consideration: ${candidates.join(", ")}.` : "";
  const line = spec
    ? fieldLine(spec, reg).join("\n")
    : `- ${fieldPath} — answer with a short kebab-case phrase; never digits or units.`;
  return `You are re-examining one field of a shoe. ${cand}
${ANSWER_CONTRACT}
Answer only this field:
${line}`;
}

export function buildPassPrompt(
  passKey: PassKey,
  reg: Registry,
  opts: { intent?: string; candidates?: string[] } = {},
): { templateVersion: string; prompt: string } {
  let prompt: string;
  if (passKey === "family") prompt = familyPrompt(reg);
  else if (passKey === "vibe") prompt = vibePrompt(opts.intent ?? "", reg);
  else if (passKey.startsWith("re-ask:"))
    prompt = reAskPrompt(passKey.slice("re-ask:".length), opts.candidates ?? [], reg);
  else {
    const sec = sectionFor(passKey as SectionPassKey);
    prompt = `You are interrogating the ${PASS_SECTION_TITLES[passKey as SectionPassKey].toLowerCase()} of a shoe from its photograph.
${ANSWER_CONTRACT}

## Fields
${sec ? sectionFieldLines(sec, reg).join("\n") : ""}`;
  }
  return { templateVersion: TEMPLATE_VERSION, prompt };
}
