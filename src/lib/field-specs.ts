export type FieldSpec = {
  path: string; // dot path inside details, e.g. "heel.type"
  label: string;
  kind: "vocab" | "scale" | "text";
  vocab?: string;
  scale?: string;
  allowChoice?: boolean;
  allowAbsent?: boolean;
};

/** Repeatable sub-entity rows (straps): rowFields use paths relative to the row. */
export type GroupSpec = {
  path: string; // details key holding the array, e.g. "straps"
  label: string;
  kind: "group";
  rowFields: FieldSpec[];
};

export type SectionField = FieldSpec | GroupSpec;

export type SectionSpec = { title: string; open: boolean; fields: SectionField[] };

export const STRAP_ROW_FIELDS: FieldSpec[] = [
  { path: "type", label: "Type", kind: "vocab", vocab: "strap_type" },
  { path: "widthStep", label: "Width", kind: "scale", scale: "general.width" },
  { path: "material", label: "Material", kind: "vocab", vocab: "primary_material" },
  { path: "hardwareFinish", label: "Hardware finish", kind: "vocab", vocab: "hardware_finish" },
  { path: "anchor", label: "Anchor", kind: "vocab", vocab: "strap_anchor" },
  { path: "closure", label: "Closure", kind: "vocab", vocab: "strap_closure" },
  { path: "note", label: "Note", kind: "text" },
];

export const ADORNMENT_PLACEMENT_VOCAB = "adornment_placement";
export const ADORNMENT_TYPE_VOCAB = "embellishment";

export const ADORNMENT_ROW_FIELDS: FieldSpec[] = [
  { path: "type", label: "Type", kind: "vocab", vocab: ADORNMENT_TYPE_VOCAB },
  { path: "placement", label: "Placement", kind: "vocab", vocab: ADORNMENT_PLACEMENT_VOCAB, allowChoice: true },
  { path: "note", label: "Note", kind: "text" },
];

export const EDITOR_SECTIONS: SectionSpec[] = [
  {
    title: "Silhouette",
    open: true,
    fields: [
      { path: "silhouette.toeShape", label: "Toe shape", kind: "vocab", vocab: "toe_shape" },
      { path: "silhouette.vampCoverage", label: "Vamp coverage", kind: "vocab", vocab: "vamp_coverage" },
      { path: "silhouette.toeBox", label: "Toe box structure", kind: "vocab", vocab: "toe_box_structure" },
      { path: "silhouette.throat", label: "Throat", kind: "vocab", vocab: "throat", allowChoice: true },
      { path: "silhouette.quarterStyle", label: "Quarter style", kind: "vocab", vocab: "quarter_style" },
      { path: "silhouette.toplineFinish", label: "Topline finish", kind: "vocab", vocab: "topline_finish" },
      { path: "silhouette.fastening", label: "Fastening", kind: "vocab", vocab: "fastening", allowChoice: true, allowAbsent: true },
    ],
  },
  {
    title: "Upper & colorway",
    open: true,
    fields: [
      { path: "upper.primaryMaterial", label: "Primary material", kind: "vocab", vocab: "primary_material" },
      { path: "upper.secondaryMaterial", label: "Secondary material", kind: "vocab", vocab: "primary_material", allowAbsent: true },
      { path: "upper.upperPrimaryColor", label: "Upper primary color", kind: "vocab", vocab: "upper_color" },
      { path: "upper.upperSecondaryColor", label: "Upper secondary color", kind: "vocab", vocab: "upper_color" },
      { path: "outsole.lacquerColor", label: "Outsole lacquer color (house signature)", kind: "vocab", vocab: "outsole_lacquer_color" },
      { path: "outsole.lacquerGloss", label: "Lacquer gloss", kind: "scale", scale: "general.smoothness" },
      { path: "upper.lining.material", label: "Lining material", kind: "vocab", vocab: "primary_material" },
    ],
  },
  {
    title: "Platform",
    open: true,
    fields: [
      { path: "platform.heightStep", label: "Platform height", kind: "scale", scale: "shoes.platform_height" },
      { path: "platform.presenceStep", label: "Platform presence", kind: "scale", scale: "general.prominence" },
      { path: "platform.shape", label: "Platform shape", kind: "vocab", vocab: "platform_shape", allowChoice: true },
      { path: "platform.material", label: "Platform material", kind: "vocab", vocab: "primary_material" },
      { path: "platform.edgeProfile", label: "Platform edge profile", kind: "vocab", vocab: "platform_edge" },
      { path: "platform.toeSpringStep", label: "Toe spring", kind: "scale", scale: "shoes.toe_spring" },
    ],
  },
  {
    title: "Heel",
    open: true,
    fields: [
      { path: "heel.type", label: "Heel type", kind: "vocab", vocab: "heel_type", allowChoice: true },
      { path: "heel.heightStep", label: "Heel height", kind: "scale", scale: "shoes.heel_height" },
      { path: "heel.pitchStep", label: "Heel pitch", kind: "scale", scale: "shoes.pitch" },
      { path: "heel.heelSeat", label: "Heel seat", kind: "vocab", vocab: "heel_seat", allowAbsent: true },
      { path: "heel.breastFinish", label: "Heel breast finish", kind: "vocab", vocab: "heel_breast_finish" },
      { path: "heel.breastProfile", label: "Heel breast profile", kind: "vocab", vocab: "heel_breast_profile" },
      { path: "heel.liftExternal", label: "Heel stem finish (lift)", kind: "text" },
      { path: "heel.liftInternal", label: "Heel lift internal", kind: "text" },
      { path: "heel.topPiece.material", label: "Top piece material", kind: "vocab", vocab: "primary_material" },
      { path: "heel.topPiece.sizeStep", label: "Top piece size", kind: "scale", scale: "general.width" },
      { path: "heel.topPiece.shape", label: "Top piece shape", kind: "text" },
      { path: "heel.topPiece.acoustic", label: "Top piece acoustic", kind: "text" },
    ],
  },
  {
    title: "Upper-platform transition",
    open: false,
    fields: [
      { path: "transition.wrap", label: "Wrap relationship", kind: "vocab", vocab: "transition_wrap", allowChoice: true },
      { path: "transition.edge", label: "Edge treatment", kind: "vocab", vocab: "transition_edge" },
    ],
  },
  {
    title: "Straps",
    open: false,
    fields: [
      { path: "straps", label: "Strap rows", kind: "group", rowFields: STRAP_ROW_FIELDS },
    ],
  },
  {
    title: "Counter & hardware",
    open: false,
    fields: [
      { path: "counter.rigidity", label: "Counter rigidity", kind: "vocab", vocab: "counter_rigidity" },
      { path: "counter.grip", label: "Counter grip/lining", kind: "vocab", vocab: "counter_grip" },
      { path: "hardware.type", label: "Hardware type", kind: "vocab", vocab: "hardware_type", allowChoice: true },
      { path: "hardware.finish", label: "Hardware finish", kind: "vocab", vocab: "hardware_finish" },
    ],
  },
  {
    title: "Adornments",
    open: false,
    fields: [
      { path: "adornments", label: "Adornment rows", kind: "group", rowFields: ADORNMENT_ROW_FIELDS },
    ],
  },
  {
    title: "Shaft (boots)",
    open: false,
    fields: [
      { path: "shaft.heightStep", label: "Shaft height", kind: "scale", scale: "shoes.shaft_height" },
      { path: "shaft.fit", label: "Shaft fit", kind: "text" },
      { path: "shaft.material", label: "Shaft material", kind: "vocab", vocab: "primary_material" },
    ],
  },
  {
    title: "Construction detail",
    open: false,
    fields: [
      { path: "construction.welt", label: "Welt type", kind: "vocab", vocab: "welt_type", allowAbsent: true },
      { path: "construction.weltVisibility", label: "Welt visibility", kind: "vocab", vocab: "welt_visibility" },
      { path: "construction.ornamentation", label: "Ornamentation", kind: "text", allowAbsent: true },
      { path: "construction.shank", label: "Shank", kind: "text", allowAbsent: true },
      { path: "construction.insoleMaterial", label: "Insole material", kind: "vocab", vocab: "primary_material" },
      { path: "construction.cushioning", label: "Insole cushioning", kind: "vocab", vocab: "insole_cushioning" },
      { path: "construction.outsoleMaterial", label: "Outsole material", kind: "vocab", vocab: "primary_material" },
      { path: "construction.outsoleStyle", label: "Outsole style", kind: "vocab", vocab: "outsole_style" },
      { path: "construction.outsoleFinish", label: "Outsole finish", kind: "vocab", vocab: "outsole_finish" },
      { path: "construction.outsoleTexture", label: "Outsole texture", kind: "text" },
    ],
  },
  {
    title: "Sensory",
    open: false,
    fields: [
      { path: "sensory.stepSound", label: "Step sound", kind: "text" },
      { path: "sensory.lightBehavior", label: "Light behavior (drives closer)", kind: "text" },
      { path: "sensory.wearProfile", label: "Wear profile", kind: "text" },
    ],
  },
];

// ---- path helpers -----------------------------------------------------------

/** Filled/total field counts for a section's fields (groups count once, filled when a typed row exists). */
export function sectionCounts(
  details: Record<string, unknown>,
  fields: SectionField[],
): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const f of fields) {
    total += 1;
    if (f.kind === "group") {
      const rows = (getPath(details, f.path) as Record<string, unknown>[] | undefined) ?? [];
      if (rows.some((r) => rowHasType(r))) filled += 1;
    } else {
      const v = getPath(details, f.path);
      if (v !== undefined && v !== null && v !== "") filled += 1;
    }
  }
  return { filled, total };
}

function rowHasType(row: Record<string, unknown>): boolean {
  const t = row?.type;
  if (Array.isArray(t)) return t.length > 0;
  return typeof t === "string" && t.trim().length > 0;
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

export function setPath<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone: Record<string, unknown> = Array.isArray(obj) ? [...(obj as unknown as unknown[])] as unknown as Record<string, unknown> : { ...(obj as Record<string, unknown>) };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] = next && typeof next === "object" ? (Array.isArray(next) ? [...next] : { ...(next as Record<string, unknown>) }) : {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (value === undefined || value === "") delete cur[last];
  else cur[last] = value;
  return clone as T;
}
