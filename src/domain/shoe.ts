import { z } from "zod";

/**
 * Field value states:
 *  - null / undefined       -> unfilled (omitted from compiled prompts)
 *  - string                 -> single value
 *  - string[] (length >= 2) -> disjunctive choice-set (compiles with "or")
 *  - { absent: true }       -> explicit absence (compiles an absence clause)
 */
export const fieldValue = z.union([
  z.string(),
  z.array(z.string()).min(2),
  z.object({ absent: z.literal(true) }),
]);

export type FieldValue = z.infer<typeof fieldValue>;

/** Fields where explicit absence is meaningful (taxonomy-defined absence clauses). */
export const ABSENCE_ALLOWED = new Set([
  "construction.welt",
  "construction.ornamentation",
  "construction.shank",
  "silhouette.fastening",
  "upper.secondaryMaterial",
  "heel.heelSeat",
]);

const absentable = z.union([z.string(), z.array(z.string()).min(2)]);

export const shoeDetails = z
  .object({
    silhouette: z
      .object({
        toeShape: fieldValue.optional(),
        vampCoverage: fieldValue.optional(),
        toeBox: fieldValue.optional(),
        throat: fieldValue.optional(),
        quarterStyle: fieldValue.optional(),
        toplineFinish: fieldValue.optional(),
        fastening: fieldValue.optional(),
      })
      .optional(),
    upper: z
      .object({
        primaryMaterial: fieldValue.optional(),
        secondaryMaterial: fieldValue.optional(),
        upperPrimaryColor: absentable.optional(),
        upperSecondaryColor: absentable.optional(),
        hsl: z.string().optional(), // display-only annotation
        lining: z
          .object({ material: fieldValue.optional(), color: z.string().optional() })
          .optional(),
      })
      .optional(),
    outsole: z
      .object({
        lacquerColor: absentable.optional(),
        lacquerGloss: z.string().optional(), // scale step id (general.smoothness:N)
      })
      .optional(),
    platform: z
      .object({
        heightStep: z.string().optional(), // scale step id (shoes.platform_height:N)
        presenceStep: z.string().optional(), // general.prominence:N
        shape: fieldValue.optional(),
        material: fieldValue.optional(),
        edgeProfile: fieldValue.optional(),
        toeSpringStep: z.string().optional(), // shoes.toe_spring:N
      })
      .optional(),
    heel: z
      .object({
        type: fieldValue.optional(),
        heightStep: z.string().optional(), // shoes.heel_height:N
        pitchStep: z.string().optional(), // shoes.pitch:N
        heelSeat: fieldValue.optional(),
        breastFinish: fieldValue.optional(),
        liftExternal: fieldValue.optional(),
        topPiece: z
          .object({
            material: fieldValue.optional(),
            sizeStep: z.string().optional(), // general.width:N
            shape: fieldValue.optional(),
            acoustic: fieldValue.optional(),
          })
          .optional(),
      })
      .optional(),
    shaft: z
      .object({
        heightStep: z.string().optional(), // shoes.shaft_height:N
        fit: fieldValue.optional(),
        material: fieldValue.optional(),
        construction: fieldValue.optional(),
      })
      .optional(),
    adornments: z
      .array(
        z.object({
          type: fieldValue,
          placement: fieldValue.optional(),
          note: z.string().optional(),
        }),
      )
      .optional(),
    adornmentDensity: z.string().optional(), // general.intensity:N
    construction: z
      .object({
        welt: fieldValue.optional(),
        ornamentation: fieldValue.optional(),
        shank: fieldValue.optional(),
        insoleMaterial: fieldValue.optional(),
        insoleBranding: fieldValue.optional(),
        outsoleMaterial: fieldValue.optional(),
        outsoleTexture: fieldValue.optional(),
        counterRigidity: fieldValue.optional(),
      })
      .optional(),
    sensory: z
      .object({
        stepSound: fieldValue.optional(),
        lightBehavior: fieldValue.optional(),
        wearProfile: fieldValue.optional(),
      })
      .optional(),
  })
  .superRefine((details, ctx) => {
    const walk = (obj: unknown, prefix: string) => {
      for (const [k, v] of Object.entries(obj ?? {})) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v) && "absent" in v) {
          if (!ABSENCE_ALLOWED.has(path)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `explicit absence not defined for ${path}`,
              path: path.split("."),
            });
          }
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
          walk(v, path);
        }
      }
    };
    walk(details, "");
  });

export type ShoeDetails = z.infer<typeof shoeDetails>;

export const shoeCreateInput = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be kebab-case"),
  displayName: z.string().min(1),
  upperFamily: z.string().optional().nullable(),
  originCharacter: z.string().optional().nullable(),
  styleFamily: z.array(z.string()).optional(),
  appearanceTier: z.enum(["source", "public", "private"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  details: shoeDetails.optional(),
  proseDescription: z.string().optional().nullable(),
});

export type ShoeCreateInput = z.infer<typeof shoeCreateInput>;

export const shoeUpdateInput = shoeCreateInput.extend({
  slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
});

export type ShoeUpdateInput = z.infer<typeof shoeUpdateInput>;

// ---- value-state helpers -------------------------------------------------

export function isFilled(v: FieldValue | null | undefined): boolean {
  return v !== null && v !== undefined;
}

export function isChoice(v: FieldValue | null | undefined): v is string[] {
  return Array.isArray(v);
}

export function isAbsent(v: FieldValue | null | undefined): v is { absent: true } {
  return !!v && typeof v === "object" && !Array.isArray(v) && "absent" in v;
}

/** Normalize: single-element arrays collapse to a plain value. */
export function normalizeFieldValue<T extends FieldValue | null | undefined>(v: T): T {
  if (Array.isArray(v) && v.length === 1) return v[0] as T;
  return v;
}
