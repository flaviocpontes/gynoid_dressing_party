/**
 * Applicability model: which sheet paths CANNOT apply to a shoe's upper family.
 * N/A (not applicable) is distinct from explicit absence (family could have the
 * feature, this shoe does not) and from unfilled (not yet described).
 * Rules-as-data like ABSENCE_ALLOWED; launch scope is deliberately minimal.
 */

export type ApplicabilityRule = {
  /** dot-path prefixes gated by this rule (prefix match on path segments) */
  paths: string[];
  /** upper families the paths DO apply to */
  families: string[];
};

/** Families that carry a shaft — same group lint's boot expectation uses. */
export const BOOT_FAMILIES = ["boot", "bootie", "shootie"];

export const APPLICABILITY: ApplicabilityRule[] = [
  // shaft is boot-only; straps deliberately ungated (Mary Janes, gladiators, boots all strap)
  { paths: ["shaft"], families: BOOT_FAMILIES },
];

export function isApplicable(family: string | null | undefined, path: string): boolean {
  for (const rule of APPLICABILITY) {
    const gated = rule.paths.some((p) => path === p || path.startsWith(`${p}.`));
    if (gated) return rule.families.includes(family ?? "");
  }
  return true;
}
