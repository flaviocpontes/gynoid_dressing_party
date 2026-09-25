import { describe, it, expect } from "vitest";
import { applyPassToSheet, reparseSheet, workingSheetSchema } from "@/domain/import/merge";
import { registryFromSeed } from "./seed-registry";

const blank = () => workingSheetSchema.parse({});

describe("applyPassToSheet", () => {
  it("writes proposals with pass provenance and clears their old notes", () => {
    const sheet = { ...blank(), notes: { "heel.type": "old note" } };
    const out = applyPassToSheet(sheet, "heel", {
      proposals: [{ path: "heel.type", value: "stiletto" }],
      notes: [{ path: "heel.heightStep", note: "not a step reference" }],
    });
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBe("stiletto");
    expect(out.provenance["heel.type"]).toBe("heel");
    expect(out.notes).toEqual({ "heel.heightStep": "not a step reference" });
    expect(sheet.notes["heel.type"]).toBe("old note"); // input untouched
  });

  it("a machine proposal skips a user-owned path", () => {
    const sheet = applyPassToSheet(blank(), "heel", { proposals: [{ path: "heel.type", value: "block" }], notes: [] });
    sheet.provenance["heel.type"] = "user";
    const out = applyPassToSheet(sheet, "heel", { proposals: [{ path: "heel.type", value: "stiletto" }], notes: [] });
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBe("block");
    expect(out.provenance["heel.type"]).toBe("user");
  });

  it("a live re-ask overrides user ownership of its own field; replay does not", () => {
    const sheet = { ...blank(), provenance: { "heel.type": "user" } };
    const parsed = { proposals: [{ path: "heel.type", value: "stiletto" }], notes: [] };
    const live = applyPassToSheet(sheet, "re-ask:heel.type", parsed, { liveReAsk: true });
    expect((live.details as { heel?: { type?: string } }).heel?.type).toBe("stiletto");
    expect(live.provenance["heel.type"]).toBe("re-ask:heel.type");
    const replay = applyPassToSheet(sheet, "re-ask:heel.type", parsed);
    expect((replay.details as { heel?: { type?: string } }).heel?.type).toBeUndefined();
    expect(replay.provenance["heel.type"]).toBe("user");
  });

  it("a re-ask with no proposal clears the machine value", () => {
    const sheet = applyPassToSheet(blank(), "heel", { proposals: [{ path: "heel.type", value: "block" }], notes: [] });
    const out = applyPassToSheet(sheet, "re-ask:heel.type", { proposals: [], notes: [] });
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBeUndefined();
    expect(out.provenance["heel.type"]).toBeUndefined();
  });
});

describe("reparseSheet", () => {
  const reg = registryFromSeed();
  // verbatim shape of the stored silhouette pass that the v1 parser lost
  const silhouetteResponse =
    '```json\n{\n  "construction": "pump",\n  "silhouette": {\n    "toeShape": "round",\n    "vampCoverage": "low-vamp",\n    "toeBox": "reinforced-stiff",\n    "throat": "rounded-u-shaped",\n    "quarterStyle": "full-quarter",\n    "toplineFinish": "folded-edge",\n    "fastening": "slip-on"\n  }\n}\n```';

  it("recovers answers from a stored response", () => {
    const out = reparseSheet(blank(), [{ passKey: "silhouette", responseText: silhouetteResponse }], reg);
    const sil = (out.details as { silhouette?: Record<string, unknown> }).silhouette ?? {};
    expect(Object.keys(sil)).toHaveLength(7);
    expect(sil.toeShape).toBe("round");
    expect(out.provenance["silhouette.toeShape"]).toBe("silhouette");
  });

  it("user edits survive re-parse", () => {
    let sheet = applyPassToSheet(blank(), "silhouette", { proposals: [{ path: "silhouette.toeShape", value: "almond" }], notes: [] });
    sheet.provenance["silhouette.toeShape"] = "user";
    sheet = reparseSheet(sheet, [{ passKey: "silhouette", responseText: silhouetteResponse }], reg);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBe("almond");
  });

  it("a user-cleared field stays cleared", () => {
    const sheet = { ...blank(), provenance: { "platform.shape": "user" } };
    const out = reparseSheet(sheet, [{ passKey: "platform", responseText: '{"platform.shape": "flat"}' }], reg);
    expect((out.details as { platform?: { shape?: string } }).platform?.shape).toBeUndefined();
  });

  it("drops stale machine values and notes, keeps identity, skips family and failed passes", () => {
    let sheet = { ...blank(), slug: "keep-me", displayName: "Keep Me", upperFamily: "pump" };
    sheet = applyPassToSheet(sheet, "heel", {
      proposals: [{ path: "heel.type", value: "kitten" }],
      notes: [{ path: "heel.heightStep", note: "old" }],
    });
    const out = reparseSheet(
      sheet,
      [
        { passKey: "family", responseText: '{"upperFamily": "flat"}' },
        { passKey: "heel", responseText: "" },
        { passKey: "upper", responseText: '{"upper.primaryMaterial": "patent leather"}' },
      ],
      reg,
    );
    expect(out.slug).toBe("keep-me");
    expect(out.upperFamily).toBe("pump");
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBeUndefined();
    expect(out.notes).toEqual({});
    expect(out.provenance["upper.primaryMaterial"]).toBe("upper");
  });

  it("a user edit inside a group row protects the whole row set", () => {
    let sheet = applyPassToSheet(blank(), "straps", { proposals: [{ path: "straps", value: [{ type: "ankle-strap" }] }], notes: [] });
    sheet.provenance["straps.0.type"] = "user";
    sheet = reparseSheet(sheet, [{ passKey: "straps", responseText: '{"straps": [{"type": "t-strap"}]}' }], reg);
    expect((sheet.details as { straps?: { type: string }[] }).straps?.[0].type).toBe("ankle-strap");
  });
});
