import type { Registry } from "./registry";
import { getStep } from "./registry";
import type { FieldValue, ShoeDetails } from "./shoe";
import { isChoice, isFilled, normalizeFieldValue } from "./shoe";

export type LintWarning = { field: string; message: string };

function valuesProse(v: FieldValue | null | undefined): string[] {
  const norm = normalizeFieldValue(v ?? null);
  if (!isFilled(norm) || (typeof norm === "object" && !Array.isArray(norm))) return [];
  return Array.isArray(norm) ? norm : [norm];
}

export function lintShoe(
  sheet: { upperFamily: string | null; details: ShoeDetails },
  reg: Registry,
): LintWarning[] {
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

  return warnings;
}
