import type { Registry, StepRec } from "./registry";
import { getStep } from "./registry";
import type { ShoeDetails, FieldValue } from "./shoe";
import { isAbsent, isChoice, isFilled, normalizeFieldValue } from "./shoe";

export type CompileSheet = {
  upperFamily: string | null;
  details: ShoeDetails;
};

/** A compiled clause with provenance: which section owns it and which sheet fields emitted it. */
export type Clause = {
  sectionKey: string;
  fieldPaths: string[];
  text: string;
};

export const PREAMBLE = "Product shot. 1:1 aspect. 3/4 shot. Light studio cyclorama.";
export const SIGNATURE_PHRASE = "high-contrast mechanical chassis signature";

const WELT_ABSENT_TEXT = "No visible welt or stitching.";
const ORNAMENT_ABSENT_TEXT = "No visible ornamentation — the silhouette is monolithic and sculptural.";
const BOTH_ABSENT_TEXT =
  "No visible welt, stitching, or ornamentation — the silhouette is monolithic and sculptural.";

/** What the prompt gains when a field is toggled to explicit absence (UI preview). */
export function absencePreviewText(path: string): string {
  switch (path) {
    case "construction.welt":
      return WELT_ABSENT_TEXT;
    case "construction.ornamentation":
      return ORNAMENT_ABSENT_TEXT;
    case "silhouette.fastening":
      return "Slip-on by omission — no fastening clause is emitted.";
    default:
      return "Field omitted from the prompt (no clause).";
  }
}

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

/** kebab-case term -> prose ("heel-collar" -> "heel collar"). */
function prettify(value: string): string {
  return value.replaceAll("-", " ");
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

function heelNounPhrase(reg: Registry, d: ShoeDetails): { text: string; fieldPaths: string[] } | null {
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
  const fieldPaths: string[] = [];
  if (heightAdj.length) fieldPaths.push("heel.heightStep");
  if (typeProse) fieldPaths.push("heel.type");
  return { text: np, fieldPaths };
}

function platformNounPhrase(reg: Registry, d: ShoeDetails): { text: string; fieldPaths: string[] } | null {
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
  const fieldPaths: string[] = [];
  if (heightAdj.length) fieldPaths.push("platform.heightStep");
  if (shape) fieldPaths.push("platform.shape");
  if (material) fieldPaths.push("platform.material");
  return { text: core, fieldPaths };
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

function openingSentence(reg: Registry, sheet: CompileSheet): Clause | null {
  const d = sheet.details;
  const family = sheet.upperFamily;
  const heelNP = heelNounPhrase(reg, d);
  const platformNP = platformNounPhrase(reg, d);
  if (!family && !heelNP && !platformNP) return null;

  const fieldPaths: string[] = [];
  const mods: string[] = [];
  // overall magnitude: "towering" when heel or platform sits in the high zone
  const heelHigh = isHighZone(reg, d.heel?.heightStep);
  const platformHigh = isHighZone(reg, d.platform?.heightStep);
  if (heelHigh || platformHigh) mods.push("towering");
  if (heelHigh) fieldPaths.push("heel.heightStep");
  if (platformHigh) fieldPaths.push("platform.heightStep");

  const color = fieldValueProse(d.upper?.upperPrimaryColor);
  if (color) {
    mods.push(adjectiveForm(color));
    fieldPaths.push("upper.upperPrimaryColor");
  }
  const material = fieldValueProse(d.upper?.primaryMaterial);
  if (material) {
    mods.push(materialForm(material));
    fieldPaths.push("upper.primaryMaterial");
  }

  const subject = family ? pluralize(family) : "shoes";
  if (family) fieldPaths.push("upperFamily");
  let s = `A pair of ${[...mods, subject].join(" ")}`;

  if (heelNP && platformNP) s += ` with ${heelNP.text} and ${platformNP.text}`;
  else if (heelNP || platformNP) s += ` with ${(heelNP ?? platformNP)!.text}`;
  fieldPaths.push(...(heelNP?.fieldPaths ?? []), ...(platformNP?.fieldPaths ?? []));

  const spring = toeSpringClause(reg, d);
  if (spring && platformNP) {
    s += ` ${spring}`;
    fieldPaths.push("platform.toeSpringStep");
  }

  return { sectionKey: "identity", fieldPaths: [...new Set(fieldPaths)], text: s + "." };
}

function upperNarrative(d: ShoeDetails): Clause | null {
  const color = fieldValueProse(d.upper?.upperPrimaryColor);
  const material = fieldValueProse(d.upper?.primaryMaterial);
  if (!color && !material) return null;
  const secondary = fieldValueProse(d.upper?.secondaryMaterial);
  const made = [color, material].filter(Boolean).join(" ");
  let s = `The upper is constructed in ${made}.`;
  if (secondary) s += ` Accent panels in ${adjectiveForm(secondary)}.`;
  const fieldPaths: string[] = [];
  if (color) fieldPaths.push("upper.upperPrimaryColor");
  if (material) fieldPaths.push("upper.primaryMaterial");
  if (secondary) fieldPaths.push("upper.secondaryMaterial");
  return { sectionKey: "upper", fieldPaths, text: s };
}

type StrapRow = NonNullable<ShoeDetails["straps"]>[number];

function strapRowPhrase(reg: Registry, r: StrapRow): { text: string; fieldPaths: string[] } | null {
  const type = fieldValueProse(r.type);
  if (!type) return null;
  const fieldPaths = ["type"];
  const widthAdj = stepAdjectives(reg, r.widthStep).map((a) => a.toLowerCase());
  if (widthAdj.length) fieldPaths.push("widthStep");
  let s = `${widthAdj.length ? `${widthAdj.join(", ")} ` : ""}${prettify(type)}`;
  s = `${article(s)} ${s}`;
  const material = fieldValueProse(r.material);
  if (material) {
    s += ` in ${materialForm(material)}`;
    fieldPaths.push("material");
  }
  const anchor = fieldValueProse(r.anchor);
  if (anchor) {
    s += ` anchored at the ${prettify(anchor)}`;
    fieldPaths.push("anchor");
  }
  const hardware = fieldValueProse(r.hardwareFinish);
  const closure = fieldValueProse(r.closure);
  if (closure) {
    const lead = hardware ? `${prettify(hardware)} ${prettify(closure)}` : prettify(closure);
    s += ` closing with ${article(lead)} ${lead}`;
    fieldPaths.push("closure");
    if (hardware) fieldPaths.push("hardwareFinish");
  } else if (hardware) {
    s += ` finished with ${article(prettify(hardware))} ${prettify(hardware)} hardware`;
    fieldPaths.push("hardwareFinish");
  }
  return { text: s, fieldPaths };
}

function strapsClause(reg: Registry, d: ShoeDetails): Clause | null {
  const rows = d.straps ?? [];
  if (rows.length === 0) return null;
  const items: string[] = [];
  const fieldPaths: string[] = [];
  rows.forEach((r, i) => {
    const phrase = strapRowPhrase(reg, r);
    if (!phrase) return;
    items.push(phrase.text);
    fieldPaths.push(...phrase.fieldPaths.map((p) => `straps.${i}.${p}`));
  });
  if (items.length === 0) return null;
  return { sectionKey: "straps", fieldPaths, text: `Strapped with ${items.join("; and ")}.` };
}

function transitionClause(d: ShoeDetails): Clause | null {
  const wrap = fieldValueProse(d.transition?.wrap);
  const edge = fieldValueProse(d.transition?.edge);
  const fieldPaths: string[] = [];
  if (wrap) fieldPaths.push("transition.wrap");
  if (edge) fieldPaths.push("transition.edge");
  if (wrap && edge) {
    return {
      sectionKey: "transition",
      fieldPaths,
      text: `The upper meets the platform in ${article(prettify(wrap))} ${prettify(wrap)}, finished with ${article(prettify(edge))} ${prettify(edge)} transition.`,
    };
  }
  if (wrap) {
    return {
      sectionKey: "transition",
      fieldPaths,
      text: `The upper meets the platform in ${article(prettify(wrap))} ${prettify(wrap)}.`,
    };
  }
  if (edge) {
    return {
      sectionKey: "transition",
      fieldPaths,
      text: `The upper-platform transition is finished with ${article(prettify(edge))} ${prettify(edge)}.`,
    };
  }
  return null;
}

function heelDetailClause(d: ShoeDetails): Clause | null {
  const heel = d.heel;
  if (!heel) return null;
  // byte-identity: old fields alone (breastFinish, liftExternal) keep their old
  // compilation paths; the detail clause needs a deep field (profile, lift internal)
  if (!heel.breastProfile && !heel.liftInternal) return null;
  const parts: string[] = [];
  const fieldPaths: string[] = [];
  const breastFinish = fieldValueProse(heel.breastFinish);
  const breastProfile = fieldValueProse(heel.breastProfile);
  if (breastFinish || breastProfile) {
    const bits = [
      breastFinish ? prettify(breastFinish) : null,
      breastProfile ? `${prettify(breastProfile)} in profile` : null,
    ].filter(Boolean);
    parts.push(`The heel breast is ${bits.join(", ")}.`);
    if (breastFinish) fieldPaths.push("heel.breastFinish");
    if (breastProfile) fieldPaths.push("heel.breastProfile");
  }
  const liftExternal = fieldValueProse(heel.liftExternal);
  const liftInternal = fieldValueProse(heel.liftInternal);
  if (liftExternal || liftInternal) {
    const bits = [
      liftExternal ? `${prettify(liftExternal)} on the outside` : null,
      liftInternal ? `${prettify(liftInternal)} within` : null,
    ].filter(Boolean);
    parts.push(`The heel lift is ${bits.join(", ")}.`);
    if (liftExternal) fieldPaths.push("heel.liftExternal");
    if (liftInternal) fieldPaths.push("heel.liftInternal");
  }
  return parts.length ? { sectionKey: "heel", fieldPaths, text: parts.join(" ") } : null;
}

function counterClause(d: ShoeDetails): Clause | null {
  const c = d.counter;
  if (!c) return null;
  const rigidity = fieldValueProse(c.rigidity);
  const grip = fieldValueProse(c.grip);
  if (!rigidity && !grip) return null;
  const bits = [rigidity ? prettify(rigidity) : null, grip ? prettify(grip) : null].filter(Boolean);
  const fieldPaths: string[] = [];
  if (rigidity) fieldPaths.push("counter.rigidity");
  if (grip) fieldPaths.push("counter.grip");
  return { sectionKey: "counter", fieldPaths, text: `The heel counter is ${bits.join(", ")}.` };
}

function hardwareClause(d: ShoeDetails): Clause | null {
  const hw = d.hardware;
  if (!hw) return null;
  const type = fieldValueProse(hw.type);
  const finish = fieldValueProse(hw.finish);
  if (!type && !finish) return null;
  const fieldPaths: string[] = [];
  if (type) fieldPaths.push("hardware.type");
  if (finish) fieldPaths.push("hardware.finish");
  if (type && finish) return { sectionKey: "hardware", fieldPaths, text: `The hardware is ${prettify(type)} in ${prettify(finish)}.` };
  if (type) return { sectionKey: "hardware", fieldPaths, text: `The hardware is ${prettify(type)}.` };
  return { sectionKey: "hardware", fieldPaths, text: `The hardware is finished in ${prettify(finish!)}.` };
}

function outsoleDetailClause(d: ShoeDetails): Clause | null {
  const c = d.construction;
  if (!c) return null;
  const material = fieldValueProse(c.outsoleMaterial);
  const style = fieldValueProse(c.outsoleStyle);
  const finish = fieldValueProse(c.outsoleFinish);
  // byte-identity: material alone kept its old (non-)emission; style/finish are new
  if (!style && !finish) return null;
  const bits = [
    material ? `cut from ${materialForm(material)}` : null,
    style ? `${article(prettify(style))} ${prettify(style)} tread` : null,
    finish ? `${article(prettify(finish))} ${prettify(finish)} finish` : null,
  ].filter(Boolean);
  const fieldPaths: string[] = [];
  if (material) fieldPaths.push("construction.outsoleMaterial");
  if (style) fieldPaths.push("construction.outsoleStyle");
  if (finish) fieldPaths.push("construction.outsoleFinish");
  return { sectionKey: "construction", fieldPaths, text: `The outsole is ${bits.join(", ")}.` };
}

function heelNarrative(reg: Registry, d: ShoeDetails): Clause | null {
  const heel = d.heel;
  if (!heel) return null;
  // cross-field rule: top-zone heel over a platform -> the signature coordination clause
  const step = getStep(reg, heel.heightStep);
  const steps = reg.stepsByScale.get(step?.scaleId ?? "") ?? [];
  const isTop = !!step && steps.length > 0 && step.rank === steps[steps.length - 1].rank;
  if (!isTop || !d.platform?.heightStep) return null;
  const finish = fieldValueProse(heel.liftExternal);
  const finishAdj = finish ? materialForm(finish) : "";
  const typeProse = fieldValueProse(heel.type);
  const lead = finishAdj ? `The ${finishAdj} ${typeProse ?? "heel"} heel` : `The ${typeProse ?? "heel"} heel`;
  const fieldPaths = ["heel.heightStep", "platform.heightStep"];
  if (finish) fieldPaths.push("heel.liftExternal");
  if (typeProse) fieldPaths.push("heel.type");
  return {
    sectionKey: "heel",
    fieldPaths,
    text: `${lead} is ultra-long and needle-thin, rising far above the platform height.`,
  };
}

function outsoleClause(reg: Registry, d: ShoeDetails): Clause | null {
  const lacquer = fieldValueProse(d.outsole?.lacquerColor);
  if (!lacquer) return null;
  const glossAdj = stepAdjectives(reg, d.outsole?.lacquerGloss);
  const gloss = glossAdj.length ? `${glossAdj[0].toLowerCase()}, ` : "";
  const breast = fieldValueProse(d.heel?.breastFinish);
  const accentuated = !!breast && adjectiveForm(breast) !== adjectiveForm(lacquer);
  let s = `The entire outsole and the inner heel breast are finished in a highly visible, ${gloss}${lacquer} lacquer`;
  if (accentuated) {
    s += `, with the heel's inner line accentuated in ${adjectiveForm(breast)}`;
  }
  s += `, serving as a clean ${SIGNATURE_PHRASE}.`;
  const fieldPaths = ["outsole.lacquerColor"];
  if (glossAdj.length) fieldPaths.push("outsole.lacquerGloss");
  if (accentuated) fieldPaths.push("heel.breastFinish");
  return { sectionKey: "outsole", fieldPaths, text: s };
}

function absenceClause(d: ShoeDetails): Clause | null {
  const c = d.construction;
  if (!c) return null;
  const weltAbsent = isAbsent(normalizeFieldValue(c.welt));
  const ornamentAbsent = isAbsent(normalizeFieldValue(c.ornamentation));
  const fieldPaths: string[] = [];
  if (weltAbsent) fieldPaths.push("construction.welt");
  if (ornamentAbsent) fieldPaths.push("construction.ornamentation");
  if (weltAbsent && ornamentAbsent) {
    return { sectionKey: "construction", fieldPaths, text: BOTH_ABSENT_TEXT };
  }
  if (weltAbsent) return { sectionKey: "construction", fieldPaths, text: WELT_ABSENT_TEXT };
  if (ornamentAbsent) return { sectionKey: "construction", fieldPaths, text: ORNAMENT_ABSENT_TEXT };
  return null;
}

function adornmentClause(d: ShoeDetails): Clause | null {
  const list = d.adornments ?? [];
  if (list.length === 0) return null;
  const fieldPaths: string[] = [];
  const items = list.map((a, i) => {
    const type = fieldValueProse(a.type);
    if (!type) return null;
    const placement = fieldValueProse(a.placement);
    if (placement) fieldPaths.push(`adornments.${i}.placement`);
    fieldPaths.push(`adornments.${i}.type`);
    return placement ? `${type} at the ${adjectiveForm(placement)}` : type;
  }).filter(Boolean) as string[];
  if (items.length === 0) return null;
  return { sectionKey: "adornments", fieldPaths, text: `Adorned with ${joinWithOr(items)}.` };
}

function shaftClause(reg: Registry, d: ShoeDetails): Clause | null {
  const shaft = d.shaft;
  if (!shaft?.heightStep) return null;
  const step = getStep(reg, shaft.heightStep);
  if (!step) return null;
  const fit = fieldValueProse(shaft.fit);
  const fieldPaths = ["shaft.heightStep"];
  if (fit) fieldPaths.push("shaft.fit");
  return {
    sectionKey: "shaft",
    fieldPaths,
    text: `The shaft rises to ${step.adjectives.join(", ")} height${fit ? `, ${adjectiveForm(fit)} in fit` : ""}.`,
  };
}

function fasteningClause(d: ShoeDetails): Clause | null {
  const fast = d.silhouette?.fastening;
  if (!fast) return null;
  if (isAbsent(normalizeFieldValue(fast))) return null; // slip-on by omission
  const prose = fieldValueProse(fast);
  if (!prose) return null;
  const p = prose.replaceAll("-", " ");
  return {
    sectionKey: "silhouette",
    fieldPaths: ["silhouette.fastening"],
    text: `Fastened with ${/^[aeiou]/.test(p) ? "an" : "a"} ${p}.`,
  };
}

function sensoryCloser(d: ShoeDetails): Clause | null {
  const light = fieldValueProse(d.sensory?.lightBehavior);
  if (!light) return null;
  const material = fieldValueProse(d.upper?.primaryMaterial);
  const surface = material ? `The ${adjectiveForm(material)} surface` : "The surface";
  const fieldPaths = ["sensory.lightBehavior"];
  if (material) fieldPaths.push("upper.primaryMaterial");
  return { sectionKey: "sensory", fieldPaths, text: `${surface} produces ${light} under studio lighting.` };
}

// ---- entry -----------------------------------------------------------------

/** Structured clauses in prompt order; the preamble is a provenance-free first clause. */
export function compileShoeClauses(sheet: CompileSheet, reg: Registry): Clause[] {
  const d = sheet.details ?? {};
  return [
    { sectionKey: "preamble", fieldPaths: [], text: PREAMBLE },
    openingSentence(reg, sheet),
    upperNarrative(d),
    strapsClause(reg, d),
    transitionClause(d),
    fasteningClause(d),
    heelNarrative(reg, d),
    heelDetailClause(d),
    shaftClause(reg, d),
    counterClause(d),
    hardwareClause(d),
    adornmentClause(d),
    outsoleDetailClause(d),
    outsoleClause(reg, d),
    absenceClause(d),
    sensoryCloser(d),
  ].filter((c): c is Clause => c !== null);
}

export function compileShoePrompt(sheet: CompileSheet, reg: Registry): string {
  return compileShoeClauses(sheet, reg).map((c) => c.text).join("\n\n");
}

/** Digit check used by tests: compiled prompts must never contain measurements. */
export function containsDigits(text: string): boolean {
  return /\d/.test(text);
}
