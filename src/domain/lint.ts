import type { Registry } from "./registry";
import { getStep } from "./registry";
import { isApplicable } from "./applicability";
import type { FieldValue, ShoeDetails } from "./shoe";
import { isAbsent, isChoice, isFilled, normalizeFieldValue } from "./shoe";

export type LintWarning = { field: string; message: string };

export type LintSheet = {
  upperFamily: string | null;
  details: ShoeDetails;
  sheetKind?: "authored" | "imported";
};

function valuesProse(v: FieldValue | null | undefined): string[] {
  const norm = normalizeFieldValue(v ?? null);
  if (!isFilled(norm) || (typeof norm === "object" && !Array.isArray(norm))) return [];
  return Array.isArray(norm) ? norm : [norm];
}

/** All filled leaf paths (array rows descend with indexed paths; the array itself counts as filled). */
function filledLeaves(obj: unknown, prefix: string, out: [string, unknown][] = []): [string, unknown][] {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      if (v.length) out.push([path, v]);
      v.forEach((row, i) => filledLeaves(row, `${path}.${i}`, out));
    } else if (v && typeof v === "object") {
      filledLeaves(v, path, out);
    } else if (v !== null && v !== undefined) {
      out.push([path, v]);
    }
  }
  return out;
}

/** Absence-vs-filled contradiction pairs (rules as data). */
const ABSENCE_RELATIONS: {
  absentPath: string;
  contradictsPrefix: string;
  rowField?: string;
  message: string;
}[] = [
  {
    absentPath: "silhouette.fastening",
    contradictsPrefix: "straps",
    rowField: "closure",
    message: "Fastening is explicitly absent, but a strap row carries a closure.",
  },
];

export function lintShoe(sheet: LintSheet, reg: Registry): LintWarning[] {
  const warnings: LintWarning[] = [];
  const d = sheet.details ?? {};
  const heelTypes = valuesProse(d.heel?.type);
  const heelStep = getStep(reg, d.heel?.heightStep);
  const heelHigh = heelStep?.zone === "high";

  // 1. kitten heel at a high-zone height
  if (heelTypes.includes("kitten") && heelHigh) {
    warnings.push({
      field: "heel.type",
      message: "Kitten heel combined with a high-zone heel height — kitten heels are physically low.",
    });
  }

  // 2. closed vamp with an open toe shape
  const vamp = valuesProse(d.silhouette?.vampCoverage)[0];
  const toe = valuesProse(d.silhouette?.toeShape)[0];
  if (vamp === "full-coverage" && toe && /^(peep|open|keyhole|heart-peep)/.test(toe)) {
    warnings.push({
      field: "silhouette.toeShape",
      message: `Full-coverage vamp conflicts with open toe shape "${toe}".`,
    });
  }

  // 3. ballet/pony/heel-less at a low height
  if (
    heelTypes.some((t) => ["ballet-heel", "pony-heel", "heel-less"].includes(t)) &&
    heelStep &&
    heelStep.rank <= 2
  ) {
    warnings.push({
      field: "heel.heightStep",
      message: `${heelTypes.join("/")} implies an extreme height; selected step is low.`,
    });
  }

  // 4. boot family without shaft height
  if (["boot", "bootie", "shootie"].includes(sheet.upperFamily ?? "") && !d.shaft?.heightStep) {
    warnings.push({
      field: "shaft.heightStep",
      message: `${sheet.upperFamily} upper family usually wants a shaft height.`,
    });
  }

  // 5. choice-set mixing heel architecture families
  if (isChoice(normalizeFieldValue(d.heel?.type))) {
    const hasWedge = heelTypes.some((t) => t.includes("wedge") || t === "flatform");
    const hasColumnar = heelTypes.some((t) =>
      ["stiletto", "pin-heel", "kitten", "column", "spool", "louis"].includes(t),
    );
    if (hasWedge && hasColumnar) {
      warnings.push({
        field: "heel.type",
        message: "Choice-set mixes wedge and non-wedge heel architectures.",
      });
    }
  }

  // 6. digit-containing values (numeric ban hygiene for prompt compilation)
  const numericScan = (v: FieldValue | null | undefined, path: string) => {
    for (const val of valuesProse(v)) {
      if (/\d/.test(val)) {
        warnings.push({
          field: path,
          message: `Value "${val}" contains digits; compiled prompts must avoid numeric measurements.`,
        });
      }
    }
  };
  numericScan(d.upper?.primaryMaterial, "upper.primaryMaterial");
  numericScan(d.upper?.upperPrimaryColor, "upper.upperPrimaryColor");
  numericScan(d.outsole?.lacquerColor, "outsole.lacquerColor");

  // 7. applicability violations: filled paths that cannot apply to this family
  //    (unfilled N/A paths stay silent by construction — only filled paths scan)
  const leaves = filledLeaves(d, "");
  const flaggedPrefixes = new Set<string>();
  for (const [path] of leaves) {
    if (isApplicable(sheet.upperFamily, path)) continue;
    const prefix = path.split(".")[0];
    if (flaggedPrefixes.has(prefix)) continue;
    flaggedPrefixes.add(prefix);
    warnings.push({
      field: path,
      message: `"${prefix}" section does not apply to ${sheet.upperFamily ?? "this upper family"}.`,
    });
  }

  // 8. absence-vs-filled contradictions (relation table)
  for (const rel of ABSENCE_RELATIONS) {
    const absentVal = rel.absentPath.split(".").reduce<unknown>(
      (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
      d,
    );
    if (!isAbsent(normalizeFieldValue(absentVal as FieldValue))) continue;
    const target = rel.contradictsPrefix.split(".").reduce<unknown>(
      (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
      d,
    );
    const contradicted = Array.isArray(target)
      ? target.some(
          (row) =>
            row && typeof row === "object" &&
            (!rel.rowField || isFilled(normalizeFieldValue((row as Record<string, unknown>)[rel.rowField!] as FieldValue))),
        )
      : isFilled(normalizeFieldValue(target as FieldValue));
    if (contradicted) {
      warnings.push({ field: rel.contradictsPrefix, message: rel.message });
    }
  }

  // 9. assertiveness: imported sheets describe real shoes; unresolved choice-sets warn
  if (sheet.sheetKind === "imported") {
    for (const [path, v] of leaves) {
      if (isChoice(normalizeFieldValue(v as FieldValue))) {
        warnings.push({
          field: path,
          message: `Imported sheet must be assertive: "${path}" is an unresolved choice-set.`,
        });
      }
    }
  }

  return warnings;
}
