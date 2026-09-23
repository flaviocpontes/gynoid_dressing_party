import type { Registry, StepRec } from "./registry";
import { getStep } from "./registry";
import type { ShoeDetails, FieldValue } from "./shoe";
import { isAbsent, isChoice, isFilled, normalizeFieldValue } from "./shoe";

export type CompileSheet = {
  upperFamily: string | null;
  details: ShoeDetails;
};

export const PREAMBLE = "Product shot. 1:1 aspect. 3/4 shot. Light studio cyclorama.";
export const SIGNATURE_PHRASE = "high-contrast mechanical chassis signature";

// ---- prose helpers ---------------------------------------------------------

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** "Jet Black" -> "jet-black" for prenominal color use. */
function adjectiveForm(value: string): string {
  const lower = value.toLowerCase();
  return lower.includes(" ") && !lower.includes("-") ? lower.replace(/\s+/g, "-") : lower;
}

/** Materials read naturally unhyphenated in attributive position (corpus style). */
function materialForm(value: string): string {
  return value.toLowerCase();
}

const PLURAL_OVERRIDES: Record<string, string> = {
  "mary-jane": "mary janes",
  "t-strap": "t-straps",
  "d'orsay": "d'orsay pumps",
  spectator: "spectator pumps",
};

function pluralize(family: string): string {
  if (PLURAL_OVERRIDES[family]) return PLURAL_OVERRIDES[family];
  if (family.endsWith("s")) return family;
  if (/(ch|sh|s|x|z)$/.test(family)) return family + "es";
  if (/[^aeiou]y$/.test(family)) return family.slice(0, -1) + "ies";
  return family + "s";
}

function joinWithOr(values: string[]): string {
  if (values.length === 1) return values[0];
  return values.slice(0, -1).join(", ") + " or " + values[values.length - 1];
}

/** Emit a field's values as prose; choice-sets join with "or". */
function fieldValueProse(v: FieldValue | null | undefined): string | null {
  const norm = normalizeFieldValue(v ?? null);
  if (!isFilled(norm) || isAbsent(norm)) return null;
  if (isChoice(norm)) return joinWithOr(norm);
  return norm as string;
}

function stepAdjectives(reg: Registry, stepId: string | null | undefined): string[] {
  const step = getStep(reg, stepId);
  return step ? step.adjectives : [];
}

function isHighZone(reg: Registry, stepId: string | null | undefined): boolean {
  const step = getStep(reg, stepId);
  return step?.zone === "high";
}

// ---- clause emitters -------------------------------------------------------

function heelNounPhrase(reg: Registry, d: ShoeDetails): string | null {
  const heel = d.heel;
  if (!heel) return null;
  const heightAdj = stepAdjectives(reg, heel.heightStep);
  const typeProse = fieldValueProse(heel.type);
  if (heightAdj.length === 0 && !typeProse) return null;
  const adjectives = heightAdj.slice();
  const noun = typeProse ? `${typeProse} heel` : "heel";
  const np = adjectives.length
    ? `${article(adjectives[0])} ${adjectives.join(", ")} ${noun}`
    : `${article(noun)} ${noun}`;
  return np;
}

function platformNounPhrase(reg: Registry, d: ShoeDetails): string | null {
  const p = d.platform;
  if (!p) return null;
  const heightAdj = stepAdjectives(reg, p.heightStep);
  const shape = fieldValueProse(p.shape);
  const material = fieldValueProse(p.material);
  if (heightAdj.length === 0 && !shape) return null;
  const adjectives = [...heightAdj];
  if (shape) adjectives.push(`${adjectiveForm(shape)}-shaped`);
  let core = adjectives.length
    ? `${article(adjectives[0])} ${adjectives.join(", ")} platform`
    : "a platform";
  if (material) core = core.replace(" platform", ` ${materialForm(material)} platform`);
  return core;
}

function toeSpringClause(reg: Registry, d: ShoeDetails): string | null {
  const p = d.platform;
  if (!p?.toeSpringStep) return null;
  const step = getStep(reg, p.toeSpringStep);
  if (!step) return null;
  return `with ${article(step.adjectives[0] ?? "")} ${step.adjectives.join(", ")}`
    .replace(/with a /, "with an ")
    .concat("");
}

function openingSentence(reg: Registry, sheet: CompileSheet): string | null {
  const d = sheet.details;
  const family = sheet.upperFamily;
  const heelNP = heelNounPhrase(reg, d);
  const platformNP = platformNounPhrase(reg, d);
  if (!family && !heelNP && !platformNP) return null;

  const mods: string[] = [];
  // overall magnitude: "towering" when heel or platform sits in the high zone
  const heelHigh = isHighZone(reg, d.heel?.heightStep);
  const platformHigh = isHighZone(reg, d.platform?.heightStep);
  if (heelHigh || platformHigh) mods.push("towering");

  const color = fieldValueProse(d.upper?.upperPrimaryColor);
  if (color) mods.push(adjectiveForm(color));
  const material = fieldValueProse(d.upper?.primaryMaterial);
  if (material) mods.push(materialForm(material));

  const subject = family ? pluralize(family) : "shoes";
  let s = `A pair of ${[...mods, subject].join(" ")}`;

  if (heelNP && platformNP) s += ` with ${heelNP} and ${platformNP}`;
  else if (heelNP || platformNP) s += ` with ${heelNP ?? platformNP}`;

  const spring = toeSpringClause(reg, d);
  if (spring && platformNP) s += ` ${spring}`;

  return s + ".";
}

function upperNarrative(d: ShoeDetails): string | null {
  const color = fieldValueProse(d.upper?.upperPrimaryColor);
  const material = fieldValueProse(d.upper?.primaryMaterial);
  if (!color && !material) return null;
  const secondary = fieldValueProse(d.upper?.secondaryMaterial);
  const made = [color, material].filter(Boolean).join(" ");
  let s = `The upper is constructed in ${made}.`;
  if (secondary) s += ` Accent panels in ${adjectiveForm(secondary)}.`;
  return s;
}

function heelNarrative(reg: Registry, d: ShoeDetails): string | null {
  const heel = d.heel;
  if (!heel) return null;
  // cross-field rule: top-zone heel over a platform -> the signature coordination clause
  const step = getStep(reg, heel.heightStep);
  const steps = reg.stepsByScale.get(step?.scaleId ?? "") ?? [];
  const isTop = !!step && steps.length > 0 && step.rank === steps[steps.length - 1].rank;
  if (!isTop || !d.platform?.heightStep) return null;
  const finish = fieldValueProse(heel.liftExternal);
  const finishAdj = finish ? materialForm(finish) : "";
  const typeProse = fieldValueProse(heel.type) ?? "heel";
  const lead = finishAdj ? `The ${finishAdj} ${typeProse} heel` : `The ${typeProse} heel`;
  return `${lead} is ultra-long and needle-thin, rising far above the platform height.`;
}

function outsoleClause(reg: Registry, d: ShoeDetails): string | null {
  const lacquer = fieldValueProse(d.outsole?.lacquerColor);
  if (!lacquer) return null;
  const glossAdj = stepAdjectives(reg, d.outsole?.lacquerGloss);
  const gloss = glossAdj.length ? `${glossAdj[0].toLowerCase()}, ` : "";
  const breast = fieldValueProse(d.heel?.breastFinish);
  let s = `The entire outsole and the inner heel breast are finished in a highly visible, ${gloss}${lacquer} lacquer`;
  if (breast && adjectiveForm(breast) !== adjectiveForm(lacquer)) {
    s += `, with the heel's inner line accentuated in ${adjectiveForm(breast)}`;
  }
  s += `, serving as a clean ${SIGNATURE_PHRASE}.`;
  return s;
}

function absenceClause(d: ShoeDetails): string | null {
  const c = d.construction;
  if (!c) return null;
  const weltAbsent = isAbsent(normalizeFieldValue(c.welt));
  const ornamentAbsent = isAbsent(normalizeFieldValue(c.ornamentation));
  if (weltAbsent && ornamentAbsent) {
    return "No visible welt, stitching, or ornamentation — the silhouette is monolithic and sculptural.";
  }
  if (weltAbsent) return "No visible welt or stitching.";
  if (ornamentAbsent) return "No visible ornamentation — the silhouette is monolithic and sculptural.";
  return null;
}

function adornmentClause(d: ShoeDetails): string | null {
  const list = d.adornments ?? [];
  if (list.length === 0) return null;
  const items = list.map((a) => {
    const type = fieldValueProse(a.type);
    if (!type) return null;
    const placement = fieldValueProse(a.placement);
    return placement ? `${type} at the ${adjectiveForm(placement)}` : type;
  }).filter(Boolean) as string[];
  if (items.length === 0) return null;
  return `Adorned with ${joinWithOr(items)}.`;
}

function shaftClause(reg: Registry, d: ShoeDetails): string | null {
  const shaft = d.shaft;
  if (!shaft?.heightStep) return null;
  const step = getStep(reg, shaft.heightStep);
  if (!step) return null;
  const fit = fieldValueProse(shaft.fit);
  return `The shaft rises to ${step.adjectives.join(", ")} height${fit ? `, ${adjectiveForm(fit)} in fit` : ""}.`;
}

function fasteningClause(d: ShoeDetails): string | null {
  const fast = d.silhouette?.fastening;
  if (!fast) return null;
  if (isAbsent(normalizeFieldValue(fast))) return null; // slip-on by omission
  const prose = fieldValueProse(fast);
  if (!prose) return null;
  const p = prose.replaceAll("-", " ");
  return `Fastened with ${/^[aeiou]/.test(p) ? "an" : "a"} ${p}.`;
}

function sensoryCloser(d: ShoeDetails): string | null {
  const light = fieldValueProse(d.sensory?.lightBehavior);
  if (!light) return null;
  const material = fieldValueProse(d.upper?.primaryMaterial);
  const surface = material ? `The ${adjectiveForm(material)} surface` : "The surface";
  return `${surface} produces ${light} under studio lighting.`;
}

// ---- entry -----------------------------------------------------------------

export function compileShoePrompt(sheet: CompileSheet, reg: Registry): string {
  const d = sheet.details ?? {};
  const sentences = [
    PREAMBLE,
    openingSentence(reg, sheet),
    upperNarrative(d),
    fasteningClause(d),
    heelNarrative(reg, d),
    shaftClause(reg, d),
    adornmentClause(d),
    outsoleClause(reg, d),
    absenceClause(d),
    sensoryCloser(d),
  ].filter((s): s is string => s !== null);
  return sentences.join("\n\n");
}

/** Digit check used by tests: compiled prompts must never contain measurements. */
export function containsDigits(text: string): boolean {
  return /\d/.test(text);
}
