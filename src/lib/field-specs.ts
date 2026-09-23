export type FieldSpec = {
  path: string; // dot path inside details, e.g. "heel.type"
  label: string;
  kind: "vocab" | "scale" | "text";
  vocab?: string;
  scale?: string;
  allowChoice?: boolean;
  allowAbsent?: boolean;
};

export type SectionSpec = { title: string; open: boolean; fields: FieldSpec[] };

export const EDITOR_SECTIONS: SectionSpec[] = [
  {
    title: "Silhouette",
    open: true,
    fields: [
      { path: "silhouette.toeShape", label: "Toe shape", kind: "vocab", vocab: "toe_shape" },
      { path: "silhouette.vampCoverage", label: "Vamp coverage", kind: "vocab", vocab: "vamp_coverage" },
      { path: "silhouette.toeBox", label: "Toe box structure", kind: "text" },
      { path: "silhouette.throat", label: "Throat", kind: "text" },
      { path: "silhouette.quarterStyle", label: "Quarter style", kind: "text" },
      { path: "silhouette.toplineFinish", label: "Topline finish", kind: "text" },
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
      { path: "heel.heelSeat", label: "Heel seat", kind: "text", allowAbsent: true },
      { path: "heel.breastFinish", label: "Heel breast finish", kind: "text" },
      { path: "heel.liftExternal", label: "Heel stem finish (lift)", kind: "text" },
      { path: "heel.topPiece.sizeStep", label: "Top piece size", kind: "scale", scale: "general.width" },
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
      { path: "construction.welt", label: "Welt", kind: "text", allowAbsent: true },
      { path: "construction.ornamentation", label: "Ornamentation", kind: "text", allowAbsent: true },
      { path: "construction.shank", label: "Shank", kind: "text", allowAbsent: true },
      { path: "construction.insoleMaterial", label: "Insole material", kind: "vocab", vocab: "primary_material" },
      { path: "construction.outsoleMaterial", label: "Outsole material", kind: "vocab", vocab: "primary_material" },
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

export const ADORNMENT_PLACEMENT_VOCAB = "adornment_placement";
export const ADORNMENT_TYPE_VOCAB = "embellishment";

// ---- path helpers -----------------------------------------------------------

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
